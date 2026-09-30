import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import StatusBadge from '../components/drain/StatusBadge';
import { WaterLevelCard, AtmosphereCard, DeviceHealthCard } from '../components/drain/SensorCards';
import TrendChart from '../components/drain/TrendChart';
import ArduinoConnect from '../components/drain/ArduinoConnect';
import LiveReadingsChart from '../components/drain/LiveReadingsChart';
import { drainsAPI, drainIncidentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { timeAgo } from '../utils/helpers';

const RANGES = [
  { key: '24h', label: '24 Hours' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
];

function ThresholdEditor({ drain, onSaved }) {
  const [values, setValues] = useState(drain.thresholds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const fields = [
    ['warningCm', 'Warning Threshold', 'cm'],
    ['highCm', 'High Threshold', 'cm'],
    ['criticalCm', 'Critical Threshold', 'cm'],
    ['rapidRiseCmPerMin', 'Rapid Rise Rate', 'cm/min'],
    ['ch4AlertSignal', 'CH₄ Alert Threshold', 'signal'],
    ['h2sAlertSignal', 'H₂S Alert Threshold', 'signal'],
    ['o2LowPercent', 'O₂ Low Threshold', '%'],
    ['offlineTimeoutMin', 'Offline Timeout', 'min'],
  ];

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const { data } = await drainsAPI.updateThresholds(drain._id, values);
      onSaved(data.drain);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update thresholds.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Threshold Configuration</p>
      <p className="text-xs text-slate-400 mb-4">Every drain has its own thresholds — these are not universal physical constants.</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {fields.map(([key, label, unit]) => (
          <div key={key}>
            <label className="label text-[11px]">{label} ({unit})</label>
            <input
              type="number"
              step="any"
              className="input-field text-sm py-1.5"
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      {saved && <p className="text-xs text-green-600 mb-3">✓ Thresholds updated.</p>}

      <button onClick={save} disabled={saving} className="btn-primary w-full text-sm">
        {saving ? 'Saving…' : 'Save Thresholds'}
      </button>

      {drain.thresholdHistory?.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-[11px] font-semibold text-slate-400 mb-1.5">Last changed</p>
          <p className="text-xs text-slate-600">
            {drain.thresholdHistory[drain.thresholdHistory.length - 1].changedByName || 'Unknown'} ·{' '}
            {timeAgo(drain.thresholdHistory[drain.thresholdHistory.length - 1].changedAt)}
          </p>
        </div>
      )}
    </div>
  );
}

export default function DrainDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMunicipal } = useAuth();

  const [drain, setDrain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('24h');
  const [trend, setTrend] = useState(null);
  const [trendLoading, setTrendLoading] = useState(true);

  const loadDrain = useCallback(() => {
    setLoading(true);
    drainsAPI.getById(id)
      .then(({ data }) => setDrain(data.drain))
      .catch(() => setError('Failed to load drain. It may not exist.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Quiet refresh (no skeleton flash) used after each live Arduino reading
  const refreshDrain = useCallback(() => {
    drainsAPI.getById(id).then(({ data }) => setDrain(data.drain)).catch(() => {});
  }, [id]);

  useEffect(() => { loadDrain(); }, [loadDrain]);

  useEffect(() => {
    setTrendLoading(true);
    drainsAPI.getTrends(id, range)
      .then(({ data }) => setTrend(data.trend))
      .catch(() => setTrend([]))
      .finally(() => setTrendLoading(false));
  }, [id, range]);

  const createIncident = async () => {
    try {
      await drainIncidentsAPI.create({ drainId: id, source: 'MANUAL' });
      navigate('/incidents');
    } catch {
      // no-op — surfaced via alert queue instead of blocking this page
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64 animate-pulse" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />)}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !drain) {
    return (
      <AdminLayout>
        <div className="p-12 text-center">
          <span className="text-4xl block mb-3">🌊</span>
          <p className="text-slate-600 font-semibold mb-4">{error || 'Drain not found'}</p>
          <button onClick={() => navigate('/drains')} className="btn-primary">Back to Drains</button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-slate-400">{drain.deviceId}</span>
              <StatusBadge kind="device" status={drain.latest?.deviceStatus} size="sm" />
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900">{drain.name}</h1>
            <p className="text-slate-500 text-sm">{drain.ward} · {drain.zone} · {drain.location?.address}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge kind="water" status={drain.latest?.waterStatus} />
            <button onClick={() => navigate(`/drain-echo?drainId=${drain._id}`)} className="btn-secondary text-sm">🎙️ Drain Echo</button>
            {isMunicipal && <button onClick={createIncident} className="btn-primary text-sm">Create Incident</button>}
          </div>
        </div>

        {drain.latest?.deviceStatus === 'OFFLINE' && (
          <div className="mb-6 p-4 bg-slate-100 border border-slate-200 rounded-2xl text-sm text-slate-700">
            ⚠️ Device offline. Last update {timeAgo(drain.latest.timestamp)} — readings below may be stale.
          </div>
        )}

        {isMunicipal && <ArduinoConnect drain={drain} onPosted={refreshDrain} />}

        {/* Current readings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <WaterLevelCard latest={drain.latest} thresholds={drain.thresholds} />
          <AtmosphereCard latest={drain.latest} />
          <DeviceHealthCard drain={drain} />
        </div>

        {/* Detailed live graphs from raw readings */}
        <LiveReadingsChart drain={drain} />

        {/* Trends */}
        <div className="card p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-slate-900">Trends</h2>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
                    range === r.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-400 mb-2">Water Depth (cm)</p>
          <TrendChart
            data={trend}
            loading={trendLoading}
            series={[
              { key: 'waterDepthCm', name: 'Avg Depth', color: '#2563eb' },
              { key: 'maxWaterDepthCm', name: 'Peak Depth', color: '#ef4444' },
            ]}
          />

          <p className="text-xs font-semibold text-slate-400 mt-6 mb-2">CH₄ / H₂S Signal</p>
          <TrendChart
            data={trend}
            loading={trendLoading}
            height={180}
            series={[
              { key: 'ch4Signal', name: 'CH₄', color: '#7c3aed' },
              { key: 'h2sSignal', name: 'H₂S', color: '#d97706' },
            ]}
          />
        </div>

        {/* Threshold config — municipal only */}
        {isMunicipal && <ThresholdEditor drain={drain} onSaved={setDrain} />}
      </div>
    </AdminLayout>
  );
}
