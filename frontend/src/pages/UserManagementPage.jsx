import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { usersAPI } from '../services/api';
import { formatDateTime, getInitials, timeAgo } from '../utils/helpers';

const ROLE_TABS = ['All Users', 'Admins', 'City Managers', 'Department Leads'];
const ROLE_BADGE = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  citizen: 'bg-slate-100 text-slate-600',
  department_lead: 'bg-orange-100 text-orange-700',
};

function InviteModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'citizen', department: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.email) return alert('Name and email required');
    setSaving(true);
    try {
      await usersAPI.invite(form);
      onSuccess?.();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to invite user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-display font-bold text-xl text-slate-900">Invite New User</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jordan Deen" className="input-field" />
          </div>
          <div>
            <label className="label">Work Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="j.deen@citypulse.gov" className="input-field" />
          </div>
          <div>
            <label className="label">Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input-field">
              <option value="citizen">Citizen</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="department_lead">Department Lead</option>
            </select>
          </div>
          <div>
            <label className="label">Department</label>
            <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="input-field">
              <option value="">Select Department</option>
              <option>Central Governance</option>
              <option>Public Works</option>
              <option>Sanitation & Waste</option>
              <option>Infrastructure</option>
              <option>Public Safety</option>
              <option>Traffic Management</option>
              <option>City Planning</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Inviting…' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('All Users');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showInvite, setShowInvite] = useState(false);

  const roleFilter = tab === 'Admins' ? 'admin' : tab === 'City Managers' ? 'manager' : tab === 'Department Leads' ? 'department_lead' : '';

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (roleFilter) params.role = roleFilter;
      if (search) params.search = search;
      const { data } = await usersAPI.getAll(params);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [page, tab, search]);

  const SECURITY_CARDS = [
    { icon: '🛡️', title: 'Access Control', desc: 'System-wide audit logs show 100% compliance with city data residency protocols this month.' },
    { icon: '🎯', title: 'Team Velocity', desc: 'Infrastructure department leads have increased platform engagement by 24% since the last update.' },
    { icon: '🔒', title: 'Security Health', desc: 'Zero unauthorized login attempts detected. Multi-factor authentication is active for all accounts.' },
  ];

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="section-tag mb-1">Governance Suite</p>
            <h1 className="font-display text-4xl font-bold text-slate-900">Manage access.</h1>
          </div>
          <button onClick={() => setShowInvite(true)} className="btn-primary">
            + Invite New User
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-5 flex flex-wrap items-center gap-4">
          <div className="flex gap-1">
            {ROLE_TABS.map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setPage(1); }}
                className={`px-4 py-1.5 text-sm rounded-lg font-semibold transition-all ${
                  tab === t ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth="2"/><path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                placeholder="Search team members..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="input-field pl-9 py-2 text-sm w-56"
              />
            </div>
            <button className="btn-secondary text-sm py-2 gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth="2" strokeLinecap="round"/>
                <polyline points="7 10 12 15 17 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Users table */}
        <div className="card overflow-hidden mb-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Department</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Last Active</th>
                <th className="px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${50 + Math.random() * 50}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <p className="text-3xl mb-2">👥</p>
                    <p>No users found</p>
                  </td>
                </tr>
              ) : users.map((u) => (
                <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {getInitials(u.name)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`badge ${ROLE_BADGE[u.role] || 'bg-slate-100 text-slate-600'} text-xs font-bold capitalize`}>
                      {u.role === 'department_lead' ? 'Dept Lead' : u.role}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">{u.department || '—'}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-slate-300'}`} />
                      <span className={`text-xs font-semibold ${u.isActive ? 'text-green-700' : 'text-slate-400'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-400">{timeAgo(u.lastActive)}</td>
                  <td className="px-4 py-4 text-right">
                    <button className="text-slate-400 hover:text-slate-700 text-lg leading-none">···</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Showing {Math.min((page - 1) * 10 + 1, pagination.total)}–{Math.min(page * 10, pagination.total)} of {pagination.total} members
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-40">←</button>
              {[...Array(Math.min(pagination.pages, 5))].map((_, i) => {
                const p = i + 1;
                return (
                  <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 text-xs rounded-lg font-semibold ${page === p ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}>{p}</button>
                );
              })}
              {pagination.pages > 5 && <span className="text-slate-400 text-xs">…</span>}
              <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-40">→</button>
            </div>
          </div>
        </div>

        {/* Security cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SECURITY_CARDS.map(({ icon, title, desc }) => (
            <div key={title} className="card p-5">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xl mb-4">{icon}</div>
              <h3 className="font-display font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onSuccess={fetchUsers} />}
    </AdminLayout>
  );
}
