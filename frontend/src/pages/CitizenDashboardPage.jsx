import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: 'bg-yellow-100 text-yellow-700',  dot: 'bg-yellow-500' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500'   },
  resolved:    { label: 'Resolved',    color: 'bg-green-100 text-green-700',   dot: 'bg-green-500'  },
  rejected:    { label: 'Rejected',    color: 'bg-red-100 text-red-700',       dot: 'bg-red-500'    },
};

const DEPT_ICONS = {
  'Public Works':       '🏗️',
  'Sanitation & Waste': '🗑️',
  'Infrastructure':     '🔧',
  'Public Safety':      '🚔',
  'Parks & Recreation': '🌳',
  'Traffic Management': '🚦',
  'City Planning':      '🏙️',
  'Central Governance': '🏛️',
  'Municipal Corporation': '🏢',
  'Unassigned':         '📋',
};

const HealthRing = ({ score }) => {
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 75 ? 'Good' : score >= 50 ? 'Moderate' : 'Needs Attention';
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold text-slate-900">{score}</span>
          <span className="text-xs text-slate-500 font-medium">/100</span>
        </div>
      </div>
      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
    </div>
  );
};

const StatCard = ({ icon, value, label, color = 'bg-blue-50 text-blue-600', loading }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
    <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-lg flex-shrink-0`}>
      {icon}
    </div>
    {loading ? (
      <>
        <div className="h-8 bg-slate-200 rounded w-16 animate-pulse" />
        <div className="h-3 bg-slate-100 rounded w-24 animate-pulse" />
      </>
    ) : (
      <div>
        <p className="font-display text-3xl font-bold text-slate-900">{value ?? '—'}</p>
        <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      </div>
    )}
  </div>
);

export default function CitizenDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    analyticsAPI.getCitizenSummary()
      .then(({ data }) => setData(data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const city = data?.cityHealth;
  const mine = data?.myComplaints;
  const depts = data?.departmentBreakdown || [];
  const recent = data?.recentComplaints || [];

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top Nav ── */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="font-display font-bold text-slate-900">SheharSetu</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/report')}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
          >
            <span>+</span> Report Issue
          </button>
          <button
            onClick={() => navigate('/track')}
            className="btn-secondary text-sm px-4 py-2"
          >
            Track Complaint
          </button>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">{user?.name}</span>
            <button onClick={logout} className="text-xs text-slate-400 hover:text-red-500 ml-1 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* ── Welcome ── */}
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900 mb-1">
            Hello, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-500 text-sm">
            Here's the health of your city and status of your complaints.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* ── City Health Section ── */}
        <section>
          <h2 className="font-display text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            🏙️ City Health Index
          </h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            {loading ? (
              <div className="flex items-center gap-8 animate-pulse">
                <div className="w-32 h-32 bg-slate-200 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-48" />
                  <div className="h-3 bg-slate-100 rounded w-64" />
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    {[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl" />)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
                <div className="flex-shrink-0">
                  <HealthRing score={city?.score ?? 0} />
                </div>
                <div className="flex-1 w-full">
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Based on <span className="font-semibold text-slate-800">{city?.totalIssues?.toLocaleString()}</span> total complaints citywide.
                    Resolution rate is <span className="font-semibold text-slate-800">{city?.resolutionRate}%</span>.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Resolved',    value: city?.resolvedIssues, color: 'text-green-600 bg-green-50' },
                      { label: 'Active',      value: city?.activeIssues,   color: 'text-blue-600 bg-blue-50'   },
                      { label: 'Pending',     value: city?.pendingIssues,  color: 'text-yellow-600 bg-yellow-50'},
                    ].map(({ label, value, color }) => (
                      <div key={label} className={`rounded-xl p-3 ${color}`}>
                        <p className="font-display text-2xl font-bold">{value?.toLocaleString() ?? '—'}</p>
                        <p className="text-xs font-semibold opacity-80 mt-0.5">{label} Citywide</p>
                      </div>
                    ))}
                  </div>

                  {/* Resolution bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500 font-medium">Resolution Progress</span>
                      <span className="text-xs font-bold text-slate-700">{city?.resolutionRate}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-1000"
                        style={{ width: `${city?.resolutionRate ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── My Complaints Overview ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-slate-800 flex items-center gap-2">
              📋 My Complaints
            </h2>
            <button
              onClick={() => navigate('/track')}
              className="text-sm text-brand-600 font-semibold hover:underline"
            >
              Track by Ticket ID →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon="📊" value={mine?.total}    label="Total Complaints"   color="bg-slate-100 text-slate-600" loading={loading} />
            <StatCard icon="⏳" value={mine?.pending}  label="Pending Review"     color="bg-yellow-50 text-yellow-600" loading={loading} />
            <StatCard icon="⚙️" value={mine?.active}   label="In Progress"        color="bg-blue-50 text-blue-600"    loading={loading} />
            <StatCard icon="✅" value={mine?.resolved} label="Resolved"           color="bg-green-50 text-green-600"  loading={loading} />
          </div>
        </section>

        {/* ── Department Breakdown ── */}
        <section>
          <h2 className="font-display text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            🏢 Complaints by Department
          </h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-slate-200 rounded-lg flex-shrink-0" />
                    <div className="flex-1 h-3 bg-slate-200 rounded-full" />
                    <div className="w-8 h-4 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : depts.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-slate-500 text-sm">You haven't filed any complaints yet.</p>
                <button
                  onClick={() => navigate('/report')}
                  className="btn-primary mt-4 text-sm px-5 py-2"
                >
                  Report Your First Issue
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {depts.map(({ department, count }) => {
                  const pct = mine?.total > 0 ? Math.round((count / mine.total) * 100) : 0;
                  const icon = DEPT_ICONS[department] || '📋';
                  return (
                    <div key={department} className="flex items-center gap-4">
                      <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-base flex-shrink-0">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-slate-700 truncate">{department}</p>
                          <span className="text-sm font-bold text-slate-900 ml-2 flex-shrink-0">
                            {count} complaint{count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── Recent Complaints ── */}
        {!loading && recent.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              🕐 Recent Complaints
            </h2>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {recent.map((issue) => {
                  const st = STATUS_CONFIG[issue.status] || STATUS_CONFIG.pending;
                  return (
                    <div key={issue._id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${st.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 truncate">{issue.title}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${st.color}`}>
                            {st.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-slate-400 font-mono">{issue.ticketId}</span>
                          <span className="text-xs text-slate-400">{issue.department || 'Unassigned'}</span>
                          <span className="text-xs text-slate-400">{formatDate(issue.createdAt)}</span>
                          {issue.emergencyFlag && (
                            <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">🚨 Emergency</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Quick Actions ── */}
        <section>
          <h2 className="font-display text-xl font-bold text-slate-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/report')}
              className="bg-brand-600 hover:bg-brand-700 text-white rounded-2xl p-5 text-left transition-colors group"
            >
              <div className="text-2xl mb-2">📸</div>
              <p className="font-bold text-base mb-1">Report a New Issue</p>
              <p className="text-brand-200 text-sm">Photo + AI classification in seconds</p>
            </button>
            <button
              onClick={() => navigate('/track')}
              className="bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left transition-colors"
            >
              <div className="text-2xl mb-2">🔍</div>
              <p className="font-bold text-base mb-1 text-slate-900">Track a Complaint</p>
              <p className="text-slate-500 text-sm">Enter your ticket ID to check status</p>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
