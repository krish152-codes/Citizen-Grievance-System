import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import AdminLayout from '../components/layout/AdminLayout';
import { analyticsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const StatCard = ({ icon, value, label, badge, sub, color = 'bg-blue-50 text-blue-600' }) => (
  <div className="card p-6 flex flex-col gap-3">
    <div className="flex items-start justify-between">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-lg`}>{icon}</div>
      {badge && (
        <span className={`badge text-xs font-bold ${
          badge.includes('High') || badge.includes('critical') ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
        }`}>{badge}</span>
      )}
      {sub && <span className="text-xs text-slate-400 font-semibold">{sub}</span>}
    </div>
    <div>
      <p className="font-display text-3xl font-bold text-slate-900">{value?.toLocaleString() ?? '—'}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </div>
  </div>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.getSummary()
      .then(({ data }) => setData(data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const overview = data?.overview;

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex-1">
            <h1 className="font-display text-4xl font-bold text-slate-900 mb-2">City Health Index</h1>
            <p className="text-slate-500 max-w-lg">
              Real-time analysis of urban metabolic functions across 12 sectors.
              {data?.overview?.activeIssues > 30 && ' Currently observing elevated response times in Sector 4.'}
            </p>
          </div>
          <div className="flex-shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Efficiency</p>
              <p className="font-display text-2xl font-bold text-slate-900">
                {loading ? '—' : `${overview?.efficiencyScore}%`}
              </p>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {[1,2,3].map(i => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="w-10 h-10 bg-slate-200 rounded-xl mb-3" />
                <div className="h-8 bg-slate-200 rounded w-24 mb-2" />
                <div className="h-4 bg-slate-100 rounded w-32" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <StatCard
              icon="💬"
              value={overview?.totalIssues}
              label="Total Complaints"
              badge={`+${Math.round((overview?.issuesThisMonth / overview?.totalIssues) * 100)}% vs LY`}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              icon="⚠️"
              value={overview?.activeIssues}
              label="Active Issues"
              badge="High Priority"
              color="bg-orange-50 text-orange-600"
            />
            <StatCard
              icon="✅"
              value={overview?.resolvedIssues}
              label="Resolved Issues"
              sub={`Avg ${overview?.avgResolutionDays}d`}
              color="bg-green-50 text-green-600"
            />
          </div>
        )}

        {/* Map + Volume Trends row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Map placeholder */}
          <div className="lg:col-span-2 card overflow-hidden relative" style={{ minHeight: 360 }}>
            {/* Fake map grid */}
            <div className="absolute inset-0 map-placeholder opacity-50" />
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(0deg, rgba(148,163,184,0.3) 0, rgba(148,163,184,0.3) 1px, transparent 1px, transparent 40px),
                                repeating-linear-gradient(90deg, rgba(148,163,184,0.3) 0, rgba(148,163,184,0.3) 1px, transparent 1px, transparent 40px)`
            }} />

            {/* Marker dots */}
            <div className="absolute" style={{ top: '45%', left: '50%' }}>
              <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">42</div>
            </div>
            <div className="absolute" style={{ top: '63%', left: '35%' }}>
              <div className="w-5 h-5 bg-red-500 rounded-full shadow-md" />
            </div>

            {/* Zone popup */}
            <div className="absolute top-4 left-4 bg-white rounded-2xl shadow-xl p-4 w-52">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <p className="text-xs text-brand-600 font-bold uppercase tracking-wider">Live Zone Status</p>
              </div>
              <p className="font-display font-bold text-lg text-slate-900">Zone B-4</p>
              <div className="flex gap-1 my-2">
                {[2, 4, 3, 5, 4, 3].map((h, i) => (
                  <div key={i} className="flex-1 bg-brand-200 rounded-sm" style={{ height: h * 6 }} />
                ))}
              </div>
              <p className="text-xs text-slate-500">Response spike detected in grid 14.</p>
            </div>
          </div>

          {/* Volume Trends + AI Suggestion */}
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Volume Trends</p>
                <button className="text-slate-400 hover:text-slate-600">···</button>
              </div>
              {data?.weeklyTrend && (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={data.weeklyTrend} barGap={2}>
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11 }}
                    />
                    <Bar dataKey="reported" fill="#bfdbfe" radius={[4, 4, 0, 0]} name="Reported" />
                    <Bar dataKey="resolved" fill="#2563eb" radius={[4, 4, 0, 0]} name="Resolved" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* AI Suggestion */}
            <div className="bg-brand-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-brand-200">✨</span>
                <p className="text-xs font-bold text-brand-100 uppercase tracking-wider">AI Assistant Suggestion</p>
              </div>
              <p className="text-sm leading-relaxed text-brand-50">
                "Redeploy maintenance units to South Sector. Infrastructure fatigue predicted at 88% by Thursday."
              </p>
              <button className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold text-white transition-colors">
                Execute Strategy →
              </button>
            </div>
          </div>
        </div>

        {/* Category Distribution */}
        {data?.categoryDistribution && (
          <div className="card p-6">
            <h3 className="font-display font-bold text-slate-900 mb-5">Category Distribution</h3>
            <div className="space-y-3">
              {data.categoryDistribution.slice(0, 6).map(({ category, count, percentage }) => (
                <div key={category} className="flex items-center gap-4">
                  <p className="text-sm font-medium text-slate-700 w-36 capitalize">{category.replace('_', ' ')}</p>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-sm font-bold text-slate-800 w-10 text-right">{percentage}%</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
