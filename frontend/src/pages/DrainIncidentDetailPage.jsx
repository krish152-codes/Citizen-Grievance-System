import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import StatusBadge from '../components/drain/StatusBadge';
import IncidentStatusStepper from '../components/drain/IncidentStatusStepper';
import ClassificationCard from '../components/drain/ClassificationCard';
import { drainIncidentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { timeAgo, formatDateTime } from '../utils/helpers';

export default function DrainIncidentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMunicipal } = useAuth();

  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [team, setTeam] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    drainIncidentsAPI.getById(id)
      .then(({ data }) => { setIncident(data.incident); setTeam(data.incident.assignedTeam || ''); })
      .catch(() => setError('Failed to load incident.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const advanceStatus = async (status) => {
    setBusy(true);
    try { const { data } = await drainIncidentsAPI.update(id, { status }); setIncident(data.incident); }
    finally { setBusy(false); }
  };
  const saveTeam = async () => {
    setBusy(true);
    try { const { data } = await drainIncidentsAPI.update(id, { assignedTeam: team }); setIncident(data.incident); }
    finally { setBusy(false); }
  };
  const saveAction = async () => {
    if (!actionTaken.trim()) return;
    setBusy(true);
    try { const { data } = await drainIncidentsAPI.update(id, { actionTaken }); setIncident(data.incident); setActionTaken(''); }
    finally { setBusy(false); }
  };
  const saveResolution = async () => {
    if (!resolutionNotes.trim()) return;
    setBusy(true);
    try { const { data } = await drainIncidentsAPI.update(id, { resolutionNotes }); setIncident(data.incident); setResolutionNotes(''); }
    finally { setBusy(false); }
  };

  if (loading) {
    return <AdminLayout><div className="p-6 max-w-5xl mx-auto"><div className="h-8 bg-slate-200 rounded w-64 animate-pulse mb-4" /><div className="h-64 bg-slate-100 rounded-2xl animate-pulse" /></div></AdminLayout>;
  }
  if (error || !incident) {
    return (
      <AdminLayout>
        <div className="p-12 text-center">
          <p className="text-slate-600 font-semibold mb-4">{error || 'Incident not found'}</p>
          <button onClick={() => navigate('/incidents')} className="btn-primary">Back to Incidents</button>
        </div>
      </AdminLayout>
    );
  }

  const drain = incident.drain;

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-slate-400">{incident.incidentId}</span>
              <StatusBadge kind="severity" status={incident.priority} size="sm" />
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900">{drain?.name || 'Unknown Drain'}</h1>
            <p className="text-slate-500 text-sm">{drain?.ward} · Created {timeAgo(incident.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge kind="incident" status={incident.status} />
            {drain?._id && <button onClick={() => navigate(`/drains/${drain._id}`)} className="btn-secondary text-sm">View Drain</button>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Workflow */}
            <IncidentStatusStepper status={incident.status} canEdit={isMunicipal} busy={busy} onAdvance={advanceStatus} />

            {/* Drain Echo (if applicable) */}
            {incident.diagnostic && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Drain Echo Diagnostic</p>
                <ClassificationCard diagnostic={incident.diagnostic} />
              </div>
            )}

            {/* Response */}
            {isMunicipal && (
              <div className="card p-5 space-y-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Response</p>

                <div>
                  <label className="label text-xs">Assigned Team</label>
                  <div className="flex gap-2">
                    <input className="input-field text-sm py-1.5 flex-1" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="e.g. Zone 3 Rapid Response" />
                    <button onClick={saveTeam} disabled={busy} className="btn-secondary text-xs px-3">Save</button>
                  </div>
                </div>

                <div>
                  <label className="label text-xs">Record Action Taken</label>
                  <div className="flex gap-2">
                    <input className="input-field text-sm py-1.5 flex-1" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} placeholder="e.g. Jetting equipment dispatched" />
                    <button onClick={saveAction} disabled={busy || !actionTaken.trim()} className="btn-secondary text-xs px-3">Add</button>
                  </div>
                </div>

                {(incident.status === 'IN_PROGRESS' || incident.status === 'RESOLVED') && (
                  <div>
                    <label className="label text-xs">Resolution Notes</label>
                    <div className="flex gap-2">
                      <input className="input-field text-sm py-1.5 flex-1" value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="e.g. Silt cleared, flow restored" />
                      <button onClick={saveResolution} disabled={busy || !resolutionNotes.trim()} className="btn-secondary text-xs px-3">Add</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timeline */}
            <div className="card p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Timeline</p>
              <div className="space-y-4">
                {incident.timeline?.slice().reverse().map((ev, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{ev.title}</p>
                      <p className="text-xs text-slate-500">{ev.description}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{ev.actor} · {formatDateTime(ev.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar: sensor context */}
          <div className="space-y-5">
            <div className="card p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Sensor Context (at creation)</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Water Status</span><span className="font-semibold text-slate-800">{incident.contextSnapshot?.waterStatus || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Water Fill</span><span className="font-semibold text-slate-800">{incident.contextSnapshot?.waterFillPct != null ? `${incident.contextSnapshot.waterFillPct}%` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Rain / Wetness</span><span className="font-semibold text-slate-800">{incident.contextSnapshot?.rainWetness || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Atmosphere</span><span className="font-semibold text-slate-800">{incident.contextSnapshot?.atmosphereStatus || '—'}</span></div>
              </div>
              {incident.contextSnapshot?.atmosphereStatus === 'ALERT' && (
                <p className="text-[11px] text-red-600 mt-3 pt-3 border-t border-slate-100 leading-relaxed">
                  Atmospheric alert detected. Do not use this dashboard as a substitute for applicable confined-space
                  safety procedures or calibrated professional atmospheric monitoring.
                </p>
              )}
            </div>

            <div className="card p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Response Times</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Acknowledged</span><span className="font-semibold text-slate-800">{incident.timeToAcknowledgeMin != null ? `${incident.timeToAcknowledgeMin} min` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Resolved</span><span className="font-semibold text-slate-800">{incident.timeToResolveMin != null ? `${incident.timeToResolveMin} min` : '—'}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
