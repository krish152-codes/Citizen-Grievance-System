import React from 'react';
import StatusBadge from './StatusBadge';
import { timeAgo } from '../../utils/helpers';

// ── Water Level ────────────────────────────────────────
export function WaterLevelCard({ latest, thresholds }) {
  if (!latest) return null;
  const fillPct = Math.min(100, Math.max(0, latest.waterFillPct ?? 0));

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-lg">💧</span>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Water Level</p>
            <p className="font-display text-2xl font-bold text-slate-900">
              {latest.waterDepthCm != null ? `${latest.waterDepthCm} cm` : '—'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge kind="water" status={latest.waterStatus} />
          {latest.rapidRise && <StatusBadge kind="water" status="RAPID_RISE" size="sm" />}
        </div>
      </div>

      {/* Fill bar */}
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all ${
            latest.waterStatus === 'CRITICAL' ? 'bg-red-500'
            : latest.waterStatus === 'HIGH' ? 'bg-orange-500'
            : latest.waterStatus === 'WARNING' ? 'bg-amber-500' : 'bg-green-500'
          }`}
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{fillPct.toFixed(0)}% fill</span>
        {thresholds && <span>Critical at {thresholds.criticalCm} cm</span>}
      </div>
      <p className="text-[11px] text-slate-400 mt-2">Updated {latest.timestamp ? timeAgo(latest.timestamp) : 'never'}</p>
    </div>
  );
}

// ── Rain / Surface Wetness + Atmosphere (CH4 / H2S / O2) ──
export function AtmosphereCard({ latest }) {
  if (!latest) return null;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center text-lg">🌬️</span>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Atmospheric Status</p>
        </div>
        <StatusBadge kind="atmosphere" status={latest.atmosphereStatus} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="p-3 bg-slate-50 rounded-xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rain / Surface Wetness</p>
          <p className="text-sm font-bold text-slate-800">
            {latest.rainWetness === 'DETECTED' ? '🌧️ Detected' : 'Not Detected'}
          </p>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CH₄ (Methane)</p>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">{latest.ch4Signal?.toFixed(2) ?? '—'}</p>
            <StatusBadge kind="atmosphere" status={latest.ch4Status} size="sm" />
          </div>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">H₂S (Hydrogen Sulfide)</p>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">{latest.h2sSignal?.toFixed(2) ?? '—'}</p>
            <StatusBadge kind="atmosphere" status={latest.h2sStatus} size="sm" />
          </div>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">O₂ (Oxygen)</p>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">
              {latest.o2Status === 'NOT_INSTALLED' ? 'Not Installed' : `${latest.o2Percent ?? '—'}%`}
            </p>
            <StatusBadge kind="atmosphere" status={latest.o2Status} size="sm" />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-100 pt-2">
        Prototype MQ-series sensors provide demo/indicative readings only — not a substitute for
        calibrated professional confined-space gas monitoring.
      </p>
    </div>
  );
}

// ── Device Health ──────────────────────────────────────
export function DeviceHealthCard({ drain }) {
  if (!drain) return null;
  const health = drain.calibration?.sensorHealth || {};
  const rows = [
    ['Ultrasonic (Water Level)', health.ultrasonic],
    ['Rain Sensor', health.rain],
    ['CH₄ Sensor', health.ch4],
    ['H₂S Sensor', health.h2s],
    ['O₂ Sensor', health.o2],
  ];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-lg">🛰️</span>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Device Health</p>
        </div>
        <StatusBadge kind="device" status={drain.latest?.deviceStatus} />
      </div>

      <p className="text-xs text-slate-500 mb-3">
        Last update: <span className="font-semibold text-slate-700">{drain.latest?.timestamp ? timeAgo(drain.latest.timestamp) : 'never'}</span>
        {drain.latest?.deviceStatus === 'OFFLINE' && (
          <span className="block text-red-600 font-semibold mt-1">⚠️ Device offline — readings below may be stale.</span>
        )}
      </p>

      <div className="space-y-1.5">
        {rows.map(([label, status]) => (
          <div key={label} className="flex items-center justify-between text-xs py-1">
            <span className="text-slate-500">{label}</span>
            <span className={`font-semibold ${
              status === 'HEALTHY' ? 'text-green-600'
              : status === 'FAULT' ? 'text-red-600'
              : 'text-slate-400'
            }`}>
              {status === 'NOT_INSTALLED' ? 'Not Installed' : status === 'UNKNOWN' || !status ? 'Unknown' : status === 'HEALTHY' ? 'Healthy' : 'Fault'}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100 text-[11px]">
        <div>
          <p className="text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Last Calibration</p>
          <p className="text-slate-700 font-medium">
            {drain.calibration?.lastCalibratedAt ? new Date(drain.calibration.lastCalibratedAt).toLocaleDateString('en-IN') : 'Not recorded'}
          </p>
        </div>
        <div>
          <p className="text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Last Maintenance</p>
          <p className="text-slate-700 font-medium">
            {drain.calibration?.lastMaintenanceAt ? new Date(drain.calibration.lastMaintenanceAt).toLocaleDateString('en-IN') : 'Not recorded'}
          </p>
        </div>
      </div>
    </div>
  );
}
