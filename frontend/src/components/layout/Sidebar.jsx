import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getInitials } from '../../utils/helpers';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { path: '/map', label: 'Map View', icon: MapIcon },
  { path: '/issues', label: 'Issue Logs', icon: ListIcon },
  { path: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
  { path: '/ai-analysis', label: 'AI Analysis', icon: AIIcon },
  { path: '/users', label: 'User Mgmt', icon: UsersIcon },
];

function DashboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2"/>
      <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2"/>
      <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2"/>
      <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2"/>
    </svg>
  );
}

function MapIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" strokeWidth="2" strokeLinejoin="round"/>
      <line x1="8" y1="2" x2="8" y2="18" strokeWidth="2"/>
      <line x1="16" y1="6" x2="16" y2="22" strokeWidth="2"/>
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <line x1="8" y1="6" x2="21" y2="6" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="12" x2="21" y2="12" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="18" x2="21" y2="18" strokeWidth="2" strokeLinecap="round"/>
      <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="2" strokeLinecap="round"/>
      <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="2" strokeLinecap="round"/>
      <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <line x1="18" y1="20" x2="18" y2="10" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="20" x2="12" y2="4" strokeWidth="2" strokeLinecap="round"/>
      <line x1="6" y1="20" x2="6" y2="14" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function AIIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" strokeWidth="2"/>
      <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="9" cy="7" r="4" strokeWidth="2"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-slate-100 h-screen flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <p className="font-display font-bold text-sm text-slate-900">CityPulse AI</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Urban Intelligence</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 sidebar-scroll">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`sidebar-link w-full text-left ${location.pathname === path ? 'active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Report Button */}
      <div className="p-3 border-t border-slate-100">
        <button
          onClick={() => navigate('/report')}
          className="btn-primary w-full text-sm py-2"
        >
          <span>+</span> Report New Issue
        </button>
      </div>

      {/* Bottom links */}
      <div className="p-3 space-y-0.5 border-t border-slate-100">
        <button className="sidebar-link w-full text-left text-xs">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="2"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Support
        </button>
        <button
          onClick={logout}
          className="sidebar-link w-full text-left text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeWidth="2" strokeLinecap="round"/>
            <polyline points="16 17 21 12 16 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="21" y1="12" x2="9" y2="12" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Logout
        </button>
      </div>

      {/* User Info */}
      {user && (
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 truncate capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
