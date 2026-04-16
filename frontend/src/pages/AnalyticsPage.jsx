import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import AdminLayout from '../components/layout/AdminLayout';
import { analyticsAPI } from '../services/api';

const TIMEFRAMES = ['7 Days', 'Last 30 Days', '90 Days'];

const KPICard = ({ icon, label, value, sub, trend, trendUp }) => (
  <div className="card p-5">
    <div className="flex items-start justify-between mb-3">
      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg">{icon}</div>
      {trend && (
        <span className={`text-xs font-bold ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
          {trendUp ? '↑' : '↓'} {trend}
        </span>
      )}
    </div>
    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
    <p className="font-display text-2xl font-bold text-slate-900">{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
);

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [timeframe, setTimeframe] = useState('Last 30 Days');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.getSummary()
      .then(({ data }) => setData(data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const overview = data?.overview;

  const DEPT_EFFICIENCY = data?.departmentEfficiency?.map(d => ({
    department: d._id || 'Other',
    issues: d.count,
    avgSpeed: '1.2 Days',
    status: d.count > 500 ? 'EXCELLENT' : d.count > 200 ? 'STABLE' : 'DELAYED',
  })) || [
    { department: 'Sanitation & Waste', issues: 1240, avgSpeed: '0.8 Days', status: 'EXCELLENT' },
    { department: 'Public Works', issues: 856, avgSpeed: '1.4 Days', status: 'STABLE' },
    { department: 'Traffic Control', issues: 432, avgSpeed: '2.1 Days', status: 'DELAYED' },
  ];

  const STATUS_COLORS = { EXCELLENT: 'bg-green-100 text-green-700', STABLE: 'bg-blue-100 text-blue-700', DELAYED: 'bg-orange-100 text-orange-700' };

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="section-tag mb-1">Executive Overview</p>
            <h1 className="font-display text-3xl font-bold text-slate-900">City Performance Dashboard</h1>
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${
                  timeframe === tf ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tf}
              </button>
            ))}
            <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700">📅</button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            icon="⚠️"
            label="Highest Problem Category"
            value={`${data?.categoryDistribution?.[0]?.category?.replace('_',' ') || 'Illegal Dumping'} (${data?.categoryDistribution?.[0]?.percentage || 42}%)`}
            trend="+12%"
            trendUp={false}
          />
          <KPICard
            icon="✅"
            label="Resolution Rate"
            value={`${overview?.resolutionRate || 89.4}%`}
            sub="All time average"
            trend="+4.2%"
            trendUp
          />
          <KPICard
            icon="⏱️"
            label="Avg Resolution Time"
            value={`${overview?.avgResolutionDays || 1.2} Days`}
            trend="-0.3d"
            trendUp
          />
          <KPICard
            icon="👍"
            label="Citizen Engagement"
            value={`${overview?.citizenEngagement || 9.2} / 10`}
            badge="High"
            trend=""
            trendUp
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Resolution Trends */}
          <div className="lg:col-span-2 card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-slate-900">Resolution Trends</h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-200 rounded-sm"></span> Issues Reported</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-brand-600 rounded-sm"></span> Issues Resolved</span>
              </div>
            </div>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-slate-400">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.weeklyTrend} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="reported" fill="#bfdbfe" radius={[6,6,0,0]} name="Reported" />
                  <Bar dataKey="resolved" fill="#2563eb" radius={[6,6,0,0]} name="Resolved" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category Distribution */}
          <div className="card p-6">
            <h3 className="font-display font-bold text-slate-900 mb-5">Category Distribution</h3>
            <div className="space-y-4">
              {(data?.categoryDistribution?.slice(0, 5) || [
                { category: 'Waste Management', percentage: 42 },
                { category: 'Infrastructure', percentage: 28 },
                { category: 'Public Safety', percentage: 15 },
                { category: 'Utilities', percentage: 10 },
              ]).map(({ category, percentage }, i) => {
                const colors = ['bg-brand-600', 'bg-red-500', 'bg-red-700', 'bg-slate-400', 'bg-green-500'];
                return (
                  <div key={category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700 font-medium capitalize">{category.replace('_', ' ')}</span>
                      <span className="font-bold text-slate-900">{percentage}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full">
                      <div className={`h-full ${colors[i] || 'bg-brand-500'} rounded-full`} style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
              <button className="text-sm text-brand-600 font-semibold mt-2">View Detailed Report →</button>
            </div>
          </div>
        </div>

        {/* Geographic + Departmental */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Geographic Hotspots */}
          <div className="card p-6">
            <h3 className="font-display font-bold text-slate-900 mb-1">Geographic Hotspots</h3>
            <p className="text-xs text-slate-400 mb-4">Top 3 districts with highest report volume</p>
            <div className="relative rounded-2xl overflow-hidden h-48 map-placeholder mb-4">
              <div className="absolute inset-0" style={{
                backgroundImage: `repeating-linear-gradient(0deg, rgba(148,163,184,0.3) 0, rgba(148,163,184,0.3) 1px, transparent 1px, transparent 30px),
                                  repeating-linear-gradient(90deg, rgba(148,163,184,0.3) 0, rgba(148,163,184,0.3) 1px, transparent 1px, transparent 30px)`
              }} />
              {[[35, 30], [60, 55], [40, 70]].map(([t, l], i) => (
                <div key={i} className="absolute" style={{ top: `${t}%`, left: `${l}%` }}>
                  <div className="w-4 h-4 bg-red-500 rounded-full shadow-md" />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {(data?.geographicHotspots || [
                { district: 'Central District', activity: 'High Activity' },
                { district: 'North Industrial', activity: 'Medium' },
              ]).map(({ district, activity }) => (
                <div key={district} className="flex justify-between items-center text-sm">
                  <span className="text-slate-700">{district}</span>
                  <span className={`badge ${activity.includes('High') ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'} text-xs font-bold`}>
                    {activity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Departmental Efficiency */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-slate-900">Departmental Efficiency</h3>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-slate-500 font-semibold">LIVE SYSTEM LOAD: Optimized</span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Department</th>
                  <th className="text-right py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Issues</th>
                  <th className="text-right py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Speed</th>
                  <th className="text-right py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {DEPT_EFFICIENCY.map(({ department, issues, avgSpeed, status }) => (
                  <tr key={department}>
                    <td className="py-3 font-medium text-slate-800">{department}</td>
                    <td className="py-3 text-right text-slate-600">{issues?.toLocaleString()}</td>
                    <td className="py-3 text-right text-slate-600">{avgSpeed}</td>
                    <td className="py-3 text-right">
                      <span className={`badge ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'} text-xs font-bold`}>{status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Insight Banner */}
        <div className="card border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-6 flex items-start gap-5">
          <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xl">🤖</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="badge bg-brand-100 text-brand-700 text-xs font-bold">AI INSIGHT</span>
              <span className="text-xs text-slate-400 font-semibold">Confidence: 98.4%</span>
            </div>
            <h3 className="font-display font-bold text-xl text-slate-900 mb-2">Predictive Issue Detection</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Illegal dumping activity is projected to be{' '}
              <span className="text-red-600 font-bold">15% higher</span> in the{' '}
              <span className="text-brand-700 font-bold">Central District</span> this coming weekend.
              Recommendation: Strategically re-allocate three patrol units from the North Industrial zone to high-probability sectors in Central from Friday 18:00.
            </p>
          </div>
          <button className="btn-primary flex-shrink-0 text-sm">Execute Strategy</button>
        </div>
      </div>
    </AdminLayout>
  );
}
