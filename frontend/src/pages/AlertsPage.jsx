import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import AlertCard from '../components/drain/AlertCard';
import { alertsAPI, drainIncidentsAPI } from '../services/api';

const SEVERITIES = ['', 'critical', 'high', 'warning', 'info'];
const STATUSES = ['', 'unacknowledged', 'acknowledged', 'resolved'];

export default function AlertsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    alertsAPI.getAll({ severity: severity || undefined, status: status || undefined, limit: 50 })
      .then(({ data }) => { setAlerts(data.alerts); setSummary(data.summary); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [severity, status]);

  useEffect(() => { load(); }, [load]);

  const acknowledge = async (id) => {
    setBusy(id);
    try { await alertsAPI.acknowledge(id); load(); } finally { setBusy(null); }
  };
  const assign = async (id, team) => {
    setBusy(id);
    try { await alertsAPI.assign(id, { assignedTeam: team }); load(); } finally { setBusy(null); }
  };
  const createIncident = async (alert) => {
    setBusy(alert._id);
    try {
      await drainIncidentsAPI.create({ drainId: alert.drain?._id || alert.drain, source: 'SENSOR_ALERT', alertId: alert._id });
      navigate('/incidents');
    } finally { setBusy(null); }
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900 mb-1">Alerts</h1>
            <p className="text-slate-500 text-sm">
              {summary ? `${summary.unacknowledged} unacknowledged · ${summary.critical} critical` : 'Water, atmosphere, and device alerts'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {SEVERITIES.map((s) => (
            <button
              key={s || 'all-sev'}
              onClick={() => setSeverity(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                severity === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All Severities'}
            </button>
          ))}
          <span className="w-px h-4 bg-slate-200 mx-1" />
          {STATUSES.map((s) => (
            <button
              key={s || 'all-status'}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                status === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All Statuses'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
        ) : alerts.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">
            <span className="text-3xl block mb-2">🔔</span>
            <p className="text-sm font-medium">No alerts match these filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <AlertCard
                key={a._id}
                alert={a}
                busy={busy === a._id}
                onAcknowledge={acknowledge}
                onAssign={assign}
                onViewDrain={(drainId) => navigate(`/drains/${drainId}`)}
                onCreateIncident={createIncident}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
