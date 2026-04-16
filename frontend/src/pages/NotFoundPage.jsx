import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center animate-slide-up">
        <p className="text-8xl font-display font-bold text-slate-200 mb-4">404</p>
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">Page Not Found</h1>
        <p className="text-slate-500 mb-8">This urban zone doesn't exist in our system.</p>
        <button onClick={() => navigate('/')} className="btn-primary">← Return to City Hub</button>
      </div>
    </div>
  );
}
