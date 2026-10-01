import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import StatusBadge from '../components/drain/StatusBadge';
import AddDrainModal from '../components/drain/AddDrainModal';
import { useAuth } from '../context/AuthContext';
import usePolling from '../hooks/usePolling';
import { drainsAPI, alertsAPI, drainIncidentsAPI } from '../services/api';
import { timeAgo } from '../utils/helpers';

const StatSkeleton = () => (
  <div className="card p-5 animate-pulse space-y-3">
    <div className="w-9 h-9 bg-slate-200 rounded-xl" />
    <div className="h-7 bg-slate-200 rounded w-12" />
    <div className="h-3 bg-slate-100 rounded w-20" />
  </div>
);

const StatCard = ({ icon, value, label, tone = 'slate' }) => {
  const tones = {
    slate: 'bg-slate-50',
    green: 'bg-green-50',
    amber: 'bg-amber-50',
    orange: 'bg-orange-50',
    red: 'bg-red-50',
    purple: 'bg-purple-50',
  };
  return (
    <div className="card p-5">
      <div className={`w-9 h-9 ${tones[tone]} rounded-xl flex items-center justify-center text-base mb-2`}>{icon}</div>
      <p className="font-display text-2xl font-bold text-slate-900">{value ?? '—'}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
};

export default function DrainsOverviewPage() {
  const navigate = useNavigate();
  const { isMunicipal } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [drains, setDrains] = useState([]);
  const [summary, setSummary] = useState(null);
  const [alertSummary, setAlertSummary] = useState(null);
  const [openIncidents, setOpenIncidents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Quiet refresh so live readings appear without reloading the page
  usePolling(() => {
    drainsAPI.getAll()
      .then((res) => { setDrains(res.data.drains); setSummary(res.data.summary); })
      .catch(() => {});
  }, 5000);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      drainsAPI.getAll(),
      alertsAPI.getAll({ status: 'unacknowledged', limit: 1 }).catch(() => null),
      drainIncidentsAPI.getAll({ status: 'NEW,VERIFIED,ASSIGNED,IN_PROGRESS', limit: 1 }).catch(() => null),
    ])
      .then(([drainRes, alertRes, incidentRes]) => {
        setDrains(drainRes.data.drains);
        setSummary(drainRes.data.summary);
        setAlertSummary(alertRes?.data?.summary || null);
        setOpenIncidents(incidentRes?.data?.pagination?.total ?? null);
      })
      .catch(() => setError('Failed to load drain data. Is the backend running and have you run `npm run seed:drains`?'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = drains.filter((d) =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.deviceId.toLowerCase().includes(search.toLowerCase()) || d.ward?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900 mb-1">Smart Drain Monitoring</h1>
            <p className="text-slate-500 text-sm">Real-time drain status, alerts, and municipal response overview.</p>
          </div>
          <div className="flex items-center gap-2">
            {isMunicipal && <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">➕ Add Drain</button>}
            <button onClick={() => navigate('/drains/map')} className="btn-secondary text-sm">🗺️ Map View</button>
            <button onClick={() => navigate('/alerts')} className="btn-secondary text-sm">🔔 Alerts</button>
            <button onClick={() => navigate('/drain-echo')} className="btn-primary text-sm">🎙️ Run Drain Echo</button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 flex items-center gap-3">
            <span>⚠️</span>
            <div><p className="font-semibold">Could not load data</p><p className="text-red-500 text-xs mt-0.5">{error}</p></div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          {loading ? [...Array(7)].map((_, i) => <StatSkeleton key={i} />) : (
            <>
              <StatCard icon="🌊" value={summary?.total} label="Monitored Drains" tone="slate" />
              <StatCard icon="✅" value={summary?.normal} label="Normal" tone="green" />
              <StatCard icon="⚠️" value={summary?.warning} label="Warning" tone="amber" />
              <StatCard icon="🔶" value={summary?.high} label="High" tone="orange" />
              <StatCard icon="🚨" value={summary?.critical} label="Critical" tone="red" />
              <StatCard icon="🔔" value={alertSummary?.unacknowledged ?? '—'} label="Active Alerts" tone="red" />
              <StatCard icon="📡" value={summary?.offline} label="Offline Devices" tone="slate" />
            </>
          )}
        </div>

        {openIncidents != null && openIncidents > 0 && (
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-sm text-indigo-800 flex items-center justify-between">
            <span><strong>{openIncidents}</strong> open incident{openIncidents !== 1 ? 's' : ''} in the municipal response queue.</span>
            <button onClick={() => navigate('/incidents')} className="text-indigo-700 font-bold text-xs hover:underline">View Incidents →</button>
          </div>
        )}

        {/* Drain list */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <h2 className="font-display font-bold text-slate-900">Drains</h2>
            <input
              className="input-field text-sm py-1.5 max-w-xs"
              placeholder="Search by ID, name, or ward…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="divide-y divide-slate-50">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 animate-pulse flex items-center gap-4">
                  <div className="h-4 bg-slate-200 rounded w-24" />
                  <div className="h-4 bg-slate-100 rounded w-40 flex-1" />
                  <div className="h-6 bg-slate-100 rounded-full w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <span className="text-3xl block mb-2">🌊</span>
              <p className="text-sm font-medium">No drains found</p>
              <p className="text-xs mt-1">
                {drains.length === 0 ? 'Run `npm run seed:drains` in /backend for demo data.' : 'Try a different search.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map((d) => (
                <div
                  key={d._id}
                  onClick={() => navigate(`/drains/${d._id}`)}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-bold text-slate-400">{d.deviceId}</span>
                      <span className="font-semibold text-sm text-slate-900 truncate">{d.name}</span>
                    </div>
                    <p className="text-xs text-slate-400">{d.ward} · Updated {d.latest?.timestamp ? timeAgo(d.latest.timestamp) : 'never'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                      {d.latest?.waterDepthCm != null ? `${d.latest.waterDepthCm} cm` : '—'}
                    </span>
                    <StatusBadge kind="device" status={d.latest?.deviceStatus} size="sm" />
                    <StatusBadge kind="water" status={d.latest?.waterStatus} />
                    {d.latest?.atmosphereStatus === 'ALERT' && <StatusBadge kind="atmosphere" status="ALERT" size="sm" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {showAdd && (
        <AddDrainModal
          onClose={() => setShowAdd(false)}
          onCreated={(drain) => { setShowAdd(false); navigate(`/drains/${drain._id}`); }}
        />
      )}
    </AdminLayout>
  );
}
