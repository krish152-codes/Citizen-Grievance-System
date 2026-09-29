import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import StatusBadge from '../components/drain/StatusBadge';
import { drainIncidentsAPI } from '../services/api';
import { timeAgo } from '../utils/helpers';
import { INCIDENT_STATUS_FLOW } from '../utils/helpers';

const SOURCE_LABELS = { SENSOR_ALERT: '📟 Sensor Alert', DRAIN_ECHO: '🎙️ Drain Echo', MANUAL: '✍️ Manual' };

export default function DrainIncidentsPage() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    drainIncidentsAPI.getAll({ status: status || undefined, limit: 50 })
      .then(({ data }) => setIncidents(data.incidents))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="font-display text-3xl font-bold text-slate-900 mb-1">Incidents</h1>
        <p className="text-slate-500 text-sm mb-6">Municipal response queue for drain alerts and Drain Echo diagnostics.</p>

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setStatus('')}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${!status ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            All
          </button>
          {INCIDENT_STATUS_FLOW.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${status === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
        ) : incidents.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">
            <span className="text-3xl block mb-2">📋</span>
            <p className="text-sm font-medium">No incidents match these filters.</p>
          </div>
        ) : (
          <div className="card overflow-hidden divide-y divide-slate-50">
            {incidents.map((inc) => (
              <div key={inc._id} onClick={() => navigate(`/incidents/${inc._id}`)} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 cursor-pointer">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs font-bold text-slate-400">{inc.incidentId}</span>
                    <span className="text-xs">{SOURCE_LABELS[inc.source]}</span>
                  </div>
                  <p className="font-semibold text-sm text-slate-900">{inc.drain?.name || 'Unknown Drain'}</p>
                  <p className="text-xs text-slate-400">{inc.drain?.ward} · Created {timeAgo(inc.createdAt)}{inc.assignedTeam ? ` · ${inc.assignedTeam}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge kind="severity" status={inc.priority} size="sm" />
                  <StatusBadge kind="incident" status={inc.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
