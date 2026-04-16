import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function PublicNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  return (
    <nav className="h-14 bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-40 flex items-center px-6 gap-6">
      {/* Logo */}
      <button onClick={() => navigate('/')} className="flex items-center gap-2 font-display font-bold text-slate-900">
        <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        CityPulse AI
      </button>

      {/* Links */}
      <div className="flex items-center gap-1 ml-4">
        {[
          { label: 'Platform', path: '/' },
          { label: 'Insights', path: '/track' },
          { label: 'City Health', path: '/dashboard' },
        ].map(({ label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              location.pathname === path
                ? 'text-brand-700 underline underline-offset-4'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-3">
        <button className="p-2 rounded-lg hover:bg-slate-100">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeWidth="2" strokeLinecap="round"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="p-2 rounded-lg hover:bg-slate-100">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="7" r="4" strokeWidth="2"/>
          </svg>
        </button>
        {user ? (
          <button onClick={() => navigate('/dashboard')} className="btn-primary text-sm py-2">
            Dashboard
          </button>
        ) : (
          <button onClick={() => navigate('/login')} className="btn-primary text-sm py-2">
            Get Started
          </button>
        )}
      </div>
    </nav>
  );
}
