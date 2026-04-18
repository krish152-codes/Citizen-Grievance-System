import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import AdminLayout from '../components/layout/AdminLayout';
import { analyticsAPI } from '../services/api';

const TIMEFRAMES = ['7 Days', 'Last 30 Days', '90 Days'];

const KPICard = ({ icon, label, value, sub, loading }) => (
  <div className="card p-5">
    {loading ? (
      <div className="animate-pulse space-y-3">
        <div className="w-10 h-10 bg-slate-200 rounded-xl" />
        <div className="h-4 bg-slate-100 rounded w-24" />
        <div className="h-7 bg-slate-200 rounded w-16" />
      </div>
    ) : (
      <>
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg mb-3">{icon}</div>
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
        <p className="font-display text-2xl font-bold text-slate-900">{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </>
    )}
  </div>
);

const EmptyChart = ({ message }) => (
  <div className="h-48 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
    <span className="text-3xl mb-2">📈</span>
    <p className="text-sm">{message}</p>
  </div>
);

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState('Last 30 Days');

  useEffect(() => {
    setLoading(true);
    analyticsAPI.getSummary()
      .then(({ data: res }) => setData(res.data))
      .catch(() => setError('Failed to load analytics. Ensure the backend is running.'))
      .finally(() => setLoading(false));
  }, [timeframe]);

  const ov = data?.overview;
  const hasData = ov && ov.totalIssues > 0;
  const hasTrend = data?.weeklyTrend?.some(w => w.reported > 0);
  const hasCategories = data?.categoryDistribution?.length > 0;

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="section-tag mb-1">Executive Overview</p>
            <h1 className="font-display text-3xl font-bold text-slate-900">City Performance</h1>
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${timeframe === tf ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{tf}</button>
            ))}
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">⚠️ {error}</div>}

        {!loading && !error && !hasData && (
          <div className="card p-16 text-center">
            <span className="text-5xl mb-4 block">📊</span>
            <h3 className="font-display font-bold text-xl text-slate-900 mb-2">No Analytics Data Yet</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">Analytics will appear once users start submitting issue reports.</p>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard loading={loading} icon="⚠️" label="Top Problem Category" value={hasCategories ? `${data.categoryDistribution[0].category.replace(/_/g,' ')} (${data.categoryDistribution[0].percentage}%)` : 'No data'} />
          <KPICard loading={loading} icon="✅" label="Resolution Rate" value={ov ? `${ov.resolutionRate}%` : '—'} sub={ov ? `${ov.resolvedIssues} of ${ov.totalIssues} issues` : ''} />
          <KPICard loading={loading} icon="⏱️" label="Avg Resolution Time" value={ov ? `${ov.avgResolutionDays} Days` : '—'} />
          <KPICard loading={loading} icon="📥" label="This Month" value={ov ? ov.issuesThisMonth : '—'} sub="new reports" />
        </div>

        {!loading && hasData && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2 card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display font-semibold text-slate-900">Resolution Trends</h3>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-200 rounded-sm" /> Reported</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-brand-600 rounded-sm" /> Resolved</span>
                  </div>
                </div>
                {hasTrend ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.weeklyTrend} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }} />
                      <Bar dataKey="reported" fill="#bfdbfe" radius={[6,6,0,0]} name="Reported" />
                      <Bar dataKey="resolved" fill="#2563eb" radius={[6,6,0,0]} name="Resolved" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart message="Submit reports to see weekly trends" />}
              </div>
              <div className="card p-6">
                <h3 className="font-display font-semibold text-slate-900 mb-5">Category Breakdown</h3>
                {hasCategories ? (
                  <div className="space-y-4">
                    {data.categoryDistribution.slice(0,6).map(({ category, percentage, count }, i) => {
                      const colors = ['bg-brand-600','bg-red-500','bg-orange-500','bg-green-500','bg-purple-500','bg-slate-400'];
                      return (
                        <div key={category}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-700 font-medium capitalize">{category.replace(/_/g,' ')}</span>
                            <span className="font-bold text-slate-900">{percentage}% <span className="text-slate-400 font-normal">({count})</span></span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full">
                            <div className={`h-full ${colors[i] || 'bg-brand-500'} rounded-full`} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <EmptyChart message="No category data yet" />}
              </div>
            </div>

            {data?.departmentEfficiency?.length > 0 && (
              <div className="card p-6 mb-6">
                <h3 className="font-display font-semibold text-slate-900 mb-5">Departmental Breakdown</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr>{['Department','Issues','Share'].map(h => <th key={h} className="text-left py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.departmentEfficiency.map(({ _id: dept, count }) => {
                      const pct = ov.totalIssues > 0 ? ((count / ov.totalIssues) * 100).toFixed(1) : 0;
                      return (
                        <tr key={dept}>
                          <td className="py-3 font-medium text-slate-800">{dept || 'Unknown'}</td>
                          <td className="py-3 text-slate-600">{count}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full max-w-24">
                                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-slate-500 text-xs">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {data?.priorityBreakdown?.length > 0 && (
              <div className="card p-6">
                <h3 className="font-display font-semibold text-slate-900 mb-5">Priority Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {data.priorityBreakdown.map(({ _id: priority, count }) => {
                    const cfg = { critical:{color:'bg-red-100 text-red-700',icon:'🔴'}, high:{color:'bg-orange-100 text-orange-700',icon:'🟠'}, medium:{color:'bg-yellow-100 text-yellow-700',icon:'🟡'}, low:{color:'bg-green-100 text-green-700',icon:'🟢'} }[priority] || {color:'bg-slate-100 text-slate-600',icon:'⚪'};
                    return (
                      <div key={priority} className={`rounded-xl p-4 ${cfg.color}`}>
                        <p className="text-lg mb-1">{cfg.icon}</p>
                        <p className="font-display font-bold text-2xl">{count}</p>
                        <p className="text-xs font-semibold capitalize mt-0.5">{priority} Priority</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}