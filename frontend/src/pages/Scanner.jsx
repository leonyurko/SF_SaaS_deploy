import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';
import { getAllWarehouses } from '../services/warehouseService';

const Scanner = () => {
  const { setPageTitle } = useOutletContext();
  const [scanResult, setScanResult] = useState(null);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [actionType, setActionType] = useState('deduction');
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  // Custom Scanner State
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  const scannerRef = useRef(null);
  const lastScannedCodeRef = useRef(null);

  useEffect(() => {
    setPageTitle('Barcode Scanner');
    loadWarehouses();

    // Initialize scanner instance
    // We don't start it yet, just prepare the instance
    // Note: Html5Qrcode constructor takes the element ID

    return () => {
      stopScanning();
    };
  }, [setPageTitle]);

  const loadWarehouses = async () => {
    try {
      const data = await getAllWarehouses();
      setWarehouses(data);
    } catch (err) {
      console.error("Failed to load warehouses", err);
    }
  };

  const getCameras = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length) {
        setCameras(devices);
        // Prefer back camera if available
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back'));
        setSelectedCamera(backCamera ? backCamera.id : devices[0].id);
        setPermissionError(false);
      } else {
        setError('No cameras found.');
      }
    } catch (err) {
      console.error('Error getting cameras', err);
      setPermissionError(true);
      setError('Camera permission denied or not supported.');
    }
  };

  const startScanning = async () => {
    if (!selectedCamera) {
      await getCameras();
      // If still no camera after trying to get them, return
      if (!selectedCamera && cameras.length === 0) return;
    }

    // If we just fetched cameras, selectedCamera might still be empty in this closure
    // So we use the state setter callback or just re-check in next render?
    // Better: let the user click start again if cameras were just fetched, 
    // OR handle the async nature.
    // For simplicity, let's assume getCameras sets state and we might need to wait.
    // Actually, if cameras are empty, getCameras() is called. 
    // If it succeeds, it sets cameras and selectedCamera.
    // But we can't immediately use selectedCamera here.
    // So we'll split the logic: "Enable Camera" vs "Start Scanning".

    // Let's try to start with the first available if not selected
    let cameraId = selectedCamera;
    if (!cameraId && cameras.length > 0) {
      cameraId = cameras[0].id;
    }

    if (!cameraId) {
      // Try to get cameras one more time then fail
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          setCameras(devices);
          cameraId = devices[0].id;
          setSelectedCamera(cameraId);
        } else {
          return;
        }
      } catch (e) {
        setPermissionError(true);
        return;
      }
    }

    try {
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edgeSize = Math.floor(minEdge * 0.8);
            return { width: edgeSize, height: edgeSize };
          }
        },
        onScanSuccess,
        onScanFailure
      );
      setIsScanning(true);
      setError(null);
    } catch (err) {
      console.error("Error starting scanner", err);
      setError("Failed to start camera. " + err);
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        setIsScanning(false);
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
  };

  const onScanSuccess = async (decodedText, decodedResult) => {
    if (lastScannedCodeRef.current === decodedText) return;

    console.log('Scanned:', decodedText);
    lastScannedCodeRef.current = decodedText;
    setScanResult(decodedText);

    // Optional: Stop scanning after success? 
    // Usually for inventory you want to keep scanning.
    // But maybe pause?

    setLoading(true);
    setError(null);
    setItem(null);

    try {
      const response = await api.get(`/inventory/barcode/${decodedText}`);
      if (response.data.status === 'success') {
        const itemData = response.data.data.item;
        setItem(itemData);
        // Default to item's primary warehouse or first available
        if (itemData.warehouse_id) {
          setSelectedWarehouse(itemData.warehouse_id);
        } else if (warehouses.length > 0) {
          setSelectedWarehouse(warehouses[0].id);
        }
        // Play a beep sound?
      }
    } catch (err) {
      console.log('Item not found');
      setError('Scanned barcode or QR is not in the system');
    } finally {
      setLoading(false);
    }
  };

  const onScanFailure = (error) => {
    // console.warn(`Code scan error = ${error}`);
  };

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    if (!item) return;

    try {
      setLoading(true);
      await api.post(`/inventory/${item.id}/stock`, {
        quantity: parseInt(quantity),
        reason: reason || (actionType === 'addition' ? 'Restock' : 'Usage'),
        type: actionType,
        warehouseId: selectedWarehouse
      });

      alert('Stock updated successfully!');
      setQuantity(1);
      setReason('');
      const response = await api.get(`/inventory/${item.id}`);
      setItem(response.data.data.item);
    } catch (err) {
      alert('Failed to update stock: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setItem(null);
    setError(null);
    setQuantity(1);
    setReason('');
    lastScannedCodeRef.current = null;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Scanner Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Scan Barcode</h2>

          {permissionError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              <p className="font-bold">Camera Access Denied</p>
              <p>Please allow camera permissions in your browser settings.</p>
              <p className="mt-2 text-xs">Note: On mobile, ensure you are using HTTPS or have enabled the "Insecure origins" flag.</p>
            </div>
          )}

          <div className="mb-4">
            {!isScanning ? (
              <div className="space-y-3">
                {cameras.length > 0 && (
                  <select
                    className="w-full p-2 border rounded"
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                  >
                    {cameras.map(cam => (
                      <option key={cam.id} value={cam.id}>{cam.label || `Camera ${cam.id.substr(0, 5)}...`}</option>
                    ))}
                  </select>
                )}

                <button
                  onClick={startScanning}
                  className="w-full py-3 bg-brand-red text-white rounded-lg font-semibold hover:bg-red-700 flex items-center justify-center"
                >
                  <i className="fas fa-camera mr-2"></i>
                  {cameras.length === 0 ? 'Enable Camera' : 'Start Scanning'}
                </button>
              </div>
            ) : (
              <button
                onClick={stopScanning}
                className="w-full py-2 bg-red-100 text-red-700 border border-red-300 rounded-lg font-semibold hover:bg-red-200"
              >
                Stop Scanning
              </button>
            )}
          </div>

          {/* Camera Preview Area */}
          <div className="relative w-full bg-black rounded-lg overflow-hidden min-h-[300px]">
            <div id="reader" className="w-full h-full"></div>
            {!isScanning && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <i className="fas fa-camera text-4xl mb-2"></i>
                  <p>Camera is currently off</p>
                </div>
              </div>
            )}
          </div>

          {/* Scan Result */}
          {scanResult && (
            <div className="mt-4 p-4 bg-blue-50 text-blue-700 rounded-md flex justify-between items-center">
              <span>Scanned: <strong>{scanResult}</strong></span>
              <button
                onClick={resetScanner}
                className="text-sm underline hover:text-red-900"
              >
                Scan Another
              </button>
            </div>
          )}
        </div>

        {/* Item Details & Action Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Item Details</h2>

          {loading && <div className="text-center py-4">Loading...</div>}

          {error && !permissionError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              {error}
            </div>
          )}

          {!item && !loading && !error && (
            <div className="text-gray-500 text-center py-8">
              Scan an item to view details and manage stock.
            </div>
          )}

          {item && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                <p className="text-sm text-gray-500">{item.category_name} / {item.sub_category_name}</p>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <span className="block text-xs text-gray-500">
                      Stock in {warehouses.find(w => w.id === selectedWarehouse)?.name || 'Selected Warehouse'}
                    </span>
                    <span className={`text-xl font-bold ${(item.stock_locations?.find(l => l.warehouse_id === selectedWarehouse)?.quantity || 0) <= item.min_threshold
                      ? 'text-red-600'
                      : 'text-green-600'
                      }`}>
                      {item.stock_locations?.find(l => l.warehouse_id === selectedWarehouse)?.quantity || 0}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <span className="block text-xs text-gray-500">Total Stock (All)</span>
                    <span className="text-lg font-medium">{item.current_stock}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleUpdateStock} className="border-t pt-6">
                <h4 className="font-medium mb-4">Update Stock</h4>

                <div className="flex space-x-4 mb-4">
                  <button
                    type="button"
                    onClick={() => setActionType('deduction')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${actionType === 'deduction'
                      ? 'bg-red-100 text-red-700 border-2 border-brand-red'
                      : 'bg-gray-100 text-gray-600 border border-transparent'
                      }`}
                  >
                    Take / Use
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('addition')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${actionType === 'addition'
                      ? 'bg-green-100 text-green-700 border-2 border-green-500'
                      : 'bg-gray-100 text-gray-600 border border-transparent'
                      }`}
                  >
                    Add / Return
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Warehouse</label>
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2"
                      value={selectedWarehouse}
                      onChange={(e) => setSelectedWarehouse(e.target.value)}
                    >
                      <option value="">Select Warehouse</option>
                      {item && item.stock_locations && item.stock_locations.length > 0 ? (
                        item.stock_locations.map(loc => (
                          <option key={loc.warehouse_id} value={loc.warehouse_id}>
                            {loc.warehouse_name} (Qty: {loc.quantity})
                          </option>
                        ))
                      ) : (
                        warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red sm:text-sm border p-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reason</label>
                    <input
                      type="text"
                      placeholder={actionType === 'deduction' ? "e.g., Project X, Damaged" : "e.g., New Shipment, Return"}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red sm:text-sm border p-2"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${actionType === 'deduction' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-red`}
                  >
                    {loading ? 'Updating...' : 'Confirm Update'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Scanner;
