import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * Reusable trend chart for drain sensor history.
 * `series` = [{ key: 'waterDepthCm', name: 'Water Depth (cm)', color: '#2563eb' }, ...]
 * `data`   = array of bucket objects (from GET /api/drains/:id/trends)
 */
export default function TrendChart({ data, series, loading, height = 220, unit = '' }) {
  if (loading) {
    return <div className="w-full animate-pulse bg-slate-100 rounded-xl" style={{ height }} />;
  }
  if (!data || data.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center text-center bg-slate-50 rounded-xl" style={{ height }}>
        <span className="text-2xl mb-1">📈</span>
        <p className="text-sm font-medium text-slate-500">Not enough data for this time period.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit={unit} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
          labelStyle={{ fontWeight: 700, color: '#334155' }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
