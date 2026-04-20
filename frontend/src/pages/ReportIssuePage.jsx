import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import PublicNav from '../components/layout/PublicNav';
import { issuesAPI, aiAPI, analyticsAPI } from '../services/api';

const CATEGORIES = [
  { id: 'waste',          label: 'Sanitation',    icon: '🗑️' },
  { id: 'water',          label: 'Water',          icon: '💧' },
  { id: 'electricity',    label: 'Electricity',    icon: '⚡' },
  { id: 'roads',          label: 'Roads',          icon: '🛣️' },
  { id: 'infrastructure', label: 'Infrastructure', icon: '🏗️' },
  { id: 'public_safety',  label: 'Safety',         icon: '🛡️' },
  { id: 'parks',          label: 'Parks',          icon: '🌳' },
  { id: 'traffic',        label: 'Traffic',        icon: '🚦' },
];

const PRIORITY_BADGE = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-green-100 text-green-700',
};

export default function ReportIssuePage() {
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const descValue = watch('description', '');

  const [images, setImages]             = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [aiPreview, setAiPreview]       = useState(null);
  const [aiLoading, setAiLoading]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(null);
  const [isUrgent, setIsUrgent]         = useState(false);
  const [isDragging, setIsDragging]     = useState(false);
  const [sidebarStats, setSidebarStats] = useState(null);
  const [locationText, setLocationText] = useState('');
  const [gpsCoords, setGpsCoords]       = useState(null);
  const [detectingLoc, setDetectingLoc] = useState(false);

  const fileInputRef  = useRef();
  const classifyTimer = useRef();

  useEffect(() => {
    analyticsAPI.getSummary()
      .then(({ data }) => setSidebarStats(data.data?.overview))
      .catch(() => {});
  }, []);

  // Debounced AI preview using previewClassify
  const classifyText = useCallback(async (text) => {
    if (text.length < 15) { setAiPreview(null); return; }
    setAiLoading(true);
    try {
      const { data } = await aiAPI.previewClassify(text);
      if (data.result) {
        setAiPreview(data.result);
        if (data.result.category && !selectedCategory) {
          setSelectedCategory(data.result.category);
        }
      }
    } catch { /* silent */ }
    finally { setAiLoading(false); }
  }, [selectedCategory]);

  const handleDescChange = (e) => {
    clearTimeout(classifyTimer.current);
    classifyTimer.current = setTimeout(() => classifyText(e.target.value), 800);
  };

  // GPS location detection
  const detectLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation not supported by your browser');
    setDetectingLoc(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGpsCoords({ lat: latitude, lng: longitude });
        setLocationText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setDetectingLoc(false);
      },
      () => {
        alert('Could not get GPS location. Please type the address manually.');
        setDetectingLoc(false);
      }
    );
  };

  const handleFiles = (files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 5);
    setImages(prev => [...prev, ...valid].slice(0, 5));
    valid.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => setImagePreviews(prev => [...prev, e.target.result].slice(0, 5));
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', formData.title || formData.description.slice(0, 70));
      fd.append('description', formData.description);
      fd.append('category', selectedCategory || aiPreview?.category || 'other');
      fd.append('isUrgent', isUrgent);
      fd.append('location', JSON.stringify({
        address: locationText || formData.location || '',
        lat:     gpsCoords?.lat || null,
        lng:     gpsCoords?.lng || null,
        district: formData.district || '',
      }));
      images.forEach(img => fd.append('images', img));
      const { data } = await issuesAPI.report(fd);
      setSubmitted(data.issue);
    } catch (err) {
      alert(err.response?.data?.message || 'Submission failed. Is the backend running on port 5000?');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(null);
    setImages([]);
    setImagePreviews([]);
    setAiPreview(null);
    setSelectedCategory('');
    setLocationText('');
    setGpsCoords(null);
    setIsUrgent(false);
  };

  // ── Success screen ─────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PublicNav />
        <div className="max-w-2xl mx-auto px-6 py-16 animate-slide-up">
          <div className="card p-10 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-display text-3xl font-bold text-slate-900 mb-2">Report Submitted!</h2>
            <p className="text-slate-500 mb-8 text-sm">
              Your complaint has been received, classified by AI, and routed to the relevant department.
            </p>

            <div className="bg-brand-50 border border-brand-200 rounded-2xl p-6 text-left mb-6">
              <p className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-4">Your Ticket Details</p>
              <div className="space-y-3 text-sm">
                {[
                  ['Ticket ID',   submitted.ticketId,                                'font-mono font-bold text-brand-700 text-base'],
                  ['Title',       submitted.title,                                   'font-semibold text-slate-900'],
                  ['Category',    submitted.category?.replace(/_/g, ' '),            'capitalize font-medium'],
                  ['Priority',    submitted.priority,                                `font-bold capitalize ${PRIORITY_BADGE[submitted.priority]?.split(' ')[1]}`],
                  ['Department',  submitted.department,                              'font-semibold'],
                  ['AI Score',    `${Math.round((submitted.aiConfidence || 0) * 100)}% confidence`, ''],
                  ['Status',      'Pending Review',                                  'text-orange-600 font-semibold'],
                ].map(([label, value, cls]) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-brand-100 last:border-0">
                    <span className="text-slate-500">{label}</span>
                    <span className={cls || 'text-slate-800'}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {submitted.aiRecommendedAction && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left mb-6">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">AI Recommended Action</p>
                <p className="text-sm font-semibold text-slate-800">💡 {submitted.aiRecommendedAction}</p>
              </div>
            )}

            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => navigate(`/track?id=${submitted.ticketId}`)} className="btn-primary">
                Track Status →
              </button>
              <button onClick={resetForm} className="btn-secondary">
                Report Another
              </button>
              <button onClick={() => navigate('/')} className="btn-ghost">
                Go Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main form */}
          <div className="lg:col-span-2">
            <div className="card p-8 animate-slide-up">
              <p className="section-tag mb-2">Issue Reporting</p>
              <h1 className="font-display text-3xl font-bold text-slate-900 mb-2">Report New Issue</h1>
              <p className="text-slate-500 mb-8 text-sm">
                Describe the issue in detail. AI will classify it, set the priority, and route it to the correct department automatically.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* Category */}
                <div>
                  <label className="label">
                    Issue Category{' '}
                    <span className="text-slate-400 normal-case font-normal">(AI auto-detects if left blank)</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {CATEGORIES.map(({ id, label, icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedCategory(id === selectedCategory ? '' : id)}
                        className={`flex items-center gap-1.5 px-2.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          selectedCategory === id
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-base">{icon}</span><span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="label">Detailed Description *</label>
                  <div className="relative">
                    <textarea
                      {...register('description', {
                        required: 'Please describe the issue',
                        minLength: { value: 15, message: 'Minimum 15 characters for better AI classification' },
                      })}
                      onChange={handleDescChange}
                      rows={6}
                      placeholder="Describe what you see — location, severity, how long it's been there, who is affected, any safety risk..."
                      className="input-field resize-none pr-12"
                    />
                    <button
                      type="button"
                      title="Voice input (coming soon)"
                      className="absolute bottom-3 right-3 w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center hover:bg-brand-700 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeWidth="2"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="12" y1="19" x2="12" y2="23" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                  {errors.description && (
                    <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1 text-right">{descValue?.length || 0} characters</p>
                </div>

                {/* AI Live Preview */}
                {(aiPreview || aiLoading) && (
                  <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-[9px] font-bold">AI</span>
                      </div>
                      <p className="text-xs font-bold text-brand-700 uppercase tracking-wider">
                        Live AI Classification
                      </p>
                    </div>
                    {aiLoading ? (
                      <div className="flex items-center gap-2 text-sm text-brand-600">
                        <div className="w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                        Analyzing your description…
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-white rounded-xl p-3 border border-brand-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</p>
                            <p className="text-sm font-semibold text-slate-800 capitalize leading-tight">
                              {aiPreview?.category?.replace(/_/g, ' ') || '—'}
                            </p>
                          </div>
                          <div className="bg-white rounded-xl p-3 border border-brand-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</p>
                            <span className={`badge text-xs font-bold uppercase ${PRIORITY_BADGE[aiPreview?.priority] || 'bg-slate-100 text-slate-600'}`}>
                              {aiPreview?.priority || '—'}
                            </span>
                          </div>
                          <div className="bg-white rounded-xl p-3 border border-brand-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department</p>
                            <p className="text-xs font-semibold text-slate-800 leading-tight">
                              {aiPreview?.department || '—'}
                            </p>
                          </div>
                          <div className="bg-white rounded-xl p-3 border border-brand-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Confidence</p>
                            <p className="text-sm font-bold text-brand-700">
                              {Math.round((aiPreview?.confidence || 0) * 100)}%
                            </p>
                          </div>
                        </div>
                        {aiPreview?.recommendedAction && (
                          <p className="text-xs text-brand-700 mt-3 flex items-center gap-1.5">
                            <span>💡</span>
                            <span>
                              <span className="font-bold">Recommended:</span> {aiPreview.recommendedAction}
                            </span>
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Location with GPS */}
                <div>
                  <label className="label">Location / Address</label>
                  <div className="flex gap-2">
                    <input
                      value={locationText}
                      onChange={e => setLocationText(e.target.value)}
                      placeholder="Street address, landmark, or area name..."
                      className="input-field flex-1"
                    />
                    <button
                      type="button"
                      onClick={detectLocation}
                      disabled={detectingLoc}
                      className="btn-secondary px-3 flex-shrink-0 text-sm gap-1.5"
                      title="Use GPS location"
                    >
                      {detectingLoc ? (
                        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                          <circle cx="12" cy="12" r="3" strokeWidth="2"/>
                          <line x1="12" y1="2" x2="12" y2="5" strokeWidth="2" strokeLinecap="round"/>
                          <line x1="12" y1="19" x2="12" y2="22" strokeWidth="2" strokeLinecap="round"/>
                          <line x1="2" y1="12" x2="5" y2="12" strokeWidth="2" strokeLinecap="round"/>
                          <line x1="19" y1="12" x2="22" y2="12" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      )}
                      GPS
                    </button>
                  </div>
                  {gpsCoords && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      ✓ GPS coordinates captured: {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}
                    </p>
                  )}
                  <input
                    {...register('district')}
                    placeholder="Ward / District (optional)"
                    className="input-field mt-2 text-sm"
                  />
                </div>

                {/* Image upload */}
                <div>
                  <label className="label">
                    Visual Evidence{' '}
                    <span className="text-slate-400 normal-case font-normal">(optional, up to 5 photos)</span>
                  </label>
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-brand-400 bg-brand-50'
                        : 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <polyline points="16 16 12 12 8 16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="12" y1="12" x2="12" y2="21" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mb-1">Drag & drop images or click to browse</p>
                    <p className="text-xs text-slate-400">JPG, PNG, WebP — max 10MB each</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => handleFiles(e.target.files)}
                  />
                  {imagePreviews.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {imagePreviews.map((src, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group">
                          <img src={src} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
                            className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 text-white flex items-center justify-center text-xl font-bold transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mark urgent */}
                <button
                  type="button"
                  onClick={() => setIsUrgent(!isUrgent)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    isUrgent
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-800">Mark as Urgent / Emergency</p>
                      <p className="text-xs text-slate-500">Use only for safety hazards or emergencies</p>
                    </div>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${isUrgent ? 'bg-red-500' : 'bg-slate-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow transition-all ${isUrgent ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </button>

                {/* Submit */}
                <button type="submit" disabled={submitting} className="btn-primary w-full py-4 text-base">
                  {submitting ? (
                    <span className="flex items-center gap-2 justify-center">
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Submitting & Classifying…
                    </span>
                  ) : 'Submit Report →'}
                </button>

                <p className="text-xs text-center text-slate-400">
                  By submitting you agree to our Terms of Service. Your report will be processed by CityPulse AI.
                </p>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {sidebarStats && sidebarStats.totalIssues > 0 ? (
              <div className="card p-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Live Platform Stats</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Total Reports</p>
                    <p className="font-display text-3xl font-bold text-slate-900">
                      {sidebarStats.totalIssues.toLocaleString()}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-orange-50 rounded-xl p-3">
                      <p className="text-xs text-orange-500 font-semibold mb-1">Active</p>
                      <p className="font-display text-xl font-bold text-orange-700">{sidebarStats.activeIssues}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3">
                      <p className="text-xs text-green-600 font-semibold mb-1">Resolved</p>
                      <p className="font-display text-xl font-bold text-green-700">{sidebarStats.resolvedIssues}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Resolution Rate</span>
                      <span className="font-bold text-green-600">{sidebarStats.resolutionRate}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${sidebarStats.resolutionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-5 bg-brand-50 border-brand-100">
                <p className="text-xs font-bold text-brand-700 uppercase tracking-wider mb-3">How It Works</p>
                <div className="space-y-3">
                  {[
                    { step: '1', text: 'Describe the issue in detail' },
                    { step: '2', text: 'AI classifies & sets priority automatically' },
                    { step: '3', text: 'Routed to the correct department' },
                    { step: '4', text: 'Track progress with your ticket ID' },
                  ].map(({ step, text }) => (
                    <div key={step} className="flex gap-2.5 items-start">
                      <span className="w-5 h-5 bg-brand-600 text-white rounded-full text-xs flex items-center justify-center flex-shrink-0 font-bold">
                        {step}
                      </span>
                      <p className="text-sm text-brand-800">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card p-5 bg-brand-600 text-white">
              <p className="font-semibold mb-1">Already submitted?</p>
              <p className="text-brand-100 text-sm mb-4">Track your complaint status using your ticket ID.</p>
              <button
                onClick={() => navigate('/track')}
                className="w-full py-2 bg-white text-brand-700 font-semibold rounded-xl text-sm hover:bg-brand-50 transition-colors"
              >
                Track Complaint →
              </button>
            </div>

            <div className="card p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Tips for a Good Report</p>
              <ul className="space-y-2">
                {[
                  ['📍', 'Include exact street address or landmark'],
                  ['📸', 'Photos help departments respond faster'],
                  ['📝', 'Mention how long the issue has existed'],
                  ['👥', 'Note how many people are affected'],
                  ['⚠️', 'Mark urgent only for safety hazards'],
                ].map(([icon, tip]) => (
                  <li key={tip} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="text-sm flex-shrink-0">{icon}</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-100 bg-white py-6 px-6 mt-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <p className="font-display font-bold text-slate-900 text-sm">CityPulse AI</p>
          <p className="text-xs text-slate-400">© 2024 — All reports are processed securely</p>
        </div>
      </footer>
    </div>
  );
}