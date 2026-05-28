import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { departmentsAPI, issuesAPI } from '../services/api';

const CATEGORIES = [
  { id: 'roads',          label: 'Roads',          dept: 'Public Works Department' },
  { id: 'waste',          label: 'Sanitation',      dept: 'Sanitation & Waste Management' },
  { id: 'water',          label: 'Water',           dept: 'Water Supply Department' },
  { id: 'electricity',    label: 'Electricity',     dept: 'Electricity Department' },
  { id: 'infrastructure', label: 'Infrastructure',  dept: 'Infrastructure Department' },
  { id: 'public_safety',  label: 'Public Safety',   dept: 'Public Safety Department' },
  { id: 'parks',          label: 'Parks',           dept: 'Parks & Recreation Department' },
  { id: 'traffic',        label: 'Traffic',         dept: 'Traffic Management Department' },
  { id: 'other',          label: 'Other',           dept: 'Municipal Corporation' },
];

const EMPTY_FORM = { name: '', category: 'roads', city: '', state: 'Madhya Pradesh', headName: '', email: '', phone: '', address: '' };

export default function DepartmentPage() {
  const [departments, setDepartments]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showForm, setShowForm]           = useState(false);
  const [editDept, setEditDept]           = useState(null); // null = create, obj = edit
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [saving, setSaving]               = useState(false);
  const [formError, setFormError]         = useState('');
  const [cityFilter, setCityFilter]       = useState('');
  const [catFilter, setCatFilter]         = useState('');

  // For sending complaint
  const [sendModal, setSendModal]         = useState(null); // { issue, dept }
  const [pendingIssues, setPendingIssues] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState('');
  const [sendLoading, setSendLoading]     = useState(false);
  const [sendResult, setSendResult]       = useState(null);

  const load = () => {
    setLoading(true);
    departmentsAPI.getAll({ city: cityFilter, category: catFilter })
      .then(({ data }) => setDepartments(data.departments))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [cityFilter, catFilter]);

  // Load pending/in-progress issues for the Send Complaint modal
  useEffect(() => {
    issuesAPI.getAll({ status: 'pending,in_progress', limit: 50 })
      .then(({ data }) => setPendingIssues(data.issues || []))
      .catch(() => {});
  }, []);

  const openCreate = () => { setEditDept(null); setForm(EMPTY_FORM); setFormError(''); setShowForm(true); };
  const openEdit   = (d) => { setEditDept(d); setForm({ name: d.name, category: d.category, city: d.city, state: d.state, headName: d.headName, email: d.email, phone: d.phone, address: d.address }); setFormError(''); setShowForm(true); };

  const handleFormChange = (k, v) => { setForm(prev => ({ ...prev, [k]: v })); setFormError(''); };

  const handleSave = async () => {
    if (!form.name || !form.email || !form.city) { setFormError('Name, email and city are required.'); return; }
    setSaving(true);
    try {
      if (editDept) {
        await departmentsAPI.update(editDept._id, form);
      } else {
        await departmentsAPI.create(form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this department? This cannot be undone.')) return;
    try { await departmentsAPI.delete(id); load(); } catch (err) { alert(err.response?.data?.message || 'Delete failed'); }
  };

  const handleSendComplaint = async () => {
    if (!selectedIssue) { alert('Select an issue first'); return; }
    setSendLoading(true);
    setSendResult(null);
    try {
      const issue  = pendingIssues.find(i => i._id === selectedIssue);
      const { data } = await departmentsAPI.sendComplaint(selectedIssue, { city: sendModal?.city });
      setSendResult(data);
    } catch (err) {
      setSendResult({ success: false, error: err.response?.data?.message || 'Failed' });
    } finally {
      setSendLoading(false);
    }
  };

  const uniqueCities = [...new Set(departments.map(d => d.city))].sort();

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Department Registry</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage city departments. When AI routes a complaint, tap "Send Application" to dispatch it.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSendModal({})} className="btn-secondary text-sm px-4 py-2">
              📨 Send Complaint Application
            </button>
            <button onClick={openCreate} className="btn-primary text-sm px-4 py-2">
              + Add Department
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Filter by city…"
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            className="input-field w-44 text-sm"
          />
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="input-field w-44 text-sm"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button onClick={() => { setCityFilter(''); setCatFilter(''); }} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : departments.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-3xl mb-3">🏢</p>
            <h3 className="font-display font-bold text-slate-900 mb-2">No departments yet</h3>
            <p className="text-slate-500 text-sm mb-4">Add departments so AI can auto-route complaints to the right office.</p>
            <button onClick={openCreate} className="btn-primary px-6 py-2 text-sm">Add First Department</button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Department Name','Category','City / State','Head','Email','Complaints','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {departments.map(d => (
                    <tr key={d._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{d.name}</p>
                        {d.address && <p className="text-xs text-slate-400 truncate max-w-[180px]">{d.address}</p>}
                        {!d.isActive && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">INACTIVE</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-semibold capitalize">
                          {d.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{d.city}</p>
                        <p className="text-xs text-slate-400">{d.state}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{d.headName || '—'}</td>
                      <td className="px-4 py-3">
                        <a href={`mailto:${d.email}`} className="text-brand-600 text-xs hover:underline">{d.email}</a>
                        {d.phone && <p className="text-xs text-slate-400">{d.phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700">{d.complaintsReceived}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(d)} className="text-xs text-brand-600 font-semibold hover:underline">Edit</button>
                          <button onClick={() => handleDelete(d._id)} className="text-xs text-red-500 font-semibold hover:underline">Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Add/Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {editDept ? 'Edit Department' : 'Add Department'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Department Name *', key: 'name', placeholder: 'e.g. Public Works Department' },
                { label: 'City *',            key: 'city', placeholder: 'e.g. Indore' },
                { label: 'State',             key: 'state', placeholder: 'e.g. Madhya Pradesh' },
                { label: 'Head of Department',key: 'headName', placeholder: 'e.g. Mr. Rajesh Kumar' },
                { label: 'Official Email *',  key: 'email', placeholder: 'dept@mccindore.gov.in', type: 'email' },
                { label: 'Phone',             key: 'phone', placeholder: '+91 731 0000000' },
                { label: 'Office Address',    key: 'address', placeholder: 'Building no, Street, City' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input
                    type={type || 'text'}
                    value={form[key]}
                    onChange={e => handleFormChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="input-field"
                  />
                </div>
              ))}

              <div>
                <label className="label">Category (which issues go here) *</label>
                <select value={form.category} onChange={e => handleFormChange('category', e.target.value)} className="input-field">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label} → {c.dept}</option>)}
                </select>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">⚠️ {formError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving…' : editDept ? 'Save Changes' : 'Add Department'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Send Complaint Modal ── */}
      {sendModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">Send Complaint Application</h2>
                <p className="text-sm text-slate-500 mt-0.5">AI auto-matches the issue's category to the right department in the right city.</p>
              </div>
              <button onClick={() => { setSendModal(null); setSendResult(null); setSelectedIssue(''); }} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
            </div>

            {!sendResult ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="label">Select Issue to Send *</label>
                    <select
                      value={selectedIssue}
                      onChange={e => setSelectedIssue(e.target.value)}
                      className="input-field"
                    >
                      <option value="">— Choose a complaint —</option>
                      {pendingIssues.map(i => (
                        <option key={i._id} value={i._id}>
                          #{i.ticketId} — {i.title} ({i.category}, {i.priority})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Showing pending and in-progress complaints.</p>
                  </div>

                  <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 text-sm text-brand-800 leading-relaxed">
                    <p className="font-bold mb-1">How auto-routing works:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>AI reads the issue's category (e.g. "roads")</li>
                      <li>Looks up your Department Registry for that category + city</li>
                      <li>Generates a formal complaint letter addressed to the department head</li>
                      <li>In production (with SMTP set up): sends the email automatically</li>
                      <li>Records the dispatch on the issue timeline</li>
                    </ol>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => { setSendModal(null); setSendResult(null); setSelectedIssue(''); }} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={handleSendComplaint} disabled={sendLoading || !selectedIssue} className="btn-primary flex-1">
                    {sendLoading ? 'Processing…' : '📨 Send Application'}
                  </button>
                </div>
              </>
            ) : sendResult.success ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                  <p className="font-bold text-green-800 mb-2">✅ Application Ready!</p>
                  <div className="text-sm text-green-700 space-y-1">
                    <p><span className="font-semibold">Department:</span> {sendResult.department?.name}</p>
                    <p><span className="font-semibold">Email:</span> {sendResult.department?.email}</p>
                    {sendResult.department?.headName && <p><span className="font-semibold">Head:</span> {sendResult.department.headName}</p>}
                    <p className="text-xs mt-2 text-green-600">{sendResult.emailNote}</p>
                  </div>
                </div>

                <div>
                  <p className="label mb-2">Complaint Letter (copy & send if email not configured)</p>
                  <textarea
                    readOnly
                    value={sendResult.applicationLetter}
                    rows={14}
                    className="input-field font-mono text-xs resize-none bg-slate-50"
                  />
                </div>

                <div className="flex gap-3">
                  <button onClick={() => { navigator.clipboard.writeText(sendResult.applicationLetter); alert('Letter copied!'); }} className="btn-secondary flex-1">📋 Copy Letter</button>
                  <button onClick={() => { setSendModal(null); setSendResult(null); setSelectedIssue(''); }} className="btn-primary flex-1">Done</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                  <p className="font-bold text-red-800 mb-1">⚠️ Could not route</p>
                  <p className="text-sm text-red-700">{sendResult.error}</p>
                  <p className="text-xs text-red-600 mt-2">Add the matching department in the registry first, then try again.</p>
                </div>
                <button onClick={() => setSendResult(null)} className="btn-secondary w-full">Try Again</button>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
