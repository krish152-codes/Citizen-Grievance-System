import React from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNav from '../components/layout/PublicNav';

const FEATURES = [
  { icon: '🗑️', title: 'Waste Detection', desc: 'AI identifies and categorizes sanitation issues from citizen uploads automatically.', dark: false },
  { icon: '🤖', title: 'Smart Classification', desc: 'Instant routing to the correct department based on semantic analysis of reports.', dark: false },
  { icon: '📊', title: 'Live Dashboard', desc: 'Command center for city managers with real-time issue tracking and trend analysis.', dark: true },
];

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />
      <section className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="animate-slide-up">
          <span className="inline-flex items-center gap-1.5 bg-brand-50 text-brand-700 text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-wider">Next-Gen Governance</span>
          <h1 className="font-display text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
            Smarter Cities, <span className="text-brand-600">Faster Responses</span>
          </h1>
          <p className="text-lg text-slate-500 mb-8 leading-relaxed max-w-md">AI-driven urban intelligence for faster issue detection and resolution. Transform citizen reports into actionable civic insights.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => navigate('/report')} className="btn-primary px-6 py-3 text-base">Report an Issue →</button>
            <button onClick={() => navigate('/login')} className="btn-secondary px-6 py-3 text-base">Admin Login</button>
          </div>
        </div>
        <div className="animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6">
            <div className="bg-slate-50 rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Platform Status</p>
              </div>
              <p className="font-display text-2xl font-bold text-slate-900">Operational</p>
              <p className="text-sm text-slate-400 mt-1">AI classification active</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Capabilities</p>
              {[
                { icon: '🗑️', label: 'Waste Detection', color: 'bg-orange-50 border-orange-100' },
                { icon: '⚡', label: 'Instant Classification', color: 'bg-blue-50 border-blue-100' },
                { icon: '📍', label: 'Location Tracking', color: 'bg-green-50 border-green-100' },
              ].map(({ icon, label, color }) => (
                <div key={label} className={`flex items-center gap-2 ${color} border rounded-xl px-3 py-2 text-sm`}>
                  <span>{icon}</span><span className="text-slate-700 font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <div className="border-y border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-3 flex gap-8">
          {['INFRASTRUCTURE', 'MOBILITY', 'ENVIRONMENT'].map(tag => (
            <span key={tag} className="text-xs font-bold text-slate-400 tracking-widest">{tag}</span>
          ))}
        </div>
      </div>
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <h2 className="font-display text-4xl font-bold text-slate-900 mb-4">Built for the Modern Municipality</h2>
            <p className="text-slate-500 leading-relaxed max-w-xl">Bridges the gap between resident reports and government action using AI-powered classification and routing.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map(({ icon, title, desc, dark }) => (
              <div key={title} className={`rounded-2xl p-6 border ${dark ? 'bg-brand-600 border-brand-500' : 'bg-white border-slate-100 shadow-sm'}`}>
                <span className="text-2xl mb-4 block">{icon}</span>
                <h3 className={`font-display font-bold text-lg mb-2 ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
                <p className={`text-sm leading-relaxed ${dark ? 'text-brand-100' : 'text-slate-500'}`}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-display text-3xl font-bold text-slate-900 mb-12 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Report an Issue', desc: 'Submit complaints with text, photos, and your location in under 60 seconds.' },
              { step: '02', title: 'AI Classifies It', desc: 'AI instantly categorizes, assigns priority, and routes to the right department.' },
              { step: '03', title: 'Track Resolution', desc: 'Get real-time updates as your issue moves through the resolution pipeline.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-14 h-14 bg-brand-600 text-white font-display font-bold text-lg rounded-2xl flex items-center justify-center mx-auto mb-4">{step}</div>
                <h3 className="font-display font-bold text-lg text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-slate-900 rounded-3xl p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="font-display text-4xl font-bold text-white mb-3">Ready to improve your city?</h2>
              <p className="text-slate-400 text-sm">Start reporting issues or log in to manage your dashboard.</p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button onClick={() => navigate('/report')} className="btn-primary bg-brand-500 hover:bg-brand-400 px-6 py-3">Report Issue</button>
              <button onClick={() => navigate('/login')} className="px-6 py-3 border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 rounded-xl font-semibold text-sm transition-colors">Admin Login</button>
            </div>
          </div>
        </div>
      </section>
      <footer className="border-t border-slate-100 bg-white py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-display font-bold text-slate-900 text-sm">CityPulse AI</p>
            <p className="text-xs text-slate-400">Urban Intelligence Platform</p>
          </div>
          <div className="flex gap-6">
            {['Privacy Policy', 'Terms of Service', 'API Status', 'Contact'].map(link => (
              <button key={link} className="text-xs text-slate-400 hover:text-slate-700 font-medium">{link}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}