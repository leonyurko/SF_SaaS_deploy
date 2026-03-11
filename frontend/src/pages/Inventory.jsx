import { useState, useEffect } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { fetchInventory, createInventory, updateInventory, deleteInventory } from '../services/inventoryService';
import { getAllWarehouses, createWarehouse, updateWarehouse, deleteWarehouse as apiDeleteWarehouse } from '../services/warehouseService';
import { getStoredUser } from '../services/authService';
import api from '../services/api';
import categoryService from '../services/categoryService';

const Inventory = () => {
  const { setPageTitle } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');

  // Advanced Search State
  const [warehouseFilter, setWarehouseFilter] = useState(searchParams.get('warehouse') || '');
  const [locationFilter, setLocationFilter] = useState(''); // Replaces Shelf/Col
  const [partNumberFilter, setPartNumberFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // Warehouse Management State (Admin Only)
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouseName, setWarehouseName] = useState('');
  const [editingWarehouse, setEditingWarehouse] = useState(null); // id or null

  // Category Management State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryMode, setCategoryMode] = useState('list'); // list, create, edit
  const [selectedParentCategory, setSelectedParentCategory] = useState(null); // for creating subcategory
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', parentId: '' });


  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    subCategoryId: '',
    quantity: 0,
    warehouseId: '', // Replaces 'location' (warehouse name)
    location: '',    // Replaces 'shelf', 'shelfColumn' - Free text
    minQuantity: 5,
    images: [],
    additionalLocations: [],
    locationDetails: ''
  });

  // Gallery modal state
  const [galleryItem, setGalleryItem] = useState(null);
  const [showGallery, setShowGallery] = useState(false);

  useEffect(() => {
    setPageTitle('Inventory');
    const user = getStoredUser();
    setCurrentUser(user);
    loadWarehouses();
    loadCategories();
  }, [setPageTitle]);

  useEffect(() => {
    loadInventory();
  }, [search, statusFilter, warehouseFilter, locationFilter, partNumberFilter]);

  const loadWarehouses = async () => {
    try {
      const data = await getAllWarehouses();
      setWarehouses(data);
    } catch (err) {
      console.error('Failed to load warehouses', err);
    }
  };

  const loadInventory = async () => {
    try {
      setLoading(true);
      const data = await fetchInventory({
        search,
        status: statusFilter,
        warehouse: warehouseFilter, // Sends ID or Name depending on what user selects/API expects. API now joins.
        location: locationFilter,   // Sends free text location search
        partNumber: partNumberFilter
      });
      setInventory(data.items);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilterChange = (e) => {
    const value = e.target.value;
    setStatusFilter(value);
    if (value) {
      setSearchParams(prev => { prev.set('status', value); return prev; });
    } else {
      setSearchParams(prev => { prev.delete('status'); return prev; });
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      if (response.data.status === 'success') {
        setCategories(response.data.data.categories);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const parentCategories = categories.filter(c => !c.parent_id);
  const subCategories = categories.filter(c => c.parent_id === formData.categoryId);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      // Reset subcategory if category changes
      if (name === 'categoryId') {
        newData.subCategoryId = '';
      }
      return newData;
    });
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 5); // Max 5 images
    setFormData(prev => ({ ...prev, images: files }));
  };

  // Dynamic Location Helpers (Updated for new schema)
  const addLocation = () => {
    setFormData(prev => ({
      ...prev,
      additionalLocations: [...prev.additionalLocations, {
        warehouseId: '',
        location: '' // Free text
      }]
    }));
  };

  const removeLocation = (index) => {
    setFormData(prev => ({
      ...prev,
      additionalLocations: prev.additionalLocations.filter((_, i) => i !== index)
    }));
  };

  const handleLocationChange = (index, field, value) => {
    setFormData(prev => {
      const newLocations = [...prev.additionalLocations];
      newLocations[index] = { ...newLocations[index], [field]: value };
      return { ...prev, additionalLocations: newLocations };
    });
  };

  const resetForm = () => {
    setFormData({
      name: '', description: '', categoryId: '', subCategoryId: '',
      quantity: 0, warehouseId: '', location: '', minQuantity: 5, images: [], additionalLocations: [], locationDetails: ''
    });
    setIsEditing(false);
    setCurrentId(null);
  };

  const handleEdit = (item) => {
    const locations = item.stock_locations || [];
    const primary = locations[0] || {};
    const extras = locations.slice(1) || [];

    setFormData({
      name: item.name,
      description: item.description || '',
      categoryId: item.category_id || '',
      subCategoryId: item.sub_category_id || '',
      quantity: primary.quantity !== undefined ? primary.quantity : item.current_stock, // Use primary location quantity
      warehouseId: primary.warehouse_id || item.warehouse_id || '',
      location: primary.location || item.location || '',
      minQuantity: item.min_threshold,
      images: [],
      additionalLocations: extras.map(l => ({
        warehouseId: l.warehouse_id,
        location: l.location,
        quantity: l.quantity
      })),
      locationDetails: item.location_details || ''
    });
    setCurrentId(item.id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteInventory(id);
      loadInventory();
    } catch (err) {
      alert('Failed to delete item');
    }
  };

  const handleExport = () => {
    if (inventory.length === 0) {
      alert('No items to export');
      return;
    }

    // Sort warehouses alphabetically for consistent column order
    const sortedWarehouses = [...warehouses].sort((a, b) => a.name.localeCompare(b.name));
    const warehouseHeaders = sortedWarehouses.map(w => w.name);

    const headers = [
      'Name',
      'Category',
      'Sub Category',
      ...warehouseHeaders,
      'Total Stock',
      'Min Threshold',
      'Status',
      'Description',
      'Barcode'
    ];

    const csvContent = [
      headers.join(','),
      ...inventory.map(item => {
        // Create a map of warehouseId -> {location, quantity} for quick lookup
        const locMap = {};
        if (item.stock_locations && item.stock_locations.length > 0) {
          item.stock_locations.forEach(l => {
            if (l.warehouse_id) locMap[l.warehouse_id] = l;
          });
        } else if (item.warehouse_id) {
          // Fallback for legacy items without stock_locations populated
          locMap[item.warehouse_id] = { location: item.location, quantity: item.current_stock };
        }

        // Generate columns for each warehouse
        const warehouseColumns = sortedWarehouses.map(w => {
          const data = locMap[w.id];
          if (data) {
            // Format: "Location: xxxx - Qty: 99"
            // Escape quotes inside the string just in case
            const loc = (data.location || 'No Loc').replace(/"/g, '""');
            return `"${loc} - Qty: ${data.quantity}"`;
          }
          return '""'; // Empty cell if no stock in this warehouse
        });

        return [
          `"${(item.name || '').replace(/"/g, '""')}"`,
          `"${(item.category_name || '').replace(/"/g, '""')}"`,
          `"${(item.sub_category_name || '').replace(/"/g, '""')}"`,
          ...warehouseColumns,
          item.current_stock,
          item.min_threshold,
          item.status,
          // Force Excel to treat as text using ="value" syntax to prevent scientific notation
          `"=""${(item.description || '').replace(/"/g, '""')}"""`,
          `"=""${(item.barcode || '').replace(/"/g, '""')}"""`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('description', formData.description);
      if (formData.categoryId) data.append('categoryId', formData.categoryId);
      if (formData.subCategoryId) data.append('subCategoryId', formData.subCategoryId);

      if (formData.warehouseId) data.append('warehouseId', formData.warehouseId);

      // Send single location field string
      data.append('location', formData.location);

      data.append('minThreshold', formData.minQuantity);
      data.append('locationDetails', formData.locationDetails);

      if (formData.additionalLocations.length > 0) {
        data.append('additionalLocations', JSON.stringify(formData.additionalLocations));
      }

      if (formData.images && formData.images.length > 0) {
        formData.images.forEach(img => {
          data.append('images', img);
        });
      }

      if (isEditing) {
        await updateInventory(currentId, data);
        alert('Item updated successfully');
      } else {
        data.append('currentStock', formData.quantity);
        await createInventory(data);
        alert('Item added successfully');
      }

      setShowModal(false);
      resetForm();
      loadInventory();
    } catch (err) {
      console.error(err);
      alert('Failed to save item');
    }
  };

  const openGallery = (item) => {
    setGalleryItem(item);
    setShowGallery(true);
  };

  // --- Warehouse Management Handlers ---

  const handleWarehouseSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse, warehouseName);
        alert('Warehouse updated');
      } else {
        await createWarehouse(warehouseName);
        alert('Warehouse created');
      }
      setWarehouseName('');
      setEditingWarehouse(null);
      setShowWarehouseModal(false);
      loadWarehouses();
    } catch (err) {
      alert(err);
    }
  };

  const handleEditWarehouse = (w) => {
    setWarehouseName(w.name);
    setEditingWarehouse(w.id);
    setShowWarehouseModal(true);
  };

  const handleDeleteWarehouse = async (id) => {
    if (!window.confirm('Delete this warehouse? This might affect items linked to it.')) return;
    try {
      await apiDeleteWarehouse(id);
      loadWarehouses();
    } catch (err) {
      alert(err);
    }
  };


  const printItem = (item) => {
    const barcodeUrl = item.barcode_image_url
      ? (item.barcode_image_url.startsWith('http')
          ? item.barcode_image_url
          : window.location.origin + item.barcode_image_url)
      : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Print Barcode: ${item.barcode}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 24px; display: flex; justify-content: center; }
    .wrap { width: 100%; max-width: 480px; }
    h2 { font-size: 18px; color: #111; margin-bottom: 20px; }
    .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 6px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .row { display: flex; gap: 12px; align-items: flex-end; }
    .grp { flex: 1; }
    .grp label { display: block; font-size: 12px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .grp input { width: 100%; padding: 9px 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 15px; }
    .grp input:focus { outline: none; border-color: #000; }
    .toggle { display: flex; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; }
    .toggle button { flex: 1; padding: 9px 0; border: none; cursor: pointer; font-size: 14px; font-weight: 700; }
    .preview { text-align: center; }
    .preview-label { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    .preview img { display: block; margin: 0 auto; height: auto; max-width: 100%; }
    .barcode-num { font-weight: bold; margin-top: 12px; font-size: 15px; letter-spacing: 2px; color: #222; }
    .print-btn { width: 100%; padding: 13px; border: none; border-radius: 6px; font-size: 15px; font-weight: 700; cursor: pointer; }
    .print-only { display: none; }
    @media print {
      @page { size: 62mm auto; margin: 2mm; }
      body { background: white; padding: 0; }
      .wrap { display: none; }
      .print-only { display: block; text-align: center; }
      .print-only img { display: block; margin: 0 auto; height: auto; }
      .print-only .barcode-num { font-family: Arial, sans-serif; font-weight: bold; margin-top: 10px; font-size: 16px; letter-spacing: 2px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h2>Print Barcode Label</h2>
    <div class="card">
      <div class="row">
        <div class="grp">
          <label>Width</label>
          <input type="number" id="bw" value="58" min="1" max="200" step="0.5" oninput="upd()" />
        </div>
        <div class="grp">
          <label>Height</label>
          <input type="number" id="bh" min="1" max="200" step="0.5" placeholder="Auto" oninput="upd()" />
        </div>
        <div class="grp">
          <label>Unit</label>
          <div class="toggle">
            <button id="bcm" onclick="su('cm')" style="background:white;color:#888;">cm</button>
            <button id="bmm" onclick="su('mm')" style="background:#111;color:white;">mm</button>
          </div>
        </div>
      </div>
    </div>
    <div class="card preview">
      <div class="preview-label">Preview</div>
      <img id="pi" src="${barcodeUrl}" alt="Barcode" style="width:58mm;" />
      <div class="barcode-num">${item.barcode}</div>
    </div>
    <button id="pb" class="print-btn" disabled style="background:#ccc;color:white;cursor:not-allowed;">Loading...</button>
  </div>
  <div class="print-only">
    <img id="pri" src="${barcodeUrl}" alt="Barcode" style="width:58mm;height:auto;" />
    <div class="barcode-num">${item.barcode}</div>
  </div>
  <script>
    var u = 'mm';
    function su(v) {
      u = v;
      document.getElementById('bcm').style.background = v==='cm'?'#111':'white';
      document.getElementById('bcm').style.color = v==='cm'?'white':'#888';
      document.getElementById('bmm').style.background = v==='mm'?'#111':'white';
      document.getElementById('bmm').style.color = v==='mm'?'white':'#888';
      upd();
    }
    function upd() {
      var w = parseFloat(document.getElementById('bw').value);
      var hv = document.getElementById('bh').value;
      var h = parseFloat(hv);
      ['pi','pri'].forEach(function(id) {
        var el = document.getElementById(id);
        if (!isNaN(w) && w > 0) el.style.width = w + u;
        el.style.height = (!isNaN(h) && h > 0) ? h + u : 'auto';
      });
    }
    var pri = document.getElementById('pri');
    var pb = document.getElementById('pb');
    function rdy() { pb.disabled=false; pb.style.background='#111'; pb.style.cursor='pointer'; pb.textContent='Print Barcode'; pb.onclick=function(){ window.print(); }; }
    if (pri.complete && pri.naturalWidth > 0) { rdy(); } else { pri.onload=rdy; pri.onerror=rdy; }
  </script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (win) {
      win.addEventListener('load', () => URL.revokeObjectURL(blobUrl));
    } else {
      URL.revokeObjectURL(blobUrl);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'In Stock': return 'bg-green-100 text-green-800';
      case 'Low Stock': return 'bg-yellow-100 text-yellow-800';
      case 'Out of Stock': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Inventory Management</h1>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {currentUser?.role === 'Admin' && (
            <>
              <button
                onClick={() => { setWarehouseName(''); setEditingWarehouse(null); setShowWarehouseModal(true); }}
                className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 flex items-center text-sm flex-1 md:flex-none justify-center"
              >
                <i className="fas fa-warehouse mr-2"></i> New Warehouse
              </button>
              <button
                onClick={() => {
                  setCategoryMode('list');
                  setCategoryForm({ name: '', description: '', parentId: '' });
                  setShowCategoryModal(true);
                }}
                className="bg-purple-600 text-white px-3 py-2 rounded-md hover:bg-purple-700 flex items-center text-sm flex-1 md:flex-none justify-center"
              >
                <i className="fas fa-tags mr-2"></i> Categories
              </button>
            </>
          )}

          <button
            onClick={handleExport}
            className="bg-gray-800 text-white px-3 py-2 rounded-md hover:bg-black flex items-center text-sm flex-1 md:flex-none justify-center"
          >
            <i className="fas fa-file-csv mr-2"></i> Export
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-brand-red text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center text-sm flex-1 md:flex-none justify-center"
          >
            <i className="fas fa-plus mr-2"></i> Add Item
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search inventory..."
            className="rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
            value={statusFilter}
            onChange={handleStatusFilterChange}
          >
            <option value="">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
          <select
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
          >
            <option value="">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Location..."
            className="rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Image</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barcode</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warehouse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inventory.map((item) => {
                  const images = item.image_urls || [];
                  const hasMultipleImages = images.length > 1;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        {item.image_url || images.length > 0 ? (
                          <div className="relative">
                            <img
                              src={images[0] || item.image_url}
                              alt={item.name}
                              className="h-10 w-10 object-cover rounded cursor-pointer hover:ring-2 hover:ring-brand-red"
                              onClick={() => openGallery(item)}
                            />
                            {hasMultipleImages && (
                              <span className="absolute -top-1 -right-1 bg-brand-red text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                {images.length}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                            <i className="fas fa-image"></i>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.category_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        {item.barcode_image_url ? (
                          <img
                            src={item.barcode_image_url}
                            alt="Barcode"
                            className="h-8 w-auto cursor-pointer hover:ring-2 hover:ring-brand-red"
                            onClick={() => window.open(item.barcode_image_url, '_blank')}
                          />
                        ) : (
                          <span className="font-mono text-sm">{item.barcode}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {item.stock_locations && item.stock_locations.length > 0 ? (
                          item.stock_locations.map((loc, i) => (
                            <div key={i} className="border-b last:border-0 py-1 border-gray-100 h-8 flex items-center">{loc.warehouse_name}</div>
                          ))
                        ) : (
                          <div className="h-8 flex items-center">{item.warehouse_name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {item.stock_locations && item.stock_locations.length > 0 ? (
                          item.stock_locations.map((loc, i) => (
                            <div key={i} className="border-b last:border-0 py-1 border-gray-100 h-8 flex items-center justify-between">
                              <span>{loc.location}</span>
                              {loc.quantity !== undefined && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-1 rounded ml-2">Qty: {loc.quantity}</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="h-8 flex items-center">{item.location}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold">{item.current_stock}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => navigate(`/wear-equipment?itemId=${item.id}&itemName=${encodeURIComponent(item.name)}`)} className="text-amber-600 hover:text-amber-900" title="Report Wear">
                          <i className="fas fa-tools"></i>
                        </button>
                        <button onClick={() => printItem(item)} className="text-gray-600 hover:text-gray-900" title="Print">
                          <i className="fas fa-print"></i>
                        </button>
                        {currentUser?.role === 'Admin' && (
                          <>
                            <button onClick={() => handleEdit(item)} className="text-brand-red hover:text-red-800" title="Edit">
                              <i className="fas fa-edit"></i>
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900" title="Delete">
                              <i className="fas fa-trash"></i>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {inventory.map((item) => {
              const images = item.image_urls || [];
              const hasMultipleImages = images.length > 1;
              return (
                <div key={item.id} className="bg-white p-4 rounded-lg shadow border border-gray-100">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      {item.image_url || images.length > 0 ? (
                        <div className="relative">
                          <img
                            src={images[0] || item.image_url}
                            alt={item.name}
                            className="h-20 w-20 object-cover rounded cursor-pointer"
                            onClick={() => openGallery(item)}
                          />
                          {hasMultipleImages && (
                            <span className="absolute -top-1 -right-1 bg-brand-red text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                              {images.length}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="h-20 w-20 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                          <i className="fas fa-image text-2xl"></i>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
                          <p className="text-xs text-gray-500">{item.category_name}</p>
                        </div>
                        <span className="font-mono text-lg font-bold text-gray-900">{item.current_stock}</span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <i className="fas fa-barcode text-xs w-4"></i>
                          <span className="truncate">{item.barcode}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <i className="fas fa-warehouse text-xs w-4"></i>
                          <span className="truncate">{item.warehouse_name} / {item.location}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stock Locations Details if Multiple */}
                  {item.stock_locations && item.stock_locations.length > 1 && (
                    <div className="mt-3 text-xs bg-gray-50 p-2 rounded">
                      <span className="font-medium text-gray-500">Other Locations:</span>
                      {item.stock_locations.slice(1).map((loc, i) => (
                        <div key={i} className="flex justify-between mt-1">
                          <span>{loc.warehouse_name} - {loc.location}</span>
                          <span className="font-mono">Qty: {loc.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex justify-end gap-3 border-t pt-3">
                    <button onClick={() => navigate(`/wear-equipment?itemId=${item.id}&itemName=${encodeURIComponent(item.name)}`)} className="text-amber-600 p-2" title="Report Wear">
                      <i className="fas fa-tools"></i>
                    </button>
                    <button onClick={() => printItem(item)} className="text-gray-600 p-2" title="Print">
                      <i className="fas fa-print"></i>
                    </button>
                    {currentUser?.role === 'Admin' && (
                      <>
                        <button onClick={() => handleEdit(item)} className="text-brand-red p-2" title="Edit">
                          <i className="fas fa-edit"></i>
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-red-600 p-2" title="Delete">
                          <i className="fas fa-trash"></i>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {isEditing ? 'Edit Inventory Item' : 'Add New Inventory Item'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2"
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  name="description"
                  rows="2"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2"
                  value={formData.description}
                  onChange={handleInputChange}
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <select
                    name="categoryId"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2"
                    value={formData.categoryId}
                    onChange={handleInputChange}
                  >
                    <option value="">Select Category</option>
                    {parentCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sub Category</label>
                  <select
                    name="subCategoryId"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                    value={formData.subCategoryId}
                    onChange={handleInputChange}
                    disabled={!formData.categoryId || subCategories.length === 0}
                  >
                    <option value="">Select Sub Category</option>
                    {subCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Warehouse</label>
                  <select
                    name="warehouseId"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2"
                    value={formData.warehouseId}
                    onChange={handleInputChange}
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Location (Row/Shelf/Col)</label>
                  <input
                    type="text"
                    name="location"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g. A1 - Bin 5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Location Details</label>
                <input
                  type="text"
                  name="locationDetails"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2"
                  value={formData.locationDetails}
                  onChange={handleInputChange}
                  placeholder="e.g. Near the entrance"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Current Stock {isEditing ? '(Read Only)' : ''}
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    readOnly={isEditing}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 ${isEditing ? 'bg-gray-100' : 'focus:border-brand-red focus:ring-brand-red'}`}
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Min Threshold</label>
                  <input
                    type="number"
                    name="minQuantity"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2"
                    value={formData.minQuantity}
                    onChange={handleInputChange} // Fix: was mapping to name 'quantity' by default if not careful, but name is 'minQuantity' on input so it works
                    min="0"
                  />
                </div>
              </div>

              {/* Additional Locations - Simplified */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Additional Locations</label>
                  <button type="button" onClick={addLocation} className="text-sm text-brand-red hover:text-red-700">
                    + Add Location
                  </button>
                </div>
                {formData.additionalLocations.map((loc, index) => (
                  <div key={index} className="flex gap-2 mb-2 items-center">
                    <select
                      className="w-1/3 rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2"
                      value={loc.warehouseId}
                      onChange={(e) => handleLocationChange(index, 'warehouseId', e.target.value)}
                    >
                      <option value="">Select Warehouse</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Location"
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2 text-sm"
                      value={loc.location}
                      onChange={(e) => handleLocationChange(index, 'location', e.target.value)}
                    />
                    {/* Allow setting quantity for additional locations too? Not explicitly requested but logical. 
                        However, pure 'quantity' update is usually done via transactions. 
                        Let's just show location editing for now to avoid complex stock reconciliation logic in the Edit Form.
                        Or maybe just a quantity display/edit?
                        If I add quantity here, backend createInventory/updateInventory needs to handle it.
                        Current backend updateInventory doesn't sync quantities from additionalLocations.
                        So I'll leave quantity OUT of additional locations input for now to avoid data mismatch. 
                        User should use "Scanner" or "Stock Update" to change quantities.
                     */}
                    <button type="button" onClick={() => removeLocation(index)} className="text-red-500 hover:text-red-700">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Images (up to 5)</label>
                <div className="mt-1 flex items-center">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-brand-red hover:file:bg-blue-100"
                  />
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  {formData.images.length > 0 ? `${formData.images.length} file(s) chosen` : 'No file chosen'}
                </div>
                {/* Show existing images if editing */}
                {isEditing && currentId && inventory.find(i => i.id === currentId)?.image_urls?.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    {inventory.find(i => i.id === currentId).image_urls.map((url, idx) => (
                      <div key={idx} className="relative">
                        <img src={url} className="h-16 w-16 object-cover rounded" />
                        <button type="button" onClick={() => handleDeleteImage(currentId, url)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs">x</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-red text-white rounded-md hover:bg-red-700"
                >
                  {isEditing ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Warehouse Modal (Admin Only) */}
      {showWarehouseModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">{editingWarehouse ? 'Edit Warehouse' : 'New Warehouse'}</h3>

            {/* List of Warehouses for quick edit/delete if specifically managing warehouses */}
            {!editingWarehouse && (
              <div className="mb-4 max-h-40 overflow-y-auto border p-2 rounded">
                {warehouses.map(w => (
                  <div key={w.id} className="flex justify-between items-center py-1 border-b last:border-0">
                    <span>{w.name}</span>
                    <div>
                      <button onClick={() => handleEditWarehouse(w)} className="text-blue-600 mr-2"><i className="fas fa-edit"></i></button>
                      <button onClick={() => handleDeleteWarehouse(w.id)} className="text-red-600"><i className="fas fa-trash"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleWarehouseSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Warehouse Name</label>
                <input
                  type="text"
                  required
                  className="w-full border p-2 rounded"
                  value={warehouseName}
                  onChange={(e) => setWarehouseName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowWarehouseModal(false)} className="px-4 py-2 border rounded">Close</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">{editingWarehouse ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                {categoryMode === 'list' ? 'Manage Categories' :
                  categoryMode === 'create' ? (categoryForm.parentId ? 'New Subcategory' : 'New Category') :
                    'Edit Category'}
              </h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {categoryMode === 'list' ? (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      onClick={() => { setCategoryMode('create'); setCategoryForm({ name: '', description: '', parentId: '' }); }}
                      className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                    >
                      + New Parent Category
                    </button>
                  </div>
                  <div className="border rounded-md divided-y">
                    {parentCategories.map(parent => (
                      <div key={parent.id} className="p-3 border-b last:border-0 bg-gray-50">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-semibold">{parent.name}</span>
                            {parent.description && <p className="text-xs text-gray-500">{parent.description}</p>}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setCategoryMode('create');
                                setCategoryForm({ name: '', description: '', parentId: parent.id });
                                setSelectedParentCategory(parent);
                              }}
                              className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                            >
                              + Sub
                            </button>
                            <button
                              onClick={() => {
                                setCategoryMode('edit');
                                setEditingCategory(parent);
                                setCategoryForm({ name: parent.name, description: parent.description, parentId: '' });
                              }}
                              className="text-blue-600"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button onClick={async () => {
                              if (window.confirm('Delete category?')) {
                                try { await categoryService.deleteCategory(parent.id); loadCategories(); } catch (e) { alert(e.message); }
                              }
                            }} className="text-red-600">
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </div>
                        {/* Subcategories */}
                        <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray-200 pl-2">
                          {categories.filter(c => c.parent_id === parent.id).map(sub => (
                            <div key={sub.id} className="flex justify-between items-center text-sm p-1 hover:bg-gray-100 rounded">
                              <span>{sub.name}</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setCategoryMode('edit');
                                    setEditingCategory(sub);
                                    setCategoryForm({ name: sub.name, description: sub.description, parentId: sub.parent_id });
                                  }}
                                  className="text-blue-600"
                                >
                                  <i className="fas fa-edit"></i>
                                </button>
                                <button onClick={async () => {
                                  if (window.confirm('Delete subcategory?')) {
                                    try { await categoryService.deleteCategory(sub.id); loadCategories(); } catch (e) { alert(e.message); }
                                  }
                                }} className="text-red-600">
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            </div>
                          ))}
                          {categories.filter(c => c.parent_id === parent.id).length === 0 && (
                            <div className="text-xs text-gray-400 italic">No subcategories</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    if (categoryMode === 'create') {
                      await categoryService.createCategory(categoryForm);
                      alert('Category created');
                    } else {
                      await categoryService.updateCategory(editingCategory.id, categoryForm);
                      alert('Category updated');
                    }
                    loadCategories();
                    setCategoryMode('list');
                  } catch (err) {
                    alert('Failed to save category: ' + (err.response?.data?.message || err.message));
                  }
                }}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full border rounded p-2"
                        value={categoryForm.name}
                        onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        className="mt-1 block w-full border rounded p-2"
                        value={categoryForm.description}
                        onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      />
                    </div>
                    {categoryForm.parentId && (
                      <div className="text-sm text-gray-500">
                        Parent Category ID: {categoryForm.parentId}
                      </div>
                    )}
                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => setCategoryMode('list')}
                        className="px-4 py-2 border rounded"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gallery Modal */}
      {showGallery && galleryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75" onClick={() => setShowGallery(false)}>
          <div className="relative bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowGallery(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 z-10 bg-white rounded-full p-2">
              <i className="fas fa-times text-xl"></i>
            </button>
            <div className="p-4 overflow-y-auto max-h-[85vh]">
              <h2 className="text-2xl font-bold mb-4">{galleryItem.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(galleryItem.image_urls || [galleryItem.image_url]).filter(Boolean).map((img, idx) => (
                  <img key={idx} src={img} alt={`${galleryItem.name} - ${idx + 1}`} className="w-full h-auto object-contain bg-gray-100 rounded" />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Inventory;
