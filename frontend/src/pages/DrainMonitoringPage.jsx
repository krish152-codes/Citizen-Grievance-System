import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNav from '../components/layout/PublicNav';
import StatusBadge from '../components/drain/StatusBadge';
import { drainsAPI } from '../services/api';
import { timeAgo } from '../utils/helpers';
import usePolling from '../hooks/usePolling';

export default function DrainMonitoringPage() {
  const navigate = useNavigate();
  const [drains, setDrains] = useState([]);
  const [loading, setLoading] = useState(true);

  usePolling(() => { drainsAPI.getAll().then(({ data }) => setDrains(data.drains)).catch(() => {}); }, 8000);

  useEffect(() => {
    drainsAPI.getAll().then(({ data }) => setDrains(data.drains)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900 mb-1">Drain Monitoring</h1>
            <p className="text-slate-500 text-sm">Live status of monitored storm drains in your city.</p>
          </div>
          <button onClick={() => navigate('/drain-echo')} className="btn-primary text-sm">🎙️ Run Drain Echo</button>
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
        ) : drains.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">
            <span className="text-3xl block mb-2">🌊</span>
            <p className="text-sm font-medium">No drains are being monitored yet.</p>
          </div>
        ) : (
          <div className="card overflow-hidden divide-y divide-slate-50">
            {drains.map((d) => (
              <div key={d._id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-slate-900">{d.name}</p>
                  <p className="text-xs text-slate-400">{d.ward} · Updated {d.latest?.timestamp ? timeAgo(d.latest.timestamp) : 'never'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge kind="device" status={d.latest?.deviceStatus} size="sm" />
                  <StatusBadge kind="water" status={d.latest?.waterStatus} />
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-slate-400 mt-4 text-center leading-relaxed">
          Statuses reflect the most recent sensor reading and may not be real-time if a device is offline.
          For emergencies, contact municipal services directly rather than relying on this dashboard.
        </p>
      </div>
    </div>
  );
}
