import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import PublicNav      from '../components/layout/PublicNav';
import VoiceRecorder  from '../components/voice/VoiceRecorder';
import LocationPicker from '../components/map/LocationPicker';
import { issuesAPI, aiAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { id: 'roads',          label: 'Roads',        icon: '🛣️' },
  { id: 'electricity',    label: 'Lighting',     icon: '💡' },
  { id: 'waste',          label: 'Sanitation',   icon: '🗑️' },
  { id: 'parks',          label: 'Parks',        icon: '🌳' },
  { id: 'water',          label: 'Water',        icon: '💧' },
  { id: 'traffic',        label: 'Traffic',      icon: '🚦' },
  { id: 'infrastructure', label: 'Infrastructure',icon: '🏗️' },
  { id: 'public_safety',  label: 'Safety',       icon: '🚔' },
];

const MIN_PHOTOS = 2;
const MAX_PHOTOS = 8;

const CriticalityBar = ({ score }) => {
  const pct   = Math.round((score / 10) * 100);
  const color  = score >= 8 ? 'bg-red-500' : score >= 5 ? 'bg-orange-400' : score >= 3 ? 'bg-yellow-400' : 'bg-green-400';
  const label  = score >= 8 ? 'Critical 🚨' : score >= 5 ? 'High ⚠️' : score >= 3 ? 'Medium' : 'Low';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">AI Criticality Score</span>
        <span className="text-xs font-bold text-slate-700">{score.toFixed(1)}/10 — {label}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default function ReportIssuePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const descValue = watch('description', '');

  // Images
  const [images, setImages]               = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [imageError, setImageError]       = useState('');
  const [isDragging, setIsDragging]       = useState(false);
  const fileInputRef = useRef();

  // Voice
  const [voiceBlob, setVoiceBlob]             = useState(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  // Location
  const [location, setLocation] = useState({ address: '', lat: null, lng: null, district: '' });

  // AI & form state
  const [selectedCategory, setSelectedCategory] = useState('');
  const [aiPreview, setAiPreview]               = useState(null);
  const [aiLoading, setAiLoading]               = useState(false);
  const [submitting, setSubmitting]             = useState(false);
  const [submitted, setSubmitted]               = useState(null);
  const [isUrgent, setIsUrgent]                 = useState(false);

  // ── AI auto-classify ──────────────────────────────────────────────────────
  const descRef = useRef();
  const classifyText = useCallback(async (text) => {
    if (text.length < 15) { setAiPreview(null); return; }
    setAiLoading(true);
    try {
      const { data } = await aiAPI.classify(text);
      setAiPreview(data.result);
      if (data.result?.category && !selectedCategory) setSelectedCategory(data.result.category);
    } catch { /* silent */ }
    finally { setAiLoading(false); }
  }, [selectedCategory]);

  const handleDescChange = (e) => {
    clearTimeout(descRef.current);
    descRef.current = setTimeout(() => classifyText(e.target.value), 800);
  };

  // ── Images ───────────────────────────────────────────────────────────────
  const handleFiles = (files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (valid.length === 0) { setImageError('Only image files are accepted (jpg, png, webp).'); return; }
    setImages(prev => {
      const combined = [...prev, ...valid].slice(0, MAX_PHOTOS);
      if (combined.length >= MIN_PHOTOS) setImageError('');
      return combined;
    });
    valid.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => setImagePreviews(prev => [...prev, e.target.result].slice(0, MAX_PHOTOS));
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); };
  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (formData) => {
    // Frontend mandatory image check
    if (images.length < MIN_PHOTOS) {
      setImageError(`⚠️ At least ${MIN_PHOTOS} photos are required. You've added ${images.length}.`);
      document.getElementById('image-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title',       formData.title || formData.description.slice(0, 60));
      fd.append('description', formData.description);
      fd.append('category',    selectedCategory || aiPreview?.category || 'other');
      fd.append('isUrgent',    isUrgent || (aiPreview?.criticalityScore >= 8));
      fd.append('location',    JSON.stringify(location));

      // Images — field name MUST be 'images' (matches backend combinedUpload)
      images.forEach(img => fd.append('images', img));

      // Voice — field name MUST be 'voice'
      if (voiceBlob) {
        const ext = voiceBlob.type?.includes('mp3') ? '.mp3'
                  : voiceBlob.type?.includes('wav') ? '.wav' : '.webm';
        fd.append('voice', voiceBlob, `voice-message${ext}`);
      }

      // English transcript for AI
      if (voiceTranscript) fd.append('transcript', voiceTranscript);

      const { data } = await issuesAPI.report(fd);
      setSubmitted(data.issue);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit. Please try again.';
      if (msg.toLowerCase().includes('image')) {
        setImageError(msg);
        document.getElementById('image-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PublicNav />
        <div className="max-w-lg mx-auto px-6 py-16 text-center animate-slide-up">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">Report Submitted!</h2>
          <p className="text-slate-500 mb-2">Your complaint has been received and classified by AI.</p>

          <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 my-6 text-left space-y-2 text-sm">
            <p className="text-xs text-brand-600 font-bold uppercase tracking-wider mb-3">Ticket Details</p>
            {[
              ['Ticket ID',   <span className="font-mono font-bold">{submitted.ticketId}</span>],
              ['Category',    <span className="capitalize font-semibold">{submitted.category}</span>],
              ['Priority',    <span className={`font-bold capitalize ${submitted.priority === 'critical' ? 'text-red-600' : submitted.priority === 'high' ? 'text-orange-600' : 'text-yellow-600'}`}>{submitted.priority}</span>],
              ['Department',  <span className="font-semibold">{submitted.department}</span>],
              ['AI Criticality', <span className="font-bold">{submitted.aiCriticality ?? '—'}/10</span>],
              submitted.voiceMessageUrl ? ['Voice', <span className="text-green-600 font-semibold text-xs">✓ Attached</span>] : null,
            ].filter(Boolean).map(([label, val]) => (
              <div key={label} className="flex justify-between">
                <span className="text-slate-500">{label}</span>
                {val}
              </div>
            ))}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 text-sm text-yellow-800">
            📌 <span className="font-semibold">Save Ticket ID:</span>{' '}
            <span className="font-mono font-bold">{submitted.ticketId}</span>
          </div>

          {!user && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 text-sm">
              <p className="font-semibold mb-1">💡 Create a free account to track all your complaints</p>
              <button onClick={() => navigate('/login')} className="btn-primary text-sm px-5 py-2 w-full mt-2">
                Create Free Account →
              </button>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate(`/track?id=${submitted.ticketId}`)} className="btn-primary">Track Status</button>
            <button onClick={() => { setSubmitted(null); setImages([]); setImagePreviews([]); setAiPreview(null); setVoiceBlob(null); setVoiceTranscript(''); setImageError(''); }} className="btn-secondary">Report Another</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left: Form ── */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-8 animate-slide-up">
              <p className="section-tag mb-2">Issue Reporting</p>
              <h1 className="font-display text-3xl font-bold text-slate-900 mb-2">Report a Civic Issue</h1>
              <p className="text-slate-500 text-sm mb-1">No login required. AI classifies and routes automatically.</p>
              {!user
                ? <p className="text-xs text-brand-600 mb-5">💡 <button onClick={() => navigate('/login')} className="underline font-semibold">Sign in</button> to track all complaints in your dashboard.</p>
                : <p className="text-xs text-green-600 mb-5">✓ Signed in as <span className="font-semibold">{user.name}</span> — this will appear in your dashboard.</p>
              }

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* Category */}
                <div>
                  <label className="label">Issue Category</label>
                  <div className="grid grid-cols-4 gap-2">
                    {CATEGORIES.map(({ id, label, icon }) => (
                      <button key={id} type="button" onClick={() => setSelectedCategory(id)}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                          selectedCategory === id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}>
                        <span className="text-lg">{icon}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="label">Describe the Issue</label>
                  <textarea
                    {...register('description', {
                      required: 'Please describe the issue',
                      minLength: { value: 15, message: 'At least 15 characters required' },
                    })}
                    onChange={handleDescChange}
                    rows={4}
                    placeholder="e.g., Large pothole on MG Road near the bus stop, causing accidents…"
                    className="input-field resize-none"
                  />
                  {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
                  <p className="text-xs text-slate-400 mt-1 text-right">{descValue?.length || 0} chars</p>
                </div>

                {/* Location with GPS + map */}
                <div>
                  <label className="label">Location / Address</label>
                  <LocationPicker onLocationChange={setLocation} />
                </div>

                {/* ── Photos — MANDATORY (min 2, max 8) ── */}
                <div id="image-section">
                  <label className="label flex items-center gap-2">
                    Photos / Evidence
                    <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-slate-400">
                      ({images.length}/{MAX_PHOTOS} — min {MIN_PHOTOS} required)
                    </span>
                  </label>

                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      imageError    ? 'border-red-400 bg-red-50' :
                      images.length >= MIN_PHOTOS ? 'border-green-400 bg-green-50' :
                      isDragging    ? 'border-brand-400 bg-brand-50' :
                      'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 ${
                      imageError ? 'bg-red-100' : images.length >= MIN_PHOTOS ? 'bg-green-100' : 'bg-brand-100'
                    }`}>
                      {images.length >= MIN_PHOTOS
                        ? <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                        : <svg className={`w-5 h-5 ${imageError ? 'text-red-500' : 'text-brand-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="16 16 12 12 8 16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="12" x2="12" y2="21" strokeWidth="2" strokeLinecap="round"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" strokeWidth="2" strokeLinecap="round"/></svg>
                      }
                    </div>
                    {images.length >= MIN_PHOTOS
                      ? <p className="text-sm font-semibold text-green-700">{images.length} photo{images.length > 1 ? 's' : ''} selected ✓ — click to add more</p>
                      : <>
                          <p className={`text-sm font-semibold mb-1 ${imageError ? 'text-red-600' : 'text-slate-700'}`}>
                            Upload at least {MIN_PHOTOS} photos
                          </p>
                          <p className="text-xs text-slate-400">Drag & drop or click • Max 10 MB each • Up to {MAX_PHOTOS} photos</p>
                        </>
                    }
                  </div>

                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => handleFiles(e.target.files)} />

                  {imageError && (
                    <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                      <p className="text-xs font-semibold text-red-600">{imageError}</p>
                    </div>
                  )}

                  {imagePreviews.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {imagePreviews.map((src, i) => (
                        <div key={i} className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 ${i < MIN_PHOTOS ? 'border-brand-400' : 'border-slate-200'}`}>
                          <img src={src} alt="" className="w-full h-full object-cover" />
                          {i < MIN_PHOTOS && (
                            <div className="absolute bottom-0 left-0 right-0 bg-brand-600/80 text-white text-[9px] font-bold text-center py-0.5">
                              Required #{i+1}
                            </div>
                          )}
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                            className="absolute top-1 right-1 w-5 h-5 bg-slate-900/70 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Voice Recorder */}
                <div>
                  <label className="label flex items-center gap-2">
                    Voice Message
                    <span className="text-xs font-normal text-slate-400">(optional — speak in any Indian language)</span>
                  </label>
                  <VoiceRecorder
                    onVoiceReady={(blob) => setVoiceBlob(blob)}
                    onTranscript={(text) => setVoiceTranscript(text)}
                  />
                  {voiceTranscript && (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-blue-700 mb-1">🎙 Translated transcript (sent to AI):</p>
                      <p className="text-xs text-blue-600 italic">"{voiceTranscript}"</p>
                    </div>
                  )}
                </div>

                {/* AI Classification Preview */}
                {(aiPreview || aiLoading) && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                    <p className="section-tag">🤖 AI Classification</p>
                    {aiLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <div className="w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                        Analysing…
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white rounded-xl p-3 border border-slate-100">
                            <p className="label text-[10px] mb-1">Category</p>
                            <span className="text-sm font-semibold capitalize text-slate-800">{aiPreview?.category?.replace('_', ' ') || '—'}</span>
                          </div>
                          <div className="bg-white rounded-xl p-3 border border-slate-100">
                            <p className="label text-[10px] mb-1">Priority</p>
                            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                              aiPreview?.priority === 'critical' ? 'bg-red-100 text-red-700' :
                              aiPreview?.priority === 'high'     ? 'bg-orange-100 text-orange-700' :
                              aiPreview?.priority === 'medium'   ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>{aiPreview?.priority || '—'}</span>
                          </div>
                          <div className="bg-white rounded-xl p-3 border border-slate-100">
                            <p className="label text-[10px] mb-1">Department</p>
                            <span className="text-xs font-semibold text-slate-800">{aiPreview?.department || '—'}</span>
                          </div>
                        </div>
                        {/* Criticality bar */}
                        {aiPreview?.criticalityScore !== undefined && (
                          <CriticalityBar score={aiPreview.criticalityScore} />
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Urgent toggle */}
                <div
                  onClick={() => setIsUrgent(!isUrgent)}
                  className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${isUrgent ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}
                >
                  <div className="flex items-center gap-2">
                    <span>🚨</span>
                    <div>
                      <span className="text-sm font-semibold text-slate-700">Mark as Urgent / Emergency</span>
                      <p className="text-xs text-slate-400">Use only for immediate safety threats</p>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative flex-shrink-0 transition-all ${isUrgent ? 'bg-red-500' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${isUrgent ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </div>

                {/* Submit */}
                <button type="submit" disabled={submitting} className="btn-primary w-full py-4 text-base">
                  {submitting ? (
                    <span className="flex items-center gap-2 justify-center">
                      <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      Submitting…
                    </span>
                  ) : (
                    <span>
                      Submit Report
                      {images.length < MIN_PHOTOS && (
                        <span className="ml-2 text-sm opacity-70">(add {MIN_PHOTOS - images.length} more photo{MIN_PHOTOS - images.length > 1 ? 's' : ''})</span>
                      )}
                    </span>
                  )}
                </button>

                <p className="text-xs text-center text-slate-400">
                  <span className="text-red-500">*</span> {MIN_PHOTOS} photos mandatory. No account needed — you'll receive a Ticket ID.
                </p>
              </form>
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="space-y-4">
            <div className="card p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">How It Works</p>
              <div className="space-y-3">
                {[
                  { step: '1', text: 'Upload min 2 photos of the issue (required)' },
                  { step: '2', text: 'Use GPS to pin your exact location' },
                  { step: '3', text: 'Optionally record a voice message in your language' },
                  { step: '4', text: 'AI classifies, scores criticality, and routes to department' },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0 mt-0.5">{step}</div>
                    <p className="text-sm text-slate-600">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Already Reported?</p>
              <p className="text-sm text-slate-600 mb-3">Use your Ticket ID to check complaint status.</p>
              <button onClick={() => navigate('/track')} className="w-full py-2 btn-secondary text-sm">Track Complaint →</button>
            </div>

            <div className="card p-5 bg-brand-600 text-white">
              <p className="font-semibold mb-1">Track all your complaints</p>
              <p className="text-brand-100 text-sm mb-3">Free account gives you a full complaint history + city health dashboard.</p>
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
            {['Privacy', 'Terms', 'Contact'].map(l => (
              <button key={l} className="text-xs text-slate-400 hover:text-slate-600">{l}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
