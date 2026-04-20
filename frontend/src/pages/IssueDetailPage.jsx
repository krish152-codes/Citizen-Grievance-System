import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import { issuesAPI, aiAPI } from '../services/api';
import { formatDateTime, getPriorityBadge, getStatusBadge, getCategoryConfig, DEPARTMENTS, getInitials } from '../utils/helpers';

// ── Status Update Modal ──────────────────────────────
function StatusModal({ issue, onClose, onSave }) {
  const STATUSES = [
    { id: 'in_progress', label: 'In Progress', icon: '↻' },
    { id: 'resolved',    label: 'Resolved',    icon: '✓' },
    { id: 'on_hold',     label: 'On Hold',     icon: '⏸' },
    { id: 'escalated',   label: 'Escalated',   icon: '!' },
    { id: 'closed',      label: 'Closed',      icon: '✕' },
  ];
  const [status, setStatus] = useState(issue.status);
  const [notes, setNotes]   = useState('');
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await issuesAPI.updateStatus(issue._id, { status, notes, notifyCitizen: notify });
      onSave(); onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-display font-bold text-xl text-slate-900">Update Status</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 text-xl">×</button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Current:</span>
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
                    status === id
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span>{icon}</span> {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Action Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Describe action taken, e.g. 'Crew dispatched, ETA 3 hours'..."
              className="input-field resize-none"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-sm font-semibold text-slate-700">Notify citizen via email</span>
            <button
              onClick={() => setNotify(!notify)}
              className={`w-10 h-5 rounded-full relative transition-all ${notify ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow transition-all ${notify ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
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

// ── Reassign Modal ───────────────────────────────────
function ReassignModal({ issue, onClose, onSave }) {
  const [selected, setSelected] = useState('');
  const [reason, setReason]     = useState('');
  const [search, setSearch]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const filtered = DEPARTMENTS.filter(d =>
    d.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!selected) return setError('Please select a department');
    setSaving(true); setError('');
    try {
      await issuesAPI.reassign(issue._id, { department: selected, reason });
      onSave(); onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Reassignment failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-display font-bold text-xl text-slate-900">Reassign Department</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <input
            type="text"
            placeholder="Search departments..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field"
          />
          <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto scrollbar-thin">
            {filtered.map(({ id, label, icon, staff, load }) => (
              <button
                key={id}
                onClick={() => setSelected(label)}
                className={`flex items-start gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                  selected === label
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${selected === label ? 'bg-brand-100' : 'bg-slate-100'}`}>
                  {icon}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-bold leading-tight ${selected === label ? 'text-brand-700' : 'text-slate-800'}`}>{label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{staff} staff · {load}</p>
                </div>
              </button>
            ))}
          </div>
          <div>
            <p className="label">Reason <span className="text-slate-400 normal-case font-normal">(optional)</span></p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="Why is this being reassigned?"
              className="input-field resize-none"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
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

