import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import PublicNav from '../components/layout/PublicNav';
import { issuesAPI, aiAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { id: 'roads',       label: 'Roads',      icon: '🛣️' },
  { id: 'electricity', label: 'Lighting',   icon: '💡' },
  { id: 'waste',       label: 'Sanitation', icon: '🗑️' },
  { id: 'parks',       label: 'Parks',      icon: '🌳' },
  { id: 'water',       label: 'Water',      icon: '💧' },
  { id: 'traffic',     label: 'Traffic',    icon: '🚦' },
];

export default function ReportIssuePage() {
  const navigate = useNavigate();
  const { user } = useAuth(); // only used to personalise the UI, NOT to gate access
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const descValue = watch('description', '');

  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [aiPreview, setAiPreview] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef();

  // Auto-classify description with AI
  const classifyText = useCallback(async (text) => {
    if (text.length < 15) { setAiPreview(null); return; }
    setAiLoading(true);
    try {
      const { data } = await aiAPI.classify(text);
      setAiPreview(data.result);
      if (data.result?.category && !selectedCategory) {
        setSelectedCategory(data.result.category);
      }
    } catch { /* silent */ }
    finally { setAiLoading(false); }
  }, [selectedCategory]);

  const descRef = useRef();
  const handleDescChange = (e) => {
    clearTimeout(descRef.current);
    descRef.current = setTimeout(() => classifyText(e.target.value), 800);
  };

  const handleFiles = (files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 5);
    setImages((prev) => [...prev, ...valid].slice(0, 5));
    valid.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => setImagePreviews((prev) => [...prev, e.target.result].slice(0, 5));
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeImage = (idx) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', formData.title || formData.description.slice(0, 60));
      fd.append('description', formData.description);
      fd.append('category', selectedCategory || aiPreview?.category || 'other');
      fd.append('isUrgent', isUrgent);
      fd.append('location', JSON.stringify({
        address: formData.location || '',
        lat: 22.7196,
        lng: 75.8577,
        district: 'Central District',
      }));
      images.forEach((img) => fd.append('images', img));

      const { data } = await issuesAPI.report(fd);
      setSubmitted(data.issue);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PublicNav />
        <div className="max-w-lg mx-auto px-6 py-16 text-center animate-slide-up">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">Report Submitted!</h2>
          <p className="text-slate-500 mb-2">Your complaint has been received and classified by AI.</p>

          {/* Ticket details */}
          <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 my-6 text-left">
            <p className="text-xs text-brand-600 font-bold uppercase tracking-wider mb-3">Ticket Details</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Ticket ID</span>
                <span className="font-mono font-bold text-slate-900">{submitted.ticketId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category</span>
                <span className="font-semibold capitalize text-slate-800">{submitted.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Priority</span>
                <span className={`font-bold capitalize ${
                  submitted.priority === 'critical' ? 'text-red-600' :
                  submitted.priority === 'high'     ? 'text-orange-600' :
                  submitted.priority === 'medium'   ? 'text-yellow-600' : 'text-green-600'
                }`}>{submitted.priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department</span>
                <span className="font-semibold text-slate-800">{submitted.department}</span>
              </div>
            </div>
          </div>

          {/* Save ticket ID reminder */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 text-sm text-yellow-800">
            📌 <span className="font-semibold">Save your Ticket ID:</span>{' '}
            <span className="font-mono font-bold">{submitted.ticketId}</span>
            <br />
            <span className="text-yellow-700 text-xs">You'll need it to track your complaint status.</span>
          </div>

          {/* Login nudge for anonymous users */}
          {!user && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 text-sm text-slate-700">
              <p className="font-semibold mb-1">💡 Want to track all your complaints in one place?</p>
              <p className="text-slate-500 text-xs mb-3">
                Create a free account to view your complaint history, city health, and get updates.
              </p>
              <button
                onClick={() => navigate('/login?tab=register')}
                className="btn-primary text-sm px-5 py-2 w-full"
              >
                Create Free Account →
              </button>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate(`/track?id=${submitted.ticketId}`)} className="btn-primary">
              Track Status
            </button>
            <button
              onClick={() => { setSubmitted(null); setImages([]); setImagePreviews([]); setAiPreview(null); }}
              className="btn-secondary"
            >
              Report Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main report form ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Main form ── */}
          <div className="lg:col-span-2">
            <div className="card p-8 animate-slide-up">
              <p className="section-tag mb-2">Issue Reporting</p>
              <h1 className="font-display text-3xl font-bold text-slate-900 mb-2">Report a Civic Issue</h1>
              <p className="text-slate-500 mb-1">
                No login required. Our AI will classify and route your report automatically.
              </p>
              {/* Login nudge at top for anonymous users */}
              {!user && (
                <p className="text-xs text-brand-600 mb-6">
                  💡{' '}
                  <button onClick={() => navigate('/login')} className="underline font-semibold">
                    Sign in or create an account
                  </button>{' '}
                  to track all your complaints in one dashboard.
                </p>
              )}
              {user && (
                <p className="text-xs text-green-600 mb-6">
                  ✓ Signed in as <span className="font-semibold">{user.name}</span> — this complaint will appear in your dashboard.
                </p>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* Category selector */}
                <div>
                  <label className="label">Issue Category</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {CATEGORIES.map(({ id, label, icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedCategory(id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          selectedCategory === id
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span>{icon}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="label">Describe the Issue</label>
                  <div className="relative">
                    <textarea
                      {...register('description', {
                        required: 'Please describe the issue',
                        minLength: { value: 15, message: 'Please be more descriptive (at least 15 characters)' },
                      })}
                      onChange={handleDescChange}
                      rows={5}
                      placeholder="e.g., Large pothole on MG Road near the bus stop, causing vehicle damage and danger to cyclists..."
                      className="input-field resize-none"
                    />
                  </div>
                  {errors.description && (
                    <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1 text-right">{descValue?.length || 0} characters</p>
                </div>

                {/* Location */}
                <div>
                  <label className="label">Location / Address</label>
                  <input
                    {...register('location')}
                    placeholder="e.g., MG Road near Gandhi Chowk, Indore"
                    className="input-field"
                  />
                </div>

                {/* Image upload */}
                <div>
                  <label className="label">Photos / Evidence</label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                      isDragging ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <polyline points="16 16 12 12 8 16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="12" y1="12" x2="12" y2="21" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mb-1">Drag and drop photos here</p>
                    <p className="text-xs text-slate-400">or click to browse (Max 10 MB each, up to 5 photos)</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                  {imagePreviews.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {imagePreviews.map((src, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                          <img src={src} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
                            className="absolute top-1 right-1 w-5 h-5 bg-slate-900/70 text-white rounded-full flex items-center justify-center text-xs"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Preview */}
                {(aiPreview || aiLoading) && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    <p className="section-tag mb-3">🤖 AI Classification Preview</p>
                    {aiLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <div className="w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                        Analysing your description…
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-xl p-3 border border-slate-100">
                          <p className="label text-[10px] mb-1">Category</p>
                          <span className="text-sm font-semibold capitalize text-slate-800">
                            {aiPreview?.category?.replace('_', ' ') || '—'}
                          </span>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-slate-100">
                          <p className="label text-[10px] mb-1">Priority</p>
                          <span className={`badge text-xs font-bold uppercase ${
                            aiPreview?.priority === 'critical' ? 'bg-red-100 text-red-700' :
                            aiPreview?.priority === 'high'     ? 'bg-orange-100 text-orange-700' :
                            aiPreview?.priority === 'medium'   ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>{aiPreview?.priority || '—'}</span>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-slate-100">
                          <p className="label text-[10px] mb-1">Department</p>
                          <span className="text-sm font-semibold text-slate-800">
                            {aiPreview?.department || 'Public Works'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Mark as Urgent */}
                <div
                  className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                    isUrgent ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'
                  }`}
                  onClick={() => setIsUrgent(!isUrgent)}
                >
                  <div className="flex items-center gap-2">
                    <span>🚨</span>
                    <div>
                      <span className="text-sm font-semibold text-slate-700">Mark as Urgent / Emergency</span>
                      <p className="text-xs text-slate-400">Use only for safety hazards or immediate threats</p>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${isUrgent ? 'bg-red-500' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${isUrgent ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </div>

                {/* Submit */}
                <button type="submit" disabled={submitting} className="btn-primary w-full py-4 text-base">
                  {submitting ? (
                    <span className="flex items-center gap-2 justify-center">
                      <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      Submitting your report…
                    </span>
                  ) : 'Submit Report'}
                </button>

                <p className="text-xs text-center text-slate-400">
                  No account needed. Your complaint will be assigned a Ticket ID you can use to track progress.
                </p>
              </form>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4">
            <div className="card p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">How It Works</p>
              <div className="space-y-3">
                {[
                  { step: '1', text: 'Fill the form with photos and description' },
                  { step: '2', text: 'AI instantly classifies and routes to the right department' },
                  { step: '3', text: 'You get a Ticket ID to track resolution' },
                  { step: '4', text: 'Department acts and closes the issue' },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0 mt-0.5">
                      {step}
                    </div>
                    <p className="text-sm text-slate-600">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Already Reported?</p>
              <p className="text-sm text-slate-600 mb-3">Use your Ticket ID to check the latest status of your complaint.</p>
              <button onClick={() => navigate('/track')} className="w-full py-2 btn-secondary text-sm">
                Track Complaint →
              </button>
            </div>

            <div className="card p-5 bg-brand-600 text-white">
              <p className="font-semibold mb-1">Track all your complaints</p>
              <p className="text-brand-100 text-sm mb-3">
                Create a free account to see your full complaint history and city health dashboard.
              </p>
              <button onClick={() => navigate('/login')} className="w-full py-2 bg-white text-brand-700 font-semibold rounded-xl text-sm hover:bg-brand-50 transition-colors">
                Create Free Account →
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-100 bg-white py-6 px-6 mt-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-slate-900 text-sm">SheharSetu</p>
            <p className="text-xs text-slate-400">Citizen Grievance Platform</p>
          </div>
          <div className="flex gap-4">
            {['Privacy', 'Terms', 'Contact'].map((l) => (
              <button key={l} className="text-xs text-slate-400 hover:text-slate-600">{l}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
