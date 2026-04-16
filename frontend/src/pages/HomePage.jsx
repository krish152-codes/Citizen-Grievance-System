import React from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNav from '../components/layout/PublicNav';

const FEATURES = [
  {
    icon: '🗑️',
    title: 'Precision Waste Detection',
    desc: 'Computer vision models identify and categorize sanitation issues automatically from citizen uploads or street cams.',
    bg: 'bg-white',
  },
  {
    icon: '🤖',
    title: 'AI Classification',
    desc: 'Instant routing to the correct department based on semantic analysis of issue reports.',
    bg: 'bg-white',
  },
  {
    icon: '📊',
    title: 'Real-time Dashboard',
    desc: 'Command center for city managers with live heatmaps and trend forecasting.',
    bg: 'bg-brand-600 text-white',
    dark: true,
  },
];

const STATS = [
  { value: '12k+', label: 'Issues Resolved' },
  { value: '45%', label: 'Cost Reduction' },
  { value: '400+', label: 'City Managers' },
  { value: '0.8s', label: 'Avg Inference Time' },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div className="animate-slide-up">
            <span className="inline-flex items-center gap-1.5 bg-brand-50 text-brand-700 text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-wider">
              Next-Gen Governance
            </span>
            <h1 className="font-display text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
              Smarter Cities,{' '}
              <span className="text-brand-600">Faster Responses</span>
            </h1>
            <p className="text-lg text-slate-500 mb-8 leading-relaxed max-w-md">
              AI-driven urban intelligence for faster issue detection and resolution. We transform complex data into actionable civic insights.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => navigate('/report')} className="btn-primary px-6 py-3 text-base">
                Report an Issue →
              </button>
              <button onClick={() => navigate('/login')} className="btn-secondary px-6 py-3 text-base">
                Login as Admin
              </button>
            </div>

            {/* Social proof */}
            <div className="mt-10 flex items-center gap-3 bg-white rounded-2xl border border-slate-100 p-4 w-fit shadow-sm">
              <div className="flex -space-x-2">
                {['#2563eb', '#7c3aed', '#dc2626'].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white" style={{ backgroundColor: c }} />
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Join 400+ City Managers</p>
                <p className="text-xs text-brand-600 font-bold">⭐ TOP RATED GOV-TECH</p>
              </div>
            </div>
          </div>

          {/* Right - UI Preview */}
          <div className="relative animate-fade-in">
            <div className="relative bg-white rounded-3xl border border-slate-100 shadow-xl p-6">
              {/* Health Index Card */}
              <div className="bg-slate-50 rounded-2xl p-5 mb-4">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Health Index</p>
                <div className="flex items-end gap-3">
                  <p className="font-display text-5xl font-bold text-slate-900">94.2</p>
                  <span className="text-green-500 text-sm font-semibold mb-2">+2.4% vs last week</span>
                </div>
              </div>

              {/* Live Alerts */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-red-500 flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  LIVE ALERTS
                </p>
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-sm">
                  <span>⚠️</span>
                  <span className="text-orange-700 font-medium">Waste detected: Sector 7</span>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-sm">
                  <span>⚡</span>
                  <span className="text-blue-700 font-medium">Grid optimization: Node 8</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category tags */}
        <div className="border-t border-slate-100 bg-white">
          <div className="max-w-6xl mx-auto px-6 py-3 flex gap-8">
            {['INFRASTRUCTURE', 'MOBILITY', 'ENVIRONMENT'].map((tag) => (
              <span key={tag} className="text-xs font-bold text-slate-400 tracking-widest">{tag}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Built for Municipality */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h2 className="font-display text-4xl font-bold text-slate-900 mb-4">
                Built for the Modern Municipality
              </h2>
              <p className="text-slate-500 leading-relaxed">
                Our platform bridges the gap between resident reports and government action using advanced neural networks.
              </p>
            </div>
            <div className="flex items-center justify-end">
              <div className="text-right">
                <p className="font-display text-3xl font-bold text-slate-900">0.8s</p>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Average Inference Time</p>
              </div>
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map(({ icon, title, desc, bg, dark }) => (
              <div key={title} className={`${bg} rounded-2xl p-6 border border-slate-100 shadow-sm`}>
                <span className="text-2xl mb-4 block">{icon}</span>
                <h3 className={`font-display font-bold text-lg mb-2 ${dark ? 'text-white' : 'text-slate-900'}`}>
                  {title}
                </h3>
                <p className={`text-sm leading-relaxed ${dark ? 'text-brand-100' : 'text-slate-500'}`}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dark CTA section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-slate-900 rounded-3xl p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="font-display text-4xl font-bold text-white mb-4">
                Intelligence that scales with your city.
              </h2>
              <div className="flex gap-8 mt-6">
                {STATS.slice(0, 2).map(({ value, label }) => (
                  <div key={label}>
                    <p className="font-display text-3xl font-bold text-white">{value}</p>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="btn-primary bg-brand-500 hover:bg-brand-400 px-8 py-4 text-base flex-shrink-0"
            >
              Request Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-display font-bold text-slate-900 text-sm">CityPulse AI</p>
            <p className="text-xs text-slate-400">© 2024 Digital Curator Systems</p>
          </div>
          <div className="flex gap-6">
            {['PRIVACY POLICY', 'TERMS OF SERVICE', 'API STATUS', 'CONTACT'].map((link) => (
              <button key={link} className="text-xs text-slate-400 hover:text-slate-700 font-semibold tracking-wide">
                {link}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
