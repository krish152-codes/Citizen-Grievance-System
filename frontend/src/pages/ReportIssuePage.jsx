import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import PublicNav from '../components/layout/PublicNav';
import { issuesAPI, aiAPI } from '../services/api';

const CATEGORIES = [
  { id: 'roads', label: 'Roads', icon: '🛣️' },
  { id: 'electricity', label: 'Lighting', icon: '💡' },
  { id: 'waste', label: 'Sanitation', icon: '🗑️' },
  { id: 'parks', label: 'Parks', icon: '🌳' },
  { id: 'water', label: 'Water', icon: '💧' },
  { id: 'traffic', label: 'Traffic', icon: '🚦' },
];

export default function ReportIssuePage() {
  const navigate = useNavigate();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm();
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

  // Auto-classify when description changes
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

  // Debounce classify
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

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PublicNav />
        <div className="max-w-lg mx-auto px-6 py-20 text-center animate-slide-up">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">Report Submitted!</h2>
          <p className="text-slate-500 mb-2">Your complaint has been received and classified by our AI system.</p>
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
                  submitted.priority === 'high' ? 'text-orange-600' :
                  submitted.priority === 'medium' ? 'text-yellow-600' : 'text-green-600'
                }`}>{submitted.priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department</span>
                <span className="font-semibold text-slate-800">{submitted.department}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate(`/track?id=${submitted.ticketId}`)} className="btn-primary">
              Track Status
            </button>
            <button onClick={() => { setSubmitted(null); setImages([]); setImagePreviews([]); setAiPreview(null); }} className="btn-secondary">
              Report Another
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              <p className="text-slate-500 mb-8">
                Provide details about the urban concern. Our AI will curate and route your report to the correct department.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Category selector */}
                <div>
                  <label className="label">Category</label>
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
                  <label className="label">Detailed Description</label>
                  <div className="relative">
                    <textarea
                      {...register('description', { required: 'Description is required', minLength: { value: 15, message: 'Be more descriptive (min 15 chars)' } })}
                      onChange={handleDescChange}
                      rows={5}
                      placeholder="What did you observe? (e.g., Damaged pavement on 5th Ave causing accidents...)"
                      className="input-field resize-none pr-12"
                    />
                    {/* Mic button */}
                    <button
                      type="button"
                      className="absolute bottom-3 right-3 w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center hover:bg-brand-700 transition-colors"
                      title="Voice input (coming soon)"
                    >
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeWidth="2"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="12" y1="19" x2="12" y2="23" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="8" y1="23" x2="16" y2="23" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                  {errors.description && (
                    <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1 text-right">{descValue?.length || 0} chars</p>
                </div>

                {/* Location */}
                <div>
                  <label className="label">Location / Address</label>
                  <input
                    {...register('location')}
                    placeholder="e.g., 5th Ave & Main St, Downtown District"
                    className="input-field"
                  />
                </div>

                {/* Image upload */}
                <div>
                  <label className="label">Visual Evidence</label>
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
                    <p className="text-sm font-semibold text-slate-700 mb-1">Drag and drop images here</p>
                    <p className="text-xs text-slate-400">or click to browse local files (Max 10MB each, up to 5)</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                  {/* Preview grid */}
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
                    <p className="section-tag mb-3 flex items-center gap-2">
                      <span className="w-4 h-4 bg-brand-600 rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      </span>
                      AI Preview Analysis
                    </p>
                    {aiLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <div className="w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                        Analyzing…
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-xl p-3 border border-slate-100">
                          <p className="label text-[10px] mb-1">Category</p>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-brand-500 rounded-full"></span>
                            <span className="text-sm font-semibold capitalize text-slate-800">
                              {aiPreview?.category?.replace('_', ' ') || '—'}
                            </span>
                          </div>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-slate-100">
                          <p className="label text-[10px] mb-1">Priority</p>
                          <span className={`badge text-xs font-bold uppercase ${
                            aiPreview?.priority === 'critical' ? 'bg-red-100 text-red-700' :
                            aiPreview?.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                            aiPreview?.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>{aiPreview?.priority || '—'}</span>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-slate-100">
                          <p className="label text-[10px] mb-1">Assigned</p>
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
                    <span className="text-red-500">ℹ️</span>
                    <span className="text-sm font-semibold text-slate-700">Mark as Urgent</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-all relative ${isUrgent ? 'bg-red-500' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${isUrgent ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </div>

                {/* Submit */}
                <button type="submit" disabled={submitting} className="btn-primary w-full py-4 text-base">
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      Submitting Report…
                    </span>
                  ) : 'Submit Report'}
                </button>

                <p className="text-xs text-center text-slate-400 leading-relaxed">
                  By submitting, you agree to our Terms of Service and Privacy Policy. Data will be processed by CityPulse AI for urban maintenance prioritization.
                </p>
              </form>
            </div>
          </div>

          {/* Sidebar stats */}
          <div className="space-y-4">
            {/* Active tickets */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Tickets</p>
                <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex items-end gap-2">
                <span className="font-display text-4xl font-bold text-slate-900">1,284</span>
                <span className="text-green-500 text-sm font-bold mb-1">+12%</span>
              </div>
              <div className="mt-2 h-1.5 bg-brand-600 rounded-full w-3/4" />
              <p className="text-xs text-slate-400 mt-2">70% of issues resolved this week</p>
            </div>

            {/* Neighborhood stats */}
            <div className="card p-5 space-y-4">
              <div>
                <p className="label">Neighborhood Status</p>
                <div className="flex items-end gap-2">
                  <span className="font-display text-xl font-bold text-slate-900">Active</span>
                  <span className="text-xs text-slate-400 mb-0.5">3 reports nearby</span>
                </div>
              </div>
              <div>
                <p className="label">Response Time</p>
                <div className="flex items-center gap-2">
                  <span className="font-display text-xl font-bold text-slate-900">2.4h</span>
                  <span className="text-orange-500">⚡</span>
                  <span className="text-xs text-slate-400">Avg. resolution</span>
                </div>
              </div>
              <div>
                <p className="label">District AI Score</p>
                <div className="flex items-center gap-2">
                  <span className="font-display text-xl font-bold text-slate-900">88</span>
                  <span className="text-brand-500 text-sm">✨</span>
                  <span className="text-xs text-slate-400">Health index</span>
                </div>
              </div>
            </div>

            {/* Track existing */}
            <div className="card p-5 bg-brand-600 text-white">
              <p className="font-semibold mb-2">Already reported an issue?</p>
              <p className="text-brand-100 text-sm mb-4">Track your complaint status with your ticket ID.</p>
              <button onClick={() => navigate('/track')} className="w-full py-2 bg-white text-brand-700 font-semibold rounded-xl text-sm hover:bg-brand-50 transition-colors">
                Track Complaint →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white py-6 px-6 mt-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-slate-900 text-sm">CityPulse AI</p>
            <p className="text-xs text-slate-400">© 2024 Digital Curator Systems</p>
          </div>
          <div className="flex gap-6">
            {['PRIVACY POLICY', 'TERMS OF SERVICE', 'API STATUS', 'CONTACT'].map((l) => (
              <button key={l} className="text-xs text-slate-400 hover:text-slate-600 font-semibold tracking-wide">{l}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