// ── Letter Modal ─────────────────────────────────────
function LetterModal({ issueId, onClose }) {
  const [letter, setLetter] = useState('');
  const [dept, setDept]     = useState('');
  const [genBy, setGenBy]   = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    aiAPI.generateLetter(issueId)
      .then(({ data }) => {
        setLetter(data.letter);
        setDept(data.department);
        setGenBy(data.generatedBy);
      })
      .catch(e => setError(e.response?.data?.message || 'Failed to generate letter'))
      .finally(() => setLoading(false));
  }, [issueId]);

  const copyLetter = () => {
    navigator.clipboard.writeText(letter);
    alert('Letter copied to clipboard!');
  };

  const printLetter = () => {
    const w = window.open('', '_blank');
    w.document.write(`
      <html>
        <head>
          <title>Complaint Letter</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 48px; line-height: 1.8; font-size: 14px; max-width: 700px; margin: auto; }
            pre { white-space: pre-wrap; font-family: Arial, sans-serif; }
          </style>
        </head>
        <body><pre>${letter}</pre></body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="font-display font-bold text-xl text-slate-900">Formal Complaint Letter</h3>
            {dept && <p className="text-xs text-slate-400 mt-0.5">Addressed to: {dept}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Generating formal letter…</p>
            </div>
          ) : error ? (
            <p className="text-red-500 text-sm p-4 bg-red-50 rounded-xl">{error}</p>
          ) : (
            <>
              {genBy && (
                <p className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                  <span className="text-brand-500">✨</span>
                  Generated by: <span className="font-semibold text-brand-600">{genBy}</span>
                </p>
              )}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <pre className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">{letter}</pre>
              </div>
            </>
          )}
        </div>
        {!loading && !error && (
          <div className="flex gap-3 p-6 border-t border-slate-100 flex-shrink-0">
            <button onClick={copyLetter} className="btn-secondary flex-1 text-sm">
              📋 Copy to Clipboard
            </button>
            <button onClick={printLetter} className="btn-primary flex-1 text-sm">
              🖨️ Print / Save PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────
export default function IssueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(null); // 'status' | 'reassign' | 'letter' | null

  const fetchIssue = useCallback(async () => {
    try {
      const { data } = await issuesAPI.getById(id);
      setIssue(data.issue);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchIssue(); }, [fetchIssue]);

  const handleDelete = async () => {
    if (!confirm(`Delete issue #${issue.ticketId}? This cannot be undone.`)) return;
    try {
      await issuesAPI.delete(issue._id);
      navigate('/issues');
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) return (
    <AdminLayout>
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading issue details…</p>
        </div>
      </div>
    </AdminLayout>
  );

  if (!issue) return (
    <AdminLayout>
      <div className="p-6 text-center py-20">
        <p className="text-5xl mb-4">🔍</p>
        <h2 className="font-display font-bold text-xl text-slate-900 mb-2">Issue Not Found</h2>
        <p className="text-slate-500 mb-6">This ticket ID doesn't exist or was deleted.</p>
        <button onClick={() => navigate('/issues')} className="btn-primary">← Back to Issues</button>
      </div>
    </AdminLayout>
  );

  const pri      = getPriorityBadge(issue.priority);
  const sta      = getStatusBadge(issue.status);
  const cat      = getCategoryConfig(issue.category);
  const reporter = issue.reportedBy;
  const assignee = issue.assignedTo;

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
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-brand-600 font-bold text-lg">#{issue.ticketId}</span>
              <span className={`badge ${sta.color} font-bold uppercase text-xs`}>{sta.label}</span>
              {issue.isUrgent && (
                <span className="badge bg-red-100 text-red-700 font-bold text-xs">⚠️ URGENT</span>
              )}
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">{issue.title}</h1>
            {issue.location?.address && (
              <p className="text-slate-500 flex items-center gap-1.5 text-sm">
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeWidth="2"/>
                  <circle cx="12" cy="10" r="3" strokeWidth="2"/>
                </svg>
                {issue.location.address}
                {issue.location.lat && (
                  <span className="text-slate-400 text-xs ml-1">
                    ({issue.location.lat.toFixed(4)}, {issue.location.lng?.toFixed(4)})
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap justify-end flex-shrink-0">
            <button onClick={() => setModal('letter')} className="btn-secondary text-sm">
              📄 Generate Letter
            </button>
            <button onClick={() => setModal('status')} className="btn-primary text-sm">
              Update Status
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

            {/* Images */}
            {issue.imageUrls?.length > 0 && (
              <div className="card p-6">
                <p className="label mb-4">
                  Visual Evidence ({issue.imageUrls.length} image{issue.imageUrls.length !== 1 ? 's' : ''})
                </p>
                <div className="flex gap-3 flex-wrap">
                  {issue.imageUrls.map((url, i) => (
                    <a key={i} href={`http://localhost:5000${url}`} target="_blank" rel="noreferrer">
                      <img
                        src={`http://localhost:5000${url}`}
                        alt={`Evidence ${i + 1}`}
                        className="w-36 h-28 object-cover rounded-xl border border-slate-200 hover:opacity-90 cursor-pointer transition-opacity"
                      />
                    </a>
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
                          i === issue.timeline.length - 1
                            ? 'bg-brand-100 border-2 border-brand-500'
                            : 'bg-brand-600'
                        }`}>
                          {i < issue.timeline.length - 1 ? (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                            </svg>
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full border-2 border-brand-600" />
                          )}
                        </div>
                        {i < issue.timeline.length - 1 && (
                          <div className="w-0.5 flex-1 bg-slate-200 mt-1" />
                        )}
                      </div>
                      <div className="pb-5 min-w-0">
                        <p className={`font-semibold text-sm ${i === issue.timeline.length - 1 ? 'text-brand-700' : 'text-slate-800'}`}>
                          {event.title}
                        </p>
                        <p className="text-slate-500 text-sm mt-0.5">{event.description}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {event.actor && `${event.actor} · `}{formatDateTime(event.timestamp)}
                        </p>
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
            {(issue.aiConfidence > 0 || issue.aiCategory) && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-brand-600">✨</span>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Intelligence</p>
                </div>
                {issue.aiConfidence > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-slate-400 font-semibold">Confidence Score</p>
                      <p className="font-display font-bold text-2xl text-slate-900">
                        {Math.round(issue.aiConfidence * 100)}%
                      </p>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full">
                      <div
                        className="h-full bg-brand-600 rounded-full"
                        style={{ width: `${issue.aiConfidence * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-3 text-sm">
                  {issue.aiCategory && (
                    <div>
                      <p className="label text-[10px]">Predicted Category</p>
                      <p className="font-semibold text-slate-800 capitalize">{issue.aiCategory.replace(/_/g, ' ')}</p>
                    </div>
                  )}
                  {issue.aiRecommendedAction && (
                    <div>
                      <p className="label text-[10px]">Recommended Action</p>
                      <p className="font-semibold text-slate-800">{issue.aiRecommendedAction}</p>
                    </div>
                  )}
                  {issue.sentiment?.label && (
                    <div>
                      <p className="label text-[10px]">Sentiment</p>
                      <p className={`font-semibold capitalize ${
                        issue.sentiment.label === 'negative' ? 'text-red-600' :
                        issue.sentiment.label === 'positive' ? 'text-green-600' : 'text-slate-600'
                      }`}>{issue.sentiment.label}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Issue details */}
            <div className="card p-5">
              <p className="label mb-4">Issue Details</p>
              <div className="space-y-2 text-sm">
                {[
                  ['Category',  `${cat.icon} ${cat.label}`,  null],
                  ['Priority',  null, <span className={`badge ${pri.color} text-xs font-bold uppercase`}>{issue.priority}</span>],
                  ['Department', issue.department || 'Unassigned', null],
                  ['Reported',  formatDateTime(issue.createdAt), null],
                  ['Updated',   formatDateTime(issue.updatedAt), null],
                  issue.slaDeadline ? ['SLA Deadline', formatDateTime(issue.slaDeadline), null] : null,
                ].filter(Boolean).map(([label, value, node]) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-slate-500">{label}</span>
                    {node || <span className="font-semibold text-slate-800 text-right max-w-[60%]">{value}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Reporter */}
            {reporter && (
              <div className="card p-5">
                <p className="label mb-3">Reported By</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {getInitials(reporter.name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{reporter.name}</p>
                    <p className="text-xs text-slate-400">{reporter.email}</p>
                    {reporter.phone && <p className="text-xs text-slate-400">{reporter.phone}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Assignee */}
            {assignee && (
              <div className="card p-5">
                <p className="label mb-3">Assigned To</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {getInitials(assignee.name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{assignee.name}</p>
                    <p className="text-xs text-slate-400">{assignee.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Management Actions */}
            <div className="bg-slate-900 rounded-2xl p-5 text-white">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Management Actions</p>
              <div className="space-y-2">
                <button
                  onClick={() =>
                    issuesAPI.updateStatus(issue._id, { status: 'resolved', notes: 'Marked resolved by admin' })
                      .then(fetchIssue)
                  }
                  className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  ✓ Mark as Resolved
                </button>
                <button
                  onClick={() => setModal('reassign')}
                  className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition-colors"
                >
                  ⇄ Reassign Department
                </button>
                <button
                  onClick={() => setModal('status')}
                  className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition-colors"
                >
                  ≡ Update Status
                </button>
                <button
                  onClick={() => setModal('letter')}
                  className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition-colors"
                >
                  📄 Generate Formal Letter
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full py-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-xl text-xs font-semibold transition-colors"
                >
                  🗑 Delete Issue
                </button>
              </div>
              <p className="text-xs text-slate-500 text-center mt-4">All actions are logged for audit trail integrity.</p>
            </div>
          </div>
        </div>
      </div>

      {modal === 'status'   && <StatusModal   issue={issue} onClose={() => setModal(null)} onSave={fetchIssue} />}
      {modal === 'reassign' && <ReassignModal issue={issue} onClose={() => setModal(null)} onSave={fetchIssue} />}
      {modal === 'letter'   && <LetterModal   issueId={issue._id} onClose={() => setModal(null)} />}
    </AdminLayout>
  );
}