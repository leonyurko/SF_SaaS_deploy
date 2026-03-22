import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';

const SAMPLE_VARS = {
  userName: 'John Doe',
  companyName: 'Your Company',
  supplierName: 'Example Supplier',
  contactPerson: 'Jane Smith',
  itemName: 'Sample Item',
  quantity: '5',
  notes: 'Sample notes text'
};

const processTemplate = (text, vars) => {
  let result = text;
  Object.entries(vars).forEach(([key, val]) => {
    result = result.split(`{${key}}`).join(val);
  });
  return result;
};

const EmailFormats = () => {
  const { setPageTitle } = useOutletContext();
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [expandedBodies, setExpandedBodies] = useState(new Set());
  const [previewFormat, setPreviewFormat] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [testingId, setTestingId] = useState(null);

  const [formData, setFormData] = useState({ name: '', subject: '', body: '' });

  useEffect(() => {
    setPageTitle('Email Format Structure');
    loadFormats();
  }, [setPageTitle]);

  const loadFormats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/email-formats');
      if (response.data.status === 'success') {
        setFormats(response.data.data.formats);
      }
    } catch (err) {
      console.error('Failed to load formats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({ name: '', subject: '', body: '' });
    setIsEditing(false);
    setCurrentId(null);
  };

  const handleEdit = (format) => {
    setFormData({ name: format.name, subject: format.subject, body: format.body });
    setCurrentId(format.id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/email-formats/${id}`);
      setConfirmDeleteId(null);
      loadFormats();
    } catch (err) {
      alert('Failed to delete format');
    }
  };

  const handleTestEmail = async (id) => {
    setTestingId(id);
    try {
      const res = await api.post(`/email-formats/${id}/test`);
      alert(res.data.message || 'Test email sent!');
    } catch (err) {
      alert('Failed to send test email: ' + (err.response?.data?.message || err.message));
    } finally {
      setTestingId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await api.put(`/email-formats/${currentId}`, formData);
        alert('Format updated successfully');
      } else {
        await api.post('/email-formats', formData);
        alert('Format created successfully');
      }
      setShowModal(false);
      resetForm();
      loadFormats();
    } catch (err) {
      console.error(err);
      alert('Failed to save format');
    }
  };

  const insertVariable = (variable) => {
    const textarea = document.querySelector('textarea[name="body"]');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = formData.body.substring(0, start) + variable + formData.body.substring(end);
      setFormData(prev => ({ ...prev, body: newText }));
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();
      }, 0);
    }
  };

  const toggleBody = (id) => {
    setExpandedBodies(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const variables = [
    { name: 'User Name', value: '{userName}' },
    { name: 'Company Name', value: '{companyName}' },
    { name: 'Supplier Name', value: '{supplierName}' },
    { name: 'Contact Person', value: '{contactPerson}' },
    { name: 'Item Name', value: '{itemName}' },
    { name: 'Quantity', value: '{quantity}' },
    { name: 'Notes', value: '{notes}' }
  ];

  return (
    <div>
      <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <i className="fas fa-info-circle text-blue-500"></i>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Available Variables</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>Use these variables in your email templates. They will be replaced with actual values when sending:</p>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                {variables.map(v => (
                  <code key={v.value} className="bg-blue-100 px-2 py-1 rounded text-xs">{v.value}</code>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Email Templates</h2>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="px-4 py-2 bg-brand-red text-white rounded-lg hover:bg-red-700 flex items-center"
        >
          <i className="fas fa-plus mr-2"></i> Add Format
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {formats.map((format) => {
            const isExpanded = expandedBodies.has(format.id);
            const isConfirmingDelete = confirmDeleteId === format.id;
            const bodyText = isExpanded
              ? format.body
              : format.body.substring(0, 200) + (format.body.length > 200 ? '...' : '');

            return (
              <div key={format.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{format.name}</h3>
                    <span className="text-xs text-gray-500">Created by {format.created_by_user || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => handleTestEmail(format.id)}
                      disabled={testingId === format.id}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded border border-gray-300 flex items-center gap-1 disabled:opacity-50"
                      title="Send test email to your account"
                    >
                      <i className="fas fa-paper-plane text-xs"></i>
                      {testingId === format.id ? 'Sending...' : 'Test'}
                    </button>
                    <button
                      onClick={() => setPreviewFormat(format)}
                      className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-200 flex items-center gap-1"
                      title="Preview with sample values"
                    >
                      <i className="fas fa-eye text-xs"></i> Preview
                    </button>
                    <button
                      onClick={() => handleEdit(format)}
                      className="text-brand-red hover:text-red-900"
                      title="Edit"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    {isConfirmingDelete ? (
                      <span className="flex items-center gap-1 text-xs">
                        <span className="text-gray-600">Sure?</span>
                        <button
                          onClick={() => handleDelete(format.id)}
                          className="px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                        >Yes</button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >No</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(format.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Subject:</label>
                    <p className="text-sm font-medium text-gray-700" dir="rtl" style={{ textAlign: 'right' }}>{format.subject}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Body Preview:</label>
                    <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap border" dir="rtl" style={{ textAlign: 'right' }}>
                      {bodyText}
                    </div>
                    {format.body.length > 200 && (
                      <button
                        onClick={() => toggleBody(format.id)}
                        className="mt-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        {isExpanded ? 'Show less ↑' : 'Show more ↓'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {formats.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <i className="fas fa-envelope text-gray-300 text-5xl mb-4"></i>
              <p className="text-gray-500">No email formats created yet. Click "Add Format" to create one.</p>
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewFormat && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Preview — {previewFormat.name}</h3>
              <button onClick={() => setPreviewFormat(null)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Variables replaced with sample values</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Subject</label>
                <div className="bg-gray-50 border rounded p-3 text-sm font-medium" dir="rtl" style={{ textAlign: 'right' }}>
                  {processTemplate(previewFormat.subject, SAMPLE_VARS)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Body</label>
                <div className="bg-gray-50 border rounded p-4 text-sm whitespace-pre-wrap" dir="rtl" style={{ textAlign: 'right' }}>
                  {processTemplate(previewFormat.body, SAMPLE_VARS)}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setPreviewFormat(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Format Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {isEditing ? 'Edit Email Format' : 'Create Email Format'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Format Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g., Standard Order Request"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email Subject *</label>
                <input
                  type="text"
                  name="subject"
                  required
                  dir="rtl"
                  placeholder="בקשת הזמנה מ-{companyName}"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2 text-right"
                  value={formData.subject}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Email Body *</label>
                  <div className="text-xs text-gray-500">Insert variables:</div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {variables.map(v => (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => insertVariable(v.value)}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-xs rounded border"
                      title={`Insert ${v.name}`}
                    >
                      {v.value}
                    </button>
                  ))}
                </div>
                <textarea
                  name="body"
                  required
                  rows="12"
                  dir="rtl"
                  placeholder={`שלום,\n\nאני {userName} מ-{companyName}. ברצוננו להזמין {quantity} יחידות של {itemName}.\n\n{notes}\n\nבברכה`}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2 text-sm text-right"
                  value={formData.body}
                  onChange={handleInputChange}
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
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
                  {isEditing ? 'Update Format' : 'Create Format'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailFormats;
