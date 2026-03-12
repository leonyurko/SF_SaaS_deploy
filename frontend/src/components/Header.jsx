import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useBulkPrintStore from '../stores/bulkPrintStore';
import api from '../services/api';

const Header = ({ pageTitle, toggleSidebar }) => {
  const { user, logout } = useAuthStore();
  const { items: bulkItems, removeItem: removeBulkItem, clearItems: clearBulk, executePrint } = useBulkPrintStore();
  const navigate = useNavigate();
  const [showBulkDropdown, setShowBulkDropdown] = useState(false);
  const bulkDropdownRef = useRef(null);
  const [notifications, setNotifications] = useState({
    outOfStock: [],
    lowStock: [],
    wearCritical: [],
    wearHigh: []
  });
  const [notificationCount, setNotificationCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (bulkDropdownRef.current && !bulkDropdownRef.current.contains(event.target)) {
        setShowBulkDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const notifs = {
        outOfStock: [],
        lowStock: [],
        wearCritical: [],
        wearHigh: []
      };
      let count = 0;

      // Fetch ALL inventory and filter by actual status on client-side for accuracy
      try {
        const inventoryRes = await api.get('/inventory');
        const allItems = inventoryRes.data?.data?.items || [];

        // Filter by actual status field to ensure accuracy
        const outOfStockItems = allItems.filter(item => item.status === 'Out of Stock');
        const lowStockItems = allItems.filter(item => item.status === 'Low Stock');

        notifs.outOfStock = outOfStockItems.slice(0, 5).map(item => ({
          id: item.id,
          name: item.name,
          stock: item.current_stock,
          location: item.location
        }));

        notifs.lowStock = lowStockItems.slice(0, 5).map(item => ({
          id: item.id,
          name: item.name,
          stock: item.current_stock,
          location: item.location
        }));

        count += outOfStockItems.length + lowStockItems.length;
      } catch (e) {
        console.error('Inventory fetch failed:', e);
      }

      // Fetch wear equipment reports with critical/high severity
      try {
        const wearRes = await api.get('/wear-equipment', { params: { status: 'open' } });
        const wearReports = wearRes.data?.reports || [];

        const criticalReports = wearReports.filter(r => r.severity === 'critical');
        const highReports = wearReports.filter(r => r.severity === 'high');

        if (criticalReports.length > 0) {
          notifs.wearCritical = criticalReports.slice(0, 3).map(r => ({
            id: r.id,
            itemName: r.item_name,
            description: r.description
          }));
          count += criticalReports.length;
        }

        if (highReports.length > 0) {
          notifs.wearHigh = highReports.slice(0, 3).map(r => ({
            id: r.id,
            itemName: r.item_name,
            description: r.description
          }));
          count += highReports.length;
        }
      } catch (e) {
        /* Wear API might not exist */
      }

      setNotifications(notifs);
      setNotificationCount(count);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const hasNotifications = notificationCount > 0;
  const { outOfStock, lowStock, wearCritical, wearHigh } = notifications;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex justify-between items-center px-4 py-4 md:px-6">
        <div className="flex items-center">
          <button
            onClick={toggleSidebar}
            className="mr-4 text-gray-600 hover:text-gray-900 md:hidden focus:outline-none"
          >
            <i className="fas fa-bars text-xl"></i>
          </button>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-800 truncate max-w-[200px] md:max-w-none">
            {pageTitle}
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          {/* Bulk Print Icon */}
          <div className="relative" ref={bulkDropdownRef}>
            <button
              onClick={() => setShowBulkDropdown(prev => !prev)}
              className="p-2 rounded-full hover:bg-gray-100 relative"
              title="Bulk Print Queue"
            >
              <i className="fas fa-print text-gray-600"></i>
              {bulkItems.length > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs font-bold text-white bg-blue-600 rounded-full ring-2 ring-white">
                  {bulkItems.length}
                </span>
              )}
            </button>

            {showBulkDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <i className="fas fa-layer-group text-blue-600"></i> Bulk Print Queue
                  </h3>
                  {bulkItems.length > 0 && (
                    <button onClick={clearBulk} className="text-xs text-red-500 hover:text-red-700">Clear all</button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {bulkItems.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                      <i className="fas fa-print text-3xl mb-2 block"></i>
                      No items in queue
                    </div>
                  ) : (
                    bulkItems.map(item => (
                      <div key={item.id} className="flex items-center px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                        <span className="flex-1 truncate text-sm font-medium text-gray-700">{item.name}</span>
                        <span className="text-xs text-gray-400 font-mono mr-2">{item.barcode}</span>
                        <button onClick={() => removeBulkItem(item.id)} className="text-gray-400 hover:text-red-500 ml-1">
                          <i className="fas fa-times text-xs"></i>
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {bulkItems.length > 0 && (
                  <div className="p-3 border-t border-gray-200">
                    <button
                      onClick={() => { setShowBulkDropdown(false); executePrint(); }}
                      className="w-full py-2 bg-brand-red hover:bg-red-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-print"></i> Print {bulkItems.length} Label{bulkItems.length > 1 ? 's' : ''}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notification Bell */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-2 rounded-full hover:bg-gray-100 relative"
            >
              <i className="fas fa-bell text-gray-600"></i>
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs font-bold text-white bg-brand-red rounded-full ring-2 ring-white">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                  <h3 className="font-semibold text-gray-800">Notifications</h3>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {!hasNotifications ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      <i className="fas fa-check-circle text-3xl mb-2 text-green-500"></i>
                      <p>All caught up! No alerts.</p>
                    </div>
                  ) : (
                    <>
                      {/* Out of Stock Section */}
                      {outOfStock.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center">
                            <i className="fas fa-times-circle text-red-600 mr-2"></i>
                            <span className="font-semibold text-red-800 text-sm">Out of Stock ({outOfStock.length})</span>
                          </div>
                          {outOfStock.map(item => (
                            <Link
                              key={item.id}
                              to={`/inventory?status=Out%20of%20Stock`}
                              onClick={() => setShowDropdown(false)}
                              className="flex items-center px-4 py-2 hover:bg-red-50 border-b border-gray-100 text-sm"
                            >
                              <span className="flex-1 truncate font-medium text-gray-700">{item.name}</span>
                              <span className="text-red-600 text-xs ml-2 bg-red-100 px-2 py-0.5 rounded">0 left</span>
                            </Link>
                          ))}
                        </div>
                      )}

                      {/* Low Stock Section */}
                      {lowStock.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center">
                            <i className="fas fa-exclamation-triangle text-amber-600 mr-2"></i>
                            <span className="font-semibold text-amber-800 text-sm">Low Stock ({lowStock.length})</span>
                          </div>
                          {lowStock.map(item => (
                            <Link
                              key={item.id}
                              to={`/inventory?status=Low%20Stock`}
                              onClick={() => setShowDropdown(false)}
                              className="flex items-center px-4 py-2 hover:bg-amber-50 border-b border-gray-100 text-sm"
                            >
                              <span className="flex-1 truncate font-medium text-gray-700">{item.name}</span>
                              <span className="text-amber-600 text-xs ml-2 bg-amber-100 px-2 py-0.5 rounded">{item.stock} left</span>
                            </Link>
                          ))}
                        </div>
                      )}

                      {/* Wear Equipment - Critical */}
                      {wearCritical.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center">
                            <i className="fas fa-tools text-red-600 mr-2"></i>
                            <span className="font-semibold text-red-800 text-sm">Critical Wear ({wearCritical.length})</span>
                          </div>
                          {wearCritical.map(item => (
                            <Link
                              key={item.id}
                              to="/wear-equipment"
                              onClick={() => setShowDropdown(false)}
                              className="flex items-center px-4 py-2 hover:bg-red-50 border-b border-gray-100 text-sm"
                            >
                              <span className="flex-1 truncate font-medium text-gray-700">{item.itemName}</span>
                              <span className="text-red-600 text-xs ml-2 bg-red-100 px-2 py-0.5 rounded">Critical</span>
                            </Link>
                          ))}
                        </div>
                      )}

                      {/* Wear Equipment - High Priority */}
                      {wearHigh.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-orange-50 border-b border-orange-100 flex items-center">
                            <i className="fas fa-tools text-orange-600 mr-2"></i>
                            <span className="font-semibold text-orange-800 text-sm">High Priority Wear ({wearHigh.length})</span>
                          </div>
                          {wearHigh.map(item => (
                            <Link
                              key={item.id}
                              to="/wear-equipment"
                              onClick={() => setShowDropdown(false)}
                              className="flex items-center px-4 py-2 hover:bg-orange-50 border-b border-gray-100 text-sm"
                            >
                              <span className="flex-1 truncate font-medium text-gray-700">{item.itemName}</span>
                              <span className="text-orange-600 text-xs ml-2 bg-orange-100 px-2 py-0.5 rounded">High</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-brand-red to-red-400 flex items-center justify-center text-white font-semibold shadow-md">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-gray-700 font-medium text-sm">{user?.username}</span>
              <span className="text-gray-500 text-xs">{user?.role}</span>
            </div>
            <button
              onClick={handleLogout}
              className="ml-2 text-gray-600 hover:text-gray-800"
              title="Logout"
            >
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
