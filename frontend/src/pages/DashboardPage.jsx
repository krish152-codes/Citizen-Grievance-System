import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import AdminLayout from '../components/layout/AdminLayout';
import { analyticsAPI } from '../services/api';

const StatSkeleton = () => (
  <div className="card p-6 animate-pulse space-y-3">
    <div className="w-10 h-10 bg-slate-200 rounded-xl" />
    <div className="h-8 bg-slate-200 rounded w-20" />
    <div className="h-4 bg-slate-100 rounded w-32" />
  </div>
);

const StatCard = ({ icon, value, label, badge, badgeColor, iconBg }) => (
  <div className="card p-6 flex flex-col gap-3">
    <div className="flex items-start justify-between">
      <div className={`w-10 h-10 ${iconBg || 'bg-blue-50'} rounded-xl flex items-center justify-center text-lg`}>{icon}</div>
      {badge && <span className={`badge text-xs font-bold ${badgeColor || 'bg-slate-100 text-slate-600'}`}>{badge}</span>}
    </div>
    <div>
      <p className="font-display text-3xl font-bold text-slate-900">{value ?? '—'}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </div>
  </div>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    analyticsAPI.getSummary()
      .then(({ data: res }) => setData(res.data))
      .catch(() => setError('Failed to load analytics. Make sure the backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  const ov = data?.overview;

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900 mb-1">City Health Index</h1>
            <p className="text-slate-500 text-sm">
              {ov ? `${ov.totalIssues} total complaints · ${ov.activeIssues} currently active` : 'Real-time overview of civic issues'}
            </p>
          </div>
          {ov && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">✅</div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Resolution Rate</p>
                <p className="font-display text-2xl font-bold text-slate-900">{ov.resolutionRate}%</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 flex items-center gap-3">
            <span>⚠️</span>
            <div><p className="font-semibold">Could not load data</p><p className="text-red-500 text-xs mt-0.5">{error}</p></div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {loading ? [1,2,3].map(i => <StatSkeleton key={i} />) : !ov ? null : (
            <>
              <StatCard icon="💬" iconBg="bg-blue-50" value={ov.totalIssues.toLocaleString()} label="Total Complaints" badge={`+${ov.issuesThisMonth} this month`} badgeColor="bg-blue-100 text-blue-700" />
              <StatCard icon="⚠️" iconBg="bg-orange-50" value={ov.activeIssues.toLocaleString()} label="Active Issues" badge={ov.activeIssues > 0 ? 'Needs Attention' : 'All Clear'} badgeColor={ov.activeIssues > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'} />
              <StatCard icon="✅" iconBg="bg-green-50" value={ov.resolvedIssues.toLocaleString()} label="Resolved Issues" badge={`${ov.resolutionRate}% rate`} badgeColor="bg-green-100 text-green-700" />
            </>
          )}
        </div>

        {!loading && !error && !ov && (
          <div className="card p-12 text-center">
            <span className="text-5xl mb-4 block">📊</span>
            <h3 className="font-display font-bold text-xl text-slate-900 mb-2">No Data Yet</h3>
            <p className="text-slate-500 mb-6">Your dashboard will populate once citizens start submitting reports.</p>
            <button onClick={() => navigate('/report')} className="btn-primary">Submit First Report</button>
          </div>
        )}

        {!loading && ov && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 card p-6">
              <h3 className="font-display font-semibold text-slate-900 mb-4">Weekly Volume Trends</h3>
              {data.weeklyTrend?.some(w => w.reported > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.weeklyTrend} barGap={2}>
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="reported" fill="#bfdbfe" radius={[4,4,0,0]} name="Reported" />
                    <Bar dataKey="resolved" fill="#2563eb" radius={[4,4,0,0]} name="Resolved" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl">
                  <span className="text-3xl mb-2">📈</span>
                  <p className="text-sm">Submit reports to see weekly trends</p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="card p-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Status Breakdown</p>
                {data.statusBreakdown?.length > 0 ? (
                  <div className="space-y-2">
                    {data.statusBreakdown.map(({ _id: status, count }) => (
                      <div key={status} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 capitalize">{status?.replace('_',' ') || 'Unknown'}</span>
                        <span className="font-bold text-slate-900">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-slate-400 text-sm">No status data yet</p>}
              </div>
              <div className="card p-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pending Issues</p>
                <p className="font-display text-3xl font-bold text-slate-900">{ov.pendingIssues}</p>
                <p className="text-xs text-slate-400 mt-1">awaiting assignment</p>
              </div>
            </div>
          </div>
        )}

        {!loading && ov && data?.categoryDistribution?.length > 0 && (
          <div className="card p-6 mb-6">
            <h3 className="font-display font-semibold text-slate-900 mb-5">Category Distribution</h3>
            <div className="space-y-3">
              {data.categoryDistribution.map(({ category, count, percentage }) => (
                <div key={category} className="flex items-center gap-4">
                  <p className="text-sm font-medium text-slate-700 w-36 capitalize">{category?.replace(/_/g,' ') || 'Other'}</p>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all duration-700" style={{ width: `${percentage}%` }} />
                  </div>
                  <div className="text-right w-20">
                    <span className="text-sm font-bold text-slate-800">{percentage}%</span>
                    <span className="text-xs text-slate-400 ml-1">({count})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'View All Issues', icon: '📋', path: '/issues' },
            { label: 'Map View', icon: '🗺️', path: '/map' },
            { label: 'Analytics', icon: '📊', path: '/analytics' },
            { label: 'Manage Users', icon: '👥', path: '/users' },
          ].map(({ label, icon, path }) => (
            <button key={path} onClick={() => navigate(path)} className="card p-4 text-center hover:shadow-md transition-all hover:border-brand-200 group">
              <span className="text-2xl mb-2 block">{icon}</span>
              <p className="text-sm font-semibold text-slate-700 group-hover:text-brand-700">{label}</p>
            </button>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}