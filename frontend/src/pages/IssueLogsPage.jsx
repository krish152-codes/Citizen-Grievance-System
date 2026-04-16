import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import { issuesAPI } from '../services/api';
import { formatDateTime, getPriorityBadge, getStatusBadge, getCategoryConfig, truncate } from '../utils/helpers';

const STATUSES = ['', 'pending', 'in_progress', 'resolved', 'on_hold', 'escalated'];
const PRIORITIES = ['', 'critical', 'high', 'medium', 'low'];
const CATEGORIES = ['', 'waste', 'water', 'electricity', 'roads', 'infrastructure', 'public_safety', 'parks', 'traffic'];

export default function IssueLogsPage() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', search: '' });
  const [page, setPage] = useState(1);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
      const { data } = await issuesAPI.getAll(params);
      setIssues(data.issues);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const handleFilterChange = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900">Issue Logs</h1>
            <p className="text-slate-500 text-sm mt-1">{pagination.total} total complaints</p>
          </div>
          <button onClick={() => navigate('/report')} className="btn-primary">
            + New Report
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-5 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-48 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth="2"/>
              <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search by title or ticket ID..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="input-field pl-9 py-2 text-sm"
            />
          </div>
          <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="input-field py-2 text-sm w-auto">
            <option value="">All Statuses</option>
            {STATUSES.slice(1).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select value={filters.priority} onChange={e => handleFilterChange('priority', e.target.value)} className="input-field py-2 text-sm w-auto">
            <option value="">All Priorities</option>
            {PRIORITIES.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filters.category} onChange={e => handleFilterChange('category', e.target.value)} className="input-field py-2 text-sm w-auto">
            <option value="">All Categories</option>
            {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
          <button onClick={() => { setFilters({ status:'', category:'', priority:'', search:'' }); setPage(1); }} className="btn-ghost text-sm text-red-500">
            Clear
          </button>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Issue</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Category</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Priority</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Department</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : issues.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-400">
                      <p className="text-4xl mb-3">📋</p>
                      <p className="font-medium">No issues found</p>
                      <p className="text-sm mt-1">Try adjusting filters</p>
                    </td>
                  </tr>
                ) : issues.map((issue) => {
                  const cat = getCategoryConfig(issue.category);
                  const pri = getPriorityBadge(issue.priority);
                  const sta = getStatusBadge(issue.status);
                  return (
                    <tr
                      key={issue._id}
                      onClick={() => navigate(`/issues/${issue._id}`)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-bold text-brand-600">#{issue.ticketId}</span>
                      </td>
                      <td className="px-4 py-4 max-w-xs">
                        <p className="text-sm font-semibold text-slate-900">{truncate(issue.title, 50)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{truncate(issue.description, 60)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm">{cat.icon} <span className="capitalize text-slate-700">{cat.label}</span></span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`badge ${pri.color} text-xs uppercase font-bold`}>{issue.priority}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`badge ${sta.color} text-xs font-semibold`}>{sta.label}</span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">{issue.department || '—'}</td>
                      <td className="px-4 py-4 text-xs text-slate-400 whitespace-nowrap">{formatDateTime(issue.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-40">←</button>
                {[...Array(Math.min(pagination.pages, 5))].map((_, i) => {
                  const p = i + 1;
                  return (
                    <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 text-sm rounded-lg font-semibold ${page === p ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}>{p}</button>
                  );
                })}
                <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)} className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-40">→</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
