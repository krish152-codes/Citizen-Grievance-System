import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import { issuesAPI, analyticsAPI } from '../services/api';
import { getPriorityBadge, timeAgo, truncate } from '../utils/helpers';

const FILTERS = ['All Issues', 'Infrastructure', 'Sanitation', 'Traffic', 'Water'];

export default function MapViewPage() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All Issues');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const categoryMap = { 'Infrastructure':'infrastructure','Sanitation':'waste','Traffic':'traffic','Water':'water' };
    const params = { limit: 30 };
    if (activeFilter !== 'All Issues') params.category = categoryMap[activeFilter];
    setLoading(true);
    Promise.all([issuesAPI.getAll(params), analyticsAPI.getSummary()])
      .then(([issueRes, analyticsRes]) => {
        setIssues(issueRes.data.issues);
        setStats(analyticsRes.data.data?.overview);
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }, [activeFilter]);

  return (
    <AdminLayout>
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 relative overflow-hidden bg-slate-200">
          <div className="absolute top-4 left-4 z-10 space-y-3">
            <div className="bg-white rounded-2xl shadow-lg p-4 border border-slate-100 min-w-40">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Issues</p>
              {loading ? <div className="h-8 bg-slate-200 rounded animate-pulse w-16 mt-1" /> : <p className="font-display text-3xl font-bold text-slate-900">{stats?.activeIssues ?? '—'}</p>}
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-4 border border-slate-100 min-w-40">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Resolution Rate</p>
              {loading ? <div className="h-8 bg-slate-200 rounded animate-pulse w-16 mt-1" /> : <p className="font-display text-3xl font-bold text-slate-900">{stats?.resolutionRate != null ? `${stats.resolutionRate}%` : '—'}</p>}
            </div>
          </div>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)' }}>
            <div className="absolute inset-0" style={{ backgroundImage: `repeating-linear-gradient(0deg, rgba(148,163,184,0.25) 0, rgba(148,163,184,0.25) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(148,163,184,0.25) 0, rgba(148,163,184,0.25) 1px, transparent 1px, transparent 40px)` }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 p-8 text-center shadow-xl max-w-sm">
              <span className="text-4xl mb-3 block">🗺️</span>
              <h3 className="font-display font-bold text-lg text-slate-900 mb-2">Interactive Map</h3>
              <p className="text-slate-500 text-sm leading-relaxed">Map integration (Mapbox/Google Maps) will be connected in the next step. Issue data is loading from your real database.</p>
              {!loading && issues.length > 0 && (
                <p className="mt-3 text-xs font-bold text-brand-700 bg-brand-50 rounded-lg px-3 py-2">{issues.length} real issues loaded from DB</p>
              )}
              {!loading && issues.length === 0 && (
                <p className="mt-3 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">No issues in database yet</p>
              )}
            </div>
          </div>
          <div className="absolute bottom-6 left-4 flex flex-col gap-2 z-10">
            {['+','−','🎯'].map(icon => (
              <button key={icon} className="w-9 h-9 bg-white rounded-xl shadow-md flex items-center justify-center text-slate-600 hover:bg-slate-50 border border-slate-200 font-bold text-sm">{icon}</button>
            ))}
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg border border-slate-100 px-4 py-2 flex items-center gap-4 z-10">
            {[['bg-red-500','Critical'],['bg-orange-500','High'],['bg-blue-500','Medium'],['bg-slate-400','Low']].map(([bg,label]) => (
              <span key={label} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span className={`w-2.5 h-2.5 rounded-full ${bg}`} />{label}
              </span>
            ))}
          </div>
        </div>
        <div className="w-80 bg-white border-l border-slate-100 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h3 className="font-display font-bold text-slate-900">Recent Incidents</h3>
            {!loading && <span className="text-xs text-slate-400 font-semibold">{issues.length} loaded</span>}
          </div>
          <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-slate-100 scrollbar-thin">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setActiveFilter(f)} className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all ${activeFilter === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{f}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-slate-50">
            {loading ? [...Array(4)].map((_,i) => (
              <div key={i} className="p-4 animate-pulse space-y-2">
                <div className="h-3 bg-slate-100 rounded w-1/4" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-full" />
              </div>
            )) : error ? (
              <div className="p-6 text-center text-red-500 text-sm">{error}</div>
            ) : issues.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <span className="text-3xl block mb-2">📭</span>
                <p className="text-sm font-medium">No issues found</p>
                <p className="text-xs mt-1">{activeFilter !== 'All Issues' ? 'Try a different filter' : 'Submit the first report to see it here'}</p>
              </div>
            ) : issues.map(issue => {
              const pri = getPriorityBadge(issue.priority);
              return (
                <div key={issue._id} onClick={() => navigate(`/issues/${issue._id}`)} className="p-4 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`badge ${pri.color} text-[10px] font-bold uppercase`}>{issue.priority}</span>
                    <span className="text-[10px] text-slate-400">{timeAgo(issue.createdAt)}</span>
                  </div>
                  <p className="font-semibold text-sm text-slate-900 mb-1 leading-tight">{issue.title}</p>
                  <p className="text-xs text-slate-500 mb-2">{truncate(issue.description, 70)}</p>
                  {issue.location?.address && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeWidth="2"/><circle cx="12" cy="10" r="3" strokeWidth="2"/></svg>
                      {truncate(issue.location.address, 40)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="p-4 border-t border-slate-100">
            <button onClick={() => navigate('/analytics')} className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">View Analytics Report →</button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}