import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import { issuesAPI } from '../services/api';
import { formatDateTime, getPriorityBadge, getStatusBadge, getCategoryConfig, DEPARTMENTS } from '../utils/helpers';

// ── Status Update Modal ─────────────────────────────────
function StatusModal({ issue, onClose, onSave }) {
  const STATUSES = [
    { id: 'in_progress', label: 'In Progress', icon: '↻' },
    { id: 'resolved', label: 'Resolved', icon: '✓' },
    { id: 'on_hold', label: 'On Hold', icon: '⏸' },
    { id: 'escalated', label: 'Escalated', icon: '!' },
  ];
  const [status, setStatus] = useState(issue.status);
  const [notes, setNotes] = useState('');
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await issuesAPI.updateStatus(issue._id, { status, notes, notifyCitizen: notify });
      onSave();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-display font-bold text-xl text-slate-900">Update Status</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500">×</button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">Current Status</p>
            <span className={`badge ${getStatusBadge(issue.status).color}`}>{getStatusBadge(issue.status).label}</span>
          </div>
          <div>
            <p className="label mb-3">Select New Status</p>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => setStatus(id)}
                  className={`flex items-center gap-2 p-3 rounded-2xl border-2 text-sm font-semibold transition-all ${
                    status === id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span>{icon}</span> {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Update Details/Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g., Maintenance crew dispatched to 5th & Main. Debris clearance underway."
              className="input-field resize-none"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-brand-50 rounded-xl">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polyline points="22 2 15 22 11 13 2 9 22 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-sm font-semibold text-slate-700">Notify Reporting Citizen</span>
            </div>
            <button onClick={() => setNotify(!notify)} className={`w-10 h-5 rounded-full transition-all relative ${notify ? 'bg-brand-600' : 'bg-slate-300'}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${notify ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Confirm Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reassign Modal ──────────────────────────────────────
function ReassignModal({ issue, onClose, onSave }) {
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = DEPARTMENTS.filter(d =>
    d.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!selected) return alert('Please select a department');
    setSaving(true);
    try {
      await issuesAPI.reassign(issue._id, { department: selected, reason });
      onSave();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Reassignment failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-display font-bold text-xl text-slate-900">Reassign Department</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500">×</button>
        </div>
        <div className="p-6 space-y-4">
          <input
            type="text"
            placeholder="Search departments or agencies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field"
          />
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(({ id, label, icon, staff, load }) => (
              <button
                key={id}
                onClick={() => setSelected(label)}
                className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                  selected === label ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${
                  selected === label ? 'bg-brand-100' : 'bg-slate-100'
                }`}>{icon}</div>
                <div className="min-w-0">
                  <p className={`text-sm font-bold leading-tight ${selected === label ? 'text-brand-700' : 'text-slate-800'}`}>{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${
                      load === 'Low Load' ? 'bg-green-500' : load === 'Optimal' ? 'bg-green-400' : 'bg-orange-400'
                    }`}></span>
                    {staff} active staff • {load}
                  </p>
                </div>
                {selected === label && (
                  <svg className="w-4 h-4 text-brand-600 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
          <div>
            <p className="label">Reason for Reassignment <span className="text-slate-400 normal-case font-normal">(Optional)</span></p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why this issue is being moved..."
              className="input-field resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Confirm Reassignment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────
export default function IssueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'status' | 'reassign' | null

  const fetchIssue = async () => {
    try {
      const { data } = await issuesAPI.getById(id);
      setIssue(data.issue);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIssue(); }, [id]);

  if (loading) return (
    <AdminLayout>
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    </AdminLayout>
  );

  if (!issue) return (
    <AdminLayout>
      <div className="p-6 text-center py-20">
        <p className="text-4xl mb-4">🔍</p>
        <h2 className="font-display font-bold text-xl text-slate-900 mb-2">Issue Not Found</h2>
        <button onClick={() => navigate('/issues')} className="btn-primary mt-4">Back to Issues</button>
      </div>
    </AdminLayout>
  );

  const pri = getPriorityBadge(issue.priority);
  const sta = getStatusBadge(issue.status);
  const cat = getCategoryConfig(issue.category);

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-5">
          <button onClick={() => navigate('/dashboard')} className="hover:text-slate-700">Dashboard</button>
          <span>/</span>
          <button onClick={() => navigate('/issues')} className="hover:text-slate-700">Issues</button>
          <span>/</span>
          <span className="text-brand-600 font-semibold">#{issue.ticketId}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-display text-brand-600 font-bold">#{issue.ticketId}</span>
              <span className={`badge ${sta.color} font-bold`}>{sta.label.toUpperCase()}</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-slate-900 mb-2">{issue.title}</h1>
            {issue.location?.address && (
              <p className="text-slate-500 flex items-center gap-1.5 text-sm">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeWidth="2"/>
                  <circle cx="12" cy="10" r="3" strokeWidth="2"/>
                </svg>
                {issue.location.address}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polyline points="6 9 6 2 18 2 18 9" strokeWidth="2" strokeLinecap="round"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" strokeWidth="2"/>
                <rect x="6" y="14" width="12" height="8" strokeWidth="2"/>
              </svg>
              Export PDF
            </button>
            <button className="btn-primary text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeWidth="2"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeWidth="2"/>
              </svg>
              Edit Record
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Description */}
            <div className="card p-6">
              <p className="label mb-3">Description</p>
              <p className="text-slate-700 leading-relaxed">{issue.description}</p>
            </div>

            {/* Visual Evidence */}
            {issue.imageUrls?.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="label">Visual Evidence</p>
                  <button className="text-xs text-brand-600 font-semibold">View All ({issue.imageUrls.length})</button>
                </div>
                <div className="flex gap-3 flex-wrap">
                  {issue.imageUrls.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-36 h-28 object-cover rounded-xl border border-slate-200" />
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            {issue.timeline?.length > 0 && (
              <div className="card p-6">
                <p className="label mb-5">Incident Timeline</p>
                <div className="space-y-5">
                  {issue.timeline.map((event, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          i === issue.timeline.length - 1 ? 'bg-brand-100 border-2 border-brand-500' : 'bg-brand-600'
                        }`}>
                          {i < issue.timeline.length - 1 ? (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                            </svg>
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full border-2 border-brand-600" />
                          )}
                        </div>
                        {i < issue.timeline.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-1" />}
                      </div>
                      <div className="pb-5">
                        <p className={`font-semibold text-sm ${i === issue.timeline.length - 1 ? 'text-brand-700' : 'text-slate-800'}`}>{event.title}</p>
                        <p className="text-slate-500 text-sm mt-0.5">{event.description}</p>
                        <p className="text-xs text-slate-400 mt-1">{event.actor && `${event.actor} • `}{formatDateTime(event.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* AI Intelligence */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-brand-600">✨</span>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Intelligence</p>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-slate-400 font-semibold">Confidence Score</p>
                  <p className="font-display font-bold text-2xl text-slate-900">{Math.round((issue.aiConfidence || 0) * 100)}%</p>
                </div>
                <div className="h-2 bg-slate-100 rounded-full">
                  <div className="h-full bg-brand-600 rounded-full" style={{ width: `${(issue.aiConfidence || 0) * 100}%` }} />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="label text-[10px]">Predicted Category</p>
                  <p className="text-sm font-semibold text-slate-800">{issue.aiCategory || cat.label}</p>
                </div>
                <div>
                  <p className="label text-[10px]">Recommended Action</p>
                  <p className="text-sm font-semibold text-slate-800">{issue.aiRecommendedAction || 'Route to Public Works'}</p>
                </div>
              </div>
            </div>

            {/* Responsibility */}
            <div className="card p-5">
              <p className="label mb-4">Responsibility</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-sm font-bold">
                  {issue.assignedTo?.name?.[0] || 'A'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{issue.assignedTo?.name || 'Officer J. Miller'}</p>
                  <p className="text-xs text-slate-400">Public Works Department</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">Department</span>
                  <span className="font-semibold text-slate-800">{issue.department || 'Public Works'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">SLA Deadline</span>
                  {issue.slaDeadline && (
                    <span className={`font-semibold ${new Date(issue.slaDeadline) < new Date() ? 'text-red-600' : 'text-slate-800'}`}>
                      {formatDateTime(issue.slaDeadline)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Management Actions */}
            <div className="bg-slate-900 rounded-2xl p-5 text-white">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Management Actions</p>
              <div className="space-y-2">
                <button
                  onClick={() => issuesAPI.updateStatus(issue._id, { status: 'resolved', notes: 'Marked resolved by admin' }).then(fetchIssue)}
                  className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                  </svg>
                  Mark as Resolved
                </button>
                <button
                  onClick={() => setModal('reassign')}
                  className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  ⇄ Reassign Dept
                </button>
                <button
                  onClick={() => setModal('status')}
                  className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  ≡ Update Status
                </button>
              </div>
              <p className="text-xs text-slate-500 text-center mt-4">All actions are logged for audit trail integrity.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === 'status' && <StatusModal issue={issue} onClose={() => setModal(null)} onSave={fetchIssue} />}
      {modal === 'reassign' && <ReassignModal issue={issue} onClose={() => setModal(null)} onSave={fetchIssue} />}
    </AdminLayout>
  );
}
