import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ComposedChart, AreaChart, LineChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { drainsAPI } from '../../services/api';

const RANGES = [
  { key: '5m',  label: '5 min',  ms: 5 * 60 * 1000 },
  { key: '15m', label: '15 min', ms: 15 * 60 * 1000 },
  { key: '1h',  label: '1 hour', ms: 60 * 60 * 1000 },
];
const PAGE_SIZE = 200;   // backend max per request
const MAX_PAGES = 5;     // ≤ 1000 raw readings per load
const POLL_MS = 5000;

const fmtTime = (t) => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtShort = (t) => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const toPoint = (r) => ({
  t: new Date(r.timestamp).getTime(),
  depth: r.waterDepthCm ?? null,
  fill: r.waterFillPct ?? null,
  ch4: r.ch4Signal ?? null,
  h2s: r.h2sSignal ?? null,
  rain: r.rainWetness === 'DETECTED' ? 1 : 0,
  status: r.waterStatus,
});

const tooltipStyle = { contentStyle: { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }, labelStyle: { fontWeight: 700, color: '#334155' } };
const axisTick = { fontSize: 10, fill: '#94a3b8' };

function Stat({ label, value, sub, tone = 'text-slate-900' }) {
  return (
    <div className="p-3 bg-slate-50 rounded-xl">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`font-display text-lg font-bold ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}

export default function LiveReadingsChart({ drain }) {
  const [range, setRange] = useState('15m');
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState(true);
  const pointsRef = useRef([]);
  const th = drain.thresholds || {};

  const merge = useCallback((incoming) => {
    const map = new Map(pointsRef.current.map((p) => [p.t, p]));
    incoming.forEach((p) => map.set(p.t, p));
    const merged = [...map.values()].sort((a, b) => a.t - b.t);
    pointsRef.current = merged;
    setPoints(merged);
  }, []);

  // Full load for the chosen range (pages back until the range is covered)
  useEffect(() => {
    let cancelled = false;
    const rangeMs = RANGES.find((r) => r.key === range).ms;
    setLoading(true); setError('');
    (async () => {
      try {
        let all = [];
        for (let page = 1; page <= MAX_PAGES; page++) {
          const { data } = await drainsAPI.getReadings(drain._id, { page, limit: PAGE_SIZE });
          const batch = data.readings.map(toPoint);
          all = all.concat(batch);
          const newest = Math.max(...all.map((p) => p.t));
          const oldest = Math.min(...all.map((p) => p.t));
          if (batch.length < PAGE_SIZE || newest - oldest >= rangeMs) break;
        }
        if (!cancelled) { pointsRef.current = []; merge(all); }
      } catch {
        if (!cancelled) setError('Could not load sensor readings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [drain._id, range, merge]);

  // Live polling: only the newest few readings, merged into what we have
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const { data } = await drainsAPI.getReadings(drain._id, { page: 1, limit: 30 });
        merge(data.readings.map(toPoint));
      } catch { /* keep showing what we have */ }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [drain._id, live, merge]);

  // Window is anchored to the newest reading, so an idle device still shows its last session
  const data = useMemo(() => {
    if (!points.length) return [];
    const rangeMs = RANGES.find((r) => r.key === range).ms;
    const newest = points[points.length - 1].t;
    return points.filter((p) => p.t >= newest - rangeMs);
  }, [points, range]);

  const stats = useMemo(() => {
    if (!data.length) return null;
    const depths = data.map((p) => p.depth).filter((v) => v != null);
    const ch4 = data.map((p) => p.ch4).filter((v) => v != null);
    const h2s = data.map((p) => p.h2s).filter((v) => v != null);
    const last = data[data.length - 1];
    const first = data[0];
    const minutes = (last.t - first.t) / 60000;
    const trendPerMin = minutes > 0 && last.depth != null && first.depth != null ? (last.depth - first.depth) / minutes : 0;
    return {
      latest: last.depth,
      min: Math.min(...depths),
      max: Math.max(...depths),
      avg: depths.reduce((a, b) => a + b, 0) / depths.length,
      trendPerMin,
      ch4Max: ch4.length ? Math.max(...ch4) : null,
      h2sMax: h2s.length ? Math.max(...h2s) : null,
      rainPct: (data.filter((p) => p.rain).length / data.length) * 100,
      count: data.length,
      spanMin: minutes,
    };
  }, [data]);

  const xAxis = (
    <XAxis
      dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']}
      tickFormatter={fmtShort} tick={axisTick} tickLine={false} axisLine={{ stroke: '#e2e8f0' }}
      minTickGap={40}
    />
  );
  const showDots = data.length <= 60 ? { r: 2.5 } : false;

  return (
    <div className="card p-5 mb-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="font-display font-bold text-slate-900">Live Sensor Graphs</h2>
          <p className="text-xs text-slate-400">
            Raw readings from the device{live ? ' · updating every 5 s' : ' · paused'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${range === r.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={() => setLive((v) => !v)} className="btn-secondary text-xs">
            {live ? '⏸ Pause' : '▶ Resume'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-72 bg-slate-100 rounded-xl animate-pulse" />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : data.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-center bg-slate-50 rounded-xl">
          <span className="text-2xl mb-1">📈</span>
          <p className="text-sm font-medium text-slate-500">No readings saved for this drain yet.</p>
          <p className="text-xs text-slate-400 mt-1">Click “Connect Arduino” above — the graph fills in every 5 seconds.</p>
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-5">
            <Stat label="Current" value={`${stats.latest?.toFixed(1)} cm`} />
            <Stat label="Peak" value={`${stats.max.toFixed(1)} cm`} tone="text-red-600" />
            <Stat label="Lowest" value={`${stats.min.toFixed(1)} cm`} />
            <Stat label="Average" value={`${stats.avg.toFixed(1)} cm`} />
            <Stat
              label="Rate" value={`${stats.trendPerMin >= 0 ? '+' : ''}${stats.trendPerMin.toFixed(2)}`} sub="cm / min"
              tone={stats.trendPerMin >= (th.rapidRiseCmPerMin ?? Infinity) ? 'text-red-600' : 'text-slate-900'}
            />
            <Stat label="CH₄ peak" value={stats.ch4Max?.toFixed(2) ?? '—'} tone={stats.ch4Max >= th.ch4AlertSignal ? 'text-red-600' : 'text-slate-900'} />
            <Stat label="H₂S peak" value={stats.h2sMax?.toFixed(2) ?? '—'} tone={stats.h2sMax >= th.h2sAlertSignal ? 'text-red-600' : 'text-slate-900'} />
            <Stat label="Rain" value={`${stats.rainPct.toFixed(0)}%`} sub={`${stats.count} readings · ${stats.spanMin.toFixed(1)} min`} />
          </div>

          {/* 1 — Water depth + fill % with threshold lines */}
          <p className="text-xs font-semibold text-slate-400 mb-2">Water Depth (cm) &amp; Fill (%)</p>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="depthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              {xAxis}
              <YAxis yAxisId="cm" tick={axisTick} tickLine={false} axisLine={false} unit=" cm" domain={[0, (max) => Math.ceil(Math.max(max, th.criticalCm ?? 0) * 1.05)]} />
              <YAxis yAxisId="pct" orientation="right" tick={axisTick} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
              <Tooltip {...tooltipStyle} labelFormatter={fmtTime}
                formatter={(v, name) => [name === 'Fill' ? `${Number(v).toFixed(1)} %` : `${Number(v).toFixed(1)} cm`, name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {th.warningCm != null && <ReferenceLine yAxisId="cm" y={th.warningCm} stroke="#f59e0b" strokeDasharray="5 4" label={{ value: `Warning ${th.warningCm}`, fontSize: 10, fill: '#b45309', position: 'insideTopLeft' }} />}
              {th.highCm != null && <ReferenceLine yAxisId="cm" y={th.highCm} stroke="#f97316" strokeDasharray="5 4" label={{ value: `High ${th.highCm}`, fontSize: 10, fill: '#c2410c', position: 'insideTopLeft' }} />}
              {th.criticalCm != null && <ReferenceLine yAxisId="cm" y={th.criticalCm} stroke="#ef4444" strokeDasharray="5 4" label={{ value: `Critical ${th.criticalCm}`, fontSize: 10, fill: '#b91c1c', position: 'insideTopLeft' }} />}
              <Area yAxisId="cm" type="monotone" dataKey="depth" name="Depth" stroke="#2563eb" strokeWidth={2} fill="url(#depthFill)" dot={showDots} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
              <Line yAxisId="pct" type="monotone" dataKey="fill" name="Fill" stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="2 3" dot={false} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* 2 — Gas signals with alert thresholds */}
          <p className="text-xs font-semibold text-slate-400 mt-6 mb-2">Gas Signals — CH₄ &amp; H₂S (0–1 scale)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              {xAxis}
              <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={[0, 1]} />
              <Tooltip {...tooltipStyle} labelFormatter={fmtTime} formatter={(v, name) => [Number(v).toFixed(3), name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {th.ch4AlertSignal != null && <ReferenceLine y={th.ch4AlertSignal} stroke="#7c3aed" strokeDasharray="5 4" strokeOpacity={0.6} label={{ value: 'CH₄ alert', fontSize: 10, fill: '#6d28d9', position: 'insideTopRight' }} />}
              {th.h2sAlertSignal != null && th.h2sAlertSignal !== th.ch4AlertSignal && <ReferenceLine y={th.h2sAlertSignal} stroke="#d97706" strokeDasharray="5 4" strokeOpacity={0.6} label={{ value: 'H₂S alert', fontSize: 10, fill: '#b45309', position: 'insideBottomRight' }} />}
              <Line type="monotone" dataKey="ch4" name="CH₄" stroke="#7c3aed" strokeWidth={2} dot={showDots} connectNulls isAnimationActive={false} />
              <Line type="monotone" dataKey="h2s" name="H₂S" stroke="#d97706" strokeWidth={2} dot={showDots} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>

          {/* 3 — Rain / surface wetness timeline */}
          <p className="text-xs font-semibold text-slate-400 mt-6 mb-2">Rain / Surface Wetness</p>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              {xAxis}
              <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={[0, 1]} ticks={[0, 1]} tickFormatter={(v) => (v ? 'Wet' : 'Dry')} width={40} />
              <Tooltip {...tooltipStyle} labelFormatter={fmtTime} formatter={(v) => [v ? 'Detected' : 'Not detected', 'Rain']} />
              <Area type="stepAfter" dataKey="rain" stroke="#0284c7" strokeWidth={1.5} fill="#38bdf8" fillOpacity={0.35} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
