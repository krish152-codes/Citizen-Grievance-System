import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import StatusBadge from '../components/drain/StatusBadge';
import { drainEchoAPI } from '../services/api';
import { timeAgo, formatConfidence, DRAIN_ECHO_CLASS_CONFIG } from '../utils/helpers';

export default function DrainEchoHistoryPage() {
  const navigate = useNavigate();
  const [diagnostics, setDiagnostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    drainEchoAPI.getHistory({ predictedClass: classFilter || undefined, limit: 50 })
      .then(({ data }) => setDiagnostics(data.diagnostics))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [classFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="font-display text-3xl font-bold text-slate-900 mb-1">Drain Echo History</h1>
        <p className="text-slate-500 text-sm mb-6">Acoustic diagnostic records across all monitored drains.</p>

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button onClick={() => setClassFilter('')} className={`px-3 py-1 rounded-full text-xs font-semibold ${!classFilter ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>All</button>
          {Object.entries(DRAIN_ECHO_CLASS_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setClassFilter(key)} className={`px-3 py-1 rounded-full text-xs font-semibold ${classFilter === key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
        ) : diagnostics.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">
            <span className="text-3xl block mb-2">🎙️</span>
            <p className="text-sm font-medium">No Drain Echo diagnostics yet.</p>
            <p className="text-xs mt-1">Run a diagnostic from a monitored drain to create the first record.</p>
          </div>
        ) : (
          <div className="card overflow-hidden divide-y divide-slate-50">
            {diagnostics.map((d) => (
              <div key={d._id} onClick={() => navigate(d.incident ? `/incidents/${d.incident._id}` : `/drains/${d.drain?._id}`)} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 cursor-pointer">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs font-bold text-slate-400">{d.diagnosticId}</span>
                    <span className="text-xs text-slate-400">{timeAgo(d.createdAt)}</span>
                  </div>
                  <p className="font-semibold text-sm text-slate-900">{d.drain?.name} <span className="text-slate-400 font-normal">· {d.drain?.ward}</span></p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-slate-500 font-medium">{formatConfidence(d.confidence)}</span>
                  <StatusBadge kind="drainEchoClass" status={d.predictedClass} size="sm" />
                  {d.incident ? <StatusBadge kind="incident" status={d.incident.status} size="sm" /> : <span className="text-[10px] text-slate-300 font-semibold">no incident</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
