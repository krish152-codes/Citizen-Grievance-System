import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getInitials } from '../../utils/helpers';

const NAV_LINKS = [
  { label: 'Platform', path: '/' },
  { label: 'Insights', path: '/analytics' },
  { label: 'City Health', path: '/dashboard' },
];

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <header className="h-14 bg-white border-b border-slate-100 flex items-center px-6 gap-6 flex-shrink-0">
      {/* Search */}
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" strokeWidth="2"/>
            <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search insights..."
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Nav links */}
      <nav className="hidden md:flex items-center gap-1">
        {NAV_LINKS.map(({ label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              location.pathname === path
                ? 'text-brand-700 bg-brand-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-3">
        {/* Bell */}
        <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeWidth="2" strokeLinecap="round"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User */}
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{user.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user.role?.replace('_', ' ')}</p>
            </div>
            <div className="w-8 h-8 bg-brand-600 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-pointer">
              {getInitials(user.name)}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
