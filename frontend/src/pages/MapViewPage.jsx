import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { issuesAPI } from '../services/api';
import { getPriorityBadge, timeAgo, truncate } from '../utils/helpers';

const FILTERS = ['All Issues', 'Infrastructure', 'Sanitation', 'Traffic', 'Water'];

const PRIORITY_DOT = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
};

export default function MapViewPage() {
  const [issues, setIssues] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All Issues');
  const [heatmap, setHeatmap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);

  useEffect(() => {
    issuesAPI.getAll({ limit: 20 })
      .then(({ data }) => setIssues(data.issues))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Mock map pins
  const PINS = [
    { id: 1, top: '42%', left: '50%', count: 42, priority: 'critical' },
    { id: 2, top: '65%', left: '32%', count: 12, priority: 'high' },
  ];

  return (
    <AdminLayout>
      <div className="flex h-full">
        {/* Sidebar nav */}
        <div className="w-52 bg-white border-r border-slate-100 flex flex-col">
          <div className="p-4 border-b border-slate-100">
            <div className="mb-1">
              <p className="font-display font-bold text-brand-600 text-sm">CityPulse AI</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Urban Intelligence</p>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-0.5">
            {['Live Map', 'Issue Tracker', 'Analytics', 'Citizen Portal', 'Admin Console'].map((item) => (
              <button
                key={item}
                className={`sidebar-link w-full text-left text-xs ${item === 'Live Map' ? 'active' : ''}`}
              >
                <span className="w-4 h-4 flex items-center justify-center opacity-60">
                  {item === 'Live Map' ? '🗺️' : item === 'Issue Tracker' ? '📋' : item === 'Analytics' ? '📊' : item === 'Citizen Portal' ? '👤' : '⚙️'}
                </span>
                {item}
              </button>
            ))}
          </nav>
          <div className="p-3 space-y-0.5 border-t border-slate-100 text-xs">
            <button className="sidebar-link w-full text-left">❓ Help</button>
            <button className="sidebar-link w-full text-left text-red-500">↩ Logout</button>
          </div>
        </div>

        {/* Map area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Top stats overlay */}
          <div className="absolute top-4 left-4 z-10 space-y-3">
            <div className="bg-white rounded-2xl shadow-lg p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Issues</p>
              <div className="flex items-center gap-2">
                <p className="font-display text-3xl font-bold text-slate-900">1,284</p>
                <span className="text-red-500 text-xs font-bold flex items-center gap-0.5">
                  ↑12%
                </span>
              </div>
              <div className="h-0.5 w-16 bg-brand-600 mt-2 rounded-full" />
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Resolution Rate</p>
              <p className="font-display text-3xl font-bold text-slate-900">89.4%</p>
            </div>
          </div>

          {/* Map background */}
          <div className="absolute inset-0 map-placeholder">
            <div
              className={`absolute inset-0 transition-opacity duration-500 ${heatmap ? 'opacity-100' : 'opacity-0'}`}
              style={{
                background: 'radial-gradient(ellipse 40% 30% at 52% 44%, rgba(239,68,68,0.4) 0%, transparent 70%), radial-gradient(ellipse 25% 20% at 33% 65%, rgba(249,115,22,0.3) 0%, transparent 70%)',
              }}
            />
          </div>
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(0deg, rgba(148,163,184,0.2) 0, rgba(148,163,184,0.2) 1px, transparent 1px, transparent 40px),
                              repeating-linear-gradient(90deg, rgba(148,163,184,0.2) 0, rgba(148,163,184,0.2) 1px, transparent 1px, transparent 40px)`
          }} />

          {/* Map pins */}
          {PINS.map(({ id, top, left, count, priority }) => (
            <div key={id} className="absolute z-10 transform -translate-x-1/2 -translate-y-1/2" style={{ top, left }}>
              <div className={`w-10 h-10 ${priority === 'critical' ? 'bg-brand-600' : 'bg-orange-500'} rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg cursor-pointer hover:scale-110 transition-transform`}>
                {count}
              </div>
            </div>
          ))}

          {/* Map controls */}
          <div className="absolute bottom-6 left-4 flex flex-col gap-2 z-10">
            <button className="w-9 h-9 bg-white rounded-xl shadow-md flex items-center justify-center text-slate-600 hover:bg-slate-50 border border-slate-200 font-bold">+</button>
            <button className="w-9 h-9 bg-white rounded-xl shadow-md flex items-center justify-center text-slate-600 hover:bg-slate-50 border border-slate-200 font-bold">−</button>
            <button className="w-9 h-9 bg-white rounded-xl shadow-md flex items-center justify-center text-slate-600 hover:bg-slate-50 border border-slate-200">🎯</button>
            <button
              onClick={() => setHeatmap(!heatmap)}
              className={`w-9 h-9 rounded-xl shadow-md flex items-center justify-center border border-slate-200 transition-colors ${heatmap ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              title="Toggle heatmap"
            >🔥</button>
            <button className="w-9 h-9 bg-white rounded-xl shadow-md flex items-center justify-center text-slate-600 hover:bg-slate-50 border border-slate-200">🗂️</button>
          </div>

          {/* Legend */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg border border-slate-100 px-4 py-2 flex items-center gap-4 z-10">
            {[['bg-red-500', 'Critical'], ['bg-orange-500', 'Moderate'], ['bg-blue-500', 'Low']].map(([bg, label]) => (
              <span key={label} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span className={`w-2.5 h-2.5 rounded-full ${bg}`} />
                {label.toUpperCase()}
              </span>
            ))}
            {heatmap && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span className="w-6 h-2.5 rounded" style={{ background: 'linear-gradient(to right, #4ade80, #f59e0b, #ef4444)' }} />
                HEAT INTENSITY
              </span>
            )}
          </div>
        </div>

        {/* Right panel - Recent Incidents */}
        <div className="w-80 bg-white border-l border-slate-100 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h3 className="font-display font-bold text-slate-900">Recent Incidents</h3>
            <button className="text-slate-400 hover:text-slate-600">⚙️</button>
          </div>

          {/* Category filters */}
          <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-slate-100">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  activeFilter === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Issue list */}
          <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-slate-50">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="p-4 animate-pulse space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                </div>
              ))
            ) : issues.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No incidents found</div>
            ) : issues.map((issue) => {
              const pri = getPriorityBadge(issue.priority);
              return (
                <div key={issue._id} className="p-4 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`badge ${pri.color} text-[10px] font-bold uppercase`}>{issue.priority}</span>
                    <span className="text-[10px] text-slate-400">{timeAgo(issue.createdAt)}</span>
                  </div>
                  <p className="font-semibold text-sm text-slate-900 mb-1 leading-tight">{issue.title}</p>
                  <p className="text-xs text-slate-500 mb-2">{truncate(issue.description, 80)}</p>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeWidth="2"/>
                      <circle cx="12" cy="10" r="3" strokeWidth="2"/>
                    </svg>
                    {issue.location?.address || issue.location?.district || 'Location TBD'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Generate Report */}
          <div className="p-4 border-t border-slate-100">
            <button className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
              Generate System Report
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
