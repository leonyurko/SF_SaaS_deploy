import { useState, useEffect, useRef, useCallback } from 'react';
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

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ToastContainer = ({ toasts, removeToast }) => (
  <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
    {toasts.map(t => (
      <div
        key={t.id}
        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}
      >
        <i className={`fas ${t.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
        <span>{t.message}</span>
        <button onClick={() => removeToast(t.id)} className="ml-2 opacity-70 hover:opacity-100">
          <i className="fas fa-times text-xs"></i>
        </button>
      </div>
    ))}
  </div>
);

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
  const [modalTab, setModalTab] = useState('edit');
  const [subjectDir, setSubjectDir] = useState('rtl');
  const [bodyDir, setBodyDir] = useState('rtl');
  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedVar, setCopiedVar] = useState(null);
  const [toasts, setToasts] = useState([]);
  const textareaRef = useRef(null);
  const toastIdRef = useRef(0);

  const [formData, setFormData] = useState({ name: '', subject: '', body: '' });

  useEffect(() => {
    setPageTitle('Email Format Structure');
    loadFormats();
  }, [setPageTitle]);

  const showToast = useCallback((message, type = 'success') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

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
    setModalTab('edit');
    setSubjectDir('rtl');
    setBodyDir('rtl');
  };

  const handleEdit = (format) => {
    setFormData({ name: format.name, subject: format.subject, body: format.body });
    setCurrentId(format.id);
    setIsEditing(true);
    setModalTab('edit');
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/email-formats/${id}`);
      setConfirmDeleteId(null);
      loadFormats();
      showToast('Format deleted');
    } catch (err) {
      showToast('Failed to delete format', 'error');
    }
  };

  const handleTestEmail = async (id) => {
    setTestingId(id);
    try {
      const res = await api.post(`/email-formats/${id}/test`);
      showToast(res.data.message || 'Test email sent!');
    } catch (err) {
      showToast('Failed to send test email: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await api.put(`/email-formats/${currentId}`, formData);
        showToast('Format updated successfully');
      } else {
        await api.post('/email-formats', formData);
        showToast('Format created successfully');
      }
      setShowModal(false);
      resetForm();
      loadFormats();
    } catch (err) {
      console.error(err);
      showToast('Failed to save format', 'error');
    }
  };

  const insertVariable = (variable) => {
    const textarea = textareaRef.current;
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

  const handleDragStart = (e, variable) => {
    e.dataTransfer.setData('text/plain', variable);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const variable = e.dataTransfer.getData('text/plain');
    if (!variable) return;
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const newText = formData.body.substring(0, start) + variable + formData.body.substring(start);
      setFormData(prev => ({ ...prev, body: newText }));
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();
      }, 0);
    }
  };

  const copyToClipboard = (variable) => {
    navigator.clipboard.writeText(variable).then(() => {
      setCopiedVar(variable);
      setTimeout(() => setCopiedVar(null), 1500);
    });
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
    <div className="pb-20 md:pb-0">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Available Variables Banner */}
      <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <i className="fas fa-info-circle text-blue-500 mt-0.5"></i>
          </div>
          <div className="ml-3 w-full">
            <h3 className="text-sm font-medium text-blue-800">Available Variables</h3>
            <p className="mt-1 text-xs text-blue-600">Click any variable to copy it. Drag onto the body field when editing a template.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {variables.map(v => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => copyToClipboard(v.value)}
                  title="Click to copy"
                  className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs font-mono border border-blue-200 transition-colors"
                >
                  {copiedVar === v.value ? <span className="text-green-700 font-semibold">✓ Copied!</span> : v.value}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Email Templates</h2>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="hidden md:flex px-4 py-2 bg-brand-red text-white rounded-lg hover:bg-red-700 items-center gap-2"
        >
          <i className="fas fa-plus"></i> Add Format
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {formats.map((format) => {
            const isExpanded = expandedBodies.has(format.id);
            const isConfirmingDelete = confirmDeleteId === format.id;
            const bodyText = isExpanded
              ? format.body
              : format.body.substring(0, 200) + (format.body.length > 200 ? '...' : '');

            return (
              <div key={format.id} className="bg-white rounded-lg shadow-md border-l-4 border-brand-red overflow-hidden">
                {/* Card Body */}
                <div className="p-5 pb-4">
                  <div className="flex items-start gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">{format.name}</h3>
                    <span className="mt-1 text-xs px-2 py-0.5 bg-red-50 text-brand-red border border-red-200 rounded-full font-medium whitespace-nowrap">Order</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                    <span><i className="fas fa-user mr-1"></i>{format.created_by_user || 'Unknown'}</span>
                    {format.updated_at && (
                      <span><i className="fas fa-clock mr-1"></i>Updated {formatDate(format.updated_at)}</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Subject</label>
                      <p className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-2 rounded border" dir="rtl" style={{ textAlign: 'right' }}>{format.subject}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Body Preview</label>
                      <div className="bg-gray-50 px-3 py-2 rounded text-sm whitespace-pre-wrap border" dir="rtl" style={{ textAlign: 'right' }}>
                        {bodyText}
                      </div>
                      {format.body.length > 200 && (
                        <button onClick={() => toggleBody(format.id)} className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                          {isExpanded ? '↑ Show less' : '↓ Show more'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-end gap-2 flex-wrap">
                  <button
                    onClick={() => handleTestEmail(format.id)}
                    disabled={testingId === format.id}
                    className="text-xs px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-600 rounded-md border border-gray-300 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                  >
                    <i className="fas fa-paper-plane text-xs"></i>
                    {testingId === format.id ? 'Sending...' : 'Test Email'}
                  </button>
                  <button
                    onClick={() => setPreviewFormat(format)}
                    className="text-xs px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-600 rounded-md border border-blue-200 flex items-center gap-1.5 transition-colors"
                  >
                    <i className="fas fa-eye text-xs"></i> Preview
                  </button>
                  <button
                    onClick={() => handleEdit(format)}
                    className="text-xs px-3 py-1.5 bg-white hover:bg-red-50 text-brand-red rounded-md border border-red-200 flex items-center gap-1.5 transition-colors"
                  >
                    <i className="fas fa-edit text-xs"></i> Edit
                  </button>
                  {isConfirmingDelete ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="text-gray-500 font-medium">Delete?</span>
                      <button onClick={() => handleDelete(format.id)} className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium">Yes</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">No</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(format.id)}
                      className="text-xs px-3 py-1.5 bg-white hover:bg-red-50 text-red-500 rounded-md border border-red-200 flex items-center gap-1.5 transition-colors"
                    >
                      <i className="fas fa-trash text-xs"></i> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {formats.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-envelope text-brand-red text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">No email templates yet</h3>
              <p className="text-gray-500 text-sm mb-6">Create your first template to start sending supplier emails.</p>
              <button
                onClick={() => { resetForm(); setShowModal(true); }}
                className="px-5 py-2.5 bg-brand-red text-white rounded-lg hover:bg-red-700 font-medium inline-flex items-center gap-2"
              >
                <i className="fas fa-plus"></i> Create your first template
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => { resetForm(); setShowModal(true); }}
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-brand-red text-white rounded-full shadow-lg hover:bg-red-700 flex items-center justify-center z-40"
        title="Add Format"
      >
        <i className="fas fa-plus text-xl"></i>
      </button>

      {/* Preview Modal */}
      {previewFormat && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Preview — {previewFormat.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Variables replaced with sample values</p>
              </div>
              <button onClick={() => setPreviewFormat(null)} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Subject</label>
                <div className="bg-gray-50 border rounded-md p-3 text-sm font-medium" dir="rtl" style={{ textAlign: 'right' }}>
                  {processTemplate(previewFormat.subject, SAMPLE_VARS)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Body</label>
                <div className="bg-gray-50 border rounded-md p-4 text-sm whitespace-pre-wrap" dir="rtl" style={{ textAlign: 'right' }}>
                  {processTemplate(previewFormat.body, SAMPLE_VARS)}
                </div>
              </div>
            </div>
            <div className="flex justify-end p-6 border-t">
              <button onClick={() => setPreviewFormat(null)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Format Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900">
                {isEditing ? 'Edit Email Format' : 'Create Email Format'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Edit / Preview Tabs */}
            <div className="flex border-b px-6">
              <button
                onClick={() => setModalTab('edit')}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${modalTab === 'edit' ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <i className="fas fa-edit mr-2"></i>Edit
              </button>
              <button
                onClick={() => setModalTab('preview')}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${modalTab === 'preview' ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <i className="fas fa-eye mr-2"></i>Preview
              </button>
            </div>

            <div className="p-6">
              {modalTab === 'preview' ? (
                <div className="space-y-4">
                  <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                    <i className="fas fa-info-circle mr-1"></i>
                    Showing template with sample values. Switch to Edit tab to make changes.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Subject</label>
                    <div className="bg-gray-50 border rounded-md p-3 text-sm font-medium min-h-[40px]" dir={subjectDir} style={{ textAlign: subjectDir === 'rtl' ? 'right' : 'left' }}>
                      {formData.subject ? processTemplate(formData.subject, SAMPLE_VARS) : <span className="text-gray-400 italic">No subject entered</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Body</label>
                    <div className="bg-gray-50 border rounded-md p-4 text-sm whitespace-pre-wrap min-h-[200px]" dir={bodyDir} style={{ textAlign: bodyDir === 'rtl' ? 'right' : 'left' }}>
                      {formData.body ? processTemplate(formData.body, SAMPLE_VARS) : <span className="text-gray-400 italic">No body entered</span>}
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Format Name *</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g., Standard Order Request"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2.5"
                      value={formData.name}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">Email Subject *</label>
                      <button
                        type="button"
                        onClick={() => setSubjectDir(d => d === 'rtl' ? 'ltr' : 'rtl')}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded border text-gray-600 flex items-center gap-1"
                        title="Toggle text direction"
                      >
                        <i className="fas fa-exchange-alt text-xs"></i> {subjectDir.toUpperCase()}
                      </button>
                    </div>
                    <input
                      type="text"
                      name="subject"
                      required
                      dir={subjectDir}
                      placeholder="בקשת הזמנה מ-{companyName}"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red border p-2.5"
                      style={{ textAlign: subjectDir === 'rtl' ? 'right' : 'left' }}
                      value={formData.subject}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">Email Body *</label>
                      <button
                        type="button"
                        onClick={() => setBodyDir(d => d === 'rtl' ? 'ltr' : 'rtl')}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded border text-gray-600 flex items-center gap-1"
                        title="Toggle text direction"
                      >
                        <i className="fas fa-exchange-alt text-xs"></i> {bodyDir.toUpperCase()}
                      </button>
                    </div>
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 mb-1.5">Drag onto body or click to insert at cursor:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {variables.map(v => (
                          <button
                            key={v.value}
                            type="button"
                            draggable
                            onDragStart={(e) => handleDragStart(e, v.value)}
                            onClick={() => insertVariable(v.value)}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:border-blue-300 text-gray-700 text-xs rounded border border-gray-300 font-mono cursor-grab active:cursor-grabbing transition-colors select-none"
                            title={`${v.name} — drag or click to insert`}
                          >
                            {v.value}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      ref={textareaRef}
                      name="body"
                      required
                      rows="12"
                      dir={bodyDir}
                      placeholder={`שלום,\n\nאני {userName} מ-{companyName}. ברצוננו להזמין {quantity} יחידות של {itemName}.\n\n{notes}\n\nבברכה`}
                      className={`block w-full rounded-md shadow-sm focus:border-brand-red focus:ring-brand-red p-2.5 text-sm border transition-colors ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}`}
                      style={{ textAlign: bodyDir === 'rtl' ? 'right' : 'left' }}
                      value={formData.body}
                      onChange={handleInputChange}
                      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleDrop}
                    />
                    {isDragOver && <p className="text-xs text-blue-500 mt-1 font-medium">Drop to insert variable</p>}
                  </div>

                  <div className="flex justify-end gap-3 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-brand-red text-white rounded-md hover:bg-red-700 font-medium"
                    >
                      {isEditing ? 'Update Format' : 'Create Format'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailFormats;
