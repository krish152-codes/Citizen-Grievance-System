import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PublicNav from '../components/layout/PublicNav';
import { issuesAPI } from '../services/api';
import { formatDateTime, getPriorityBadge, getStatusBadge, getCategoryConfig } from '../utils/helpers';

export default function TrackComplaintPage() {
  const [searchParams] = useSearchParams();
  const [ticketId, setTicketId] = useState(searchParams.get('id') || '');
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchParams.get('id')) handleSearch(searchParams.get('id'));
  }, []);

  const handleSearch = async (id) => {
    const searchId = id || ticketId;
    if (!searchId.trim()) return setError('Please enter a ticket ID');
    setLoading(true);
    setError('');
    setIssue(null);
    try {
      const { data } = await issuesAPI.track(searchId.trim());
      setIssue(data.issue);
    } catch (err) {
      setError(err.response?.data?.message || 'Complaint not found. Please check your ticket ID.');
    } finally {
      setLoading(false);
    }
  };

  const statusSteps = ['pending', 'in_progress', 'resolved'];
  const currentStep = issue ? statusSteps.indexOf(issue.status) : -1;

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10 animate-slide-up">
          <span className="section-tag mb-3 block">Complaint Tracking</span>
          <h1 className="font-display text-4xl font-bold text-slate-900 mb-3">
            Track Your Complaint
          </h1>
          <p className="text-slate-500">
            Enter your ticket ID to get real-time status updates on your reported issue.
          </p>
        </div>

        {/* Search box */}
        <div className="card p-6 mb-8 animate-slide-up">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 text-sm">#</span>
              <input
                type="text"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="TKT-1234"
                className="input-field pl-7 font-mono"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="btn-primary px-6"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" strokeWidth="2"/>
                  <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
              Track
            </button>
          </div>
          {error && (
            <p className="text-red-500 text-sm mt-3 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {error}
            </p>
          )}
        </div>

        {/* Result */}
        {issue && (
          <div className="space-y-6 animate-slide-up">
            {/* Header card */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-sm font-bold text-brand-600">#{issue.ticketId}</span>
                    <span className={`badge ${getStatusBadge(issue.status).color}`}>
                      {getStatusBadge(issue.status).label}
                    </span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-slate-900">{issue.title}</h2>
                  {issue.location?.address && (
                    <p className="text-slate-500 text-sm mt-1 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeWidth="2"/>
                        <circle cx="12" cy="10" r="3" strokeWidth="2"/>
                      </svg>
                      {issue.location.address}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`badge ${getPriorityBadge(issue.priority).color} text-xs uppercase font-bold`}>
                    {issue.priority}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">{getCategoryConfig(issue.category).icon} {getCategoryConfig(issue.category).label}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  {['Reported', 'In Progress', 'Resolved'].map((label, i) => (
                    <div key={label} className="flex flex-col items-center gap-1 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        i <= currentStep ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-400'
                      }`}>
                        {i < currentStep ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                          </svg>
                        ) : i + 1}
                      </div>
                      <span className={`text-xs font-medium ${i <= currentStep ? 'text-brand-700' : 'text-slate-400'}`}>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="relative h-1.5 bg-slate-200 rounded-full mx-4">
                  <div
                    className="absolute h-full bg-brand-600 rounded-full transition-all duration-500"
                    style={{ width: `${currentStep === 0 ? 0 : currentStep === 1 ? 50 : 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="card p-4">
                <p className="label">Department</p>
                <p className="text-sm font-semibold text-slate-800">{issue.department || 'Public Works'}</p>
              </div>
              <div className="card p-4">
                <p className="label">Reported</p>
                <p className="text-sm font-semibold text-slate-800">{formatDateTime(issue.createdAt)}</p>
              </div>
              <div className="card p-4">
                <p className="label">Last Update</p>
                <p className="text-sm font-semibold text-slate-800">{formatDateTime(issue.updatedAt)}</p>
              </div>
            </div>

            {/* Timeline */}
            {issue.timeline?.length > 0 && (
              <div className="card p-6">
                <h3 className="font-display font-bold text-slate-900 mb-5">Incident Timeline</h3>
                <div className="space-y-5">
                  {issue.timeline.map((event, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          i === issue.timeline.length - 1 ? 'bg-brand-100 border-2 border-brand-600' : 'bg-brand-600'
                        }`}>
                          {i === issue.timeline.length - 1 ? (
                            <div className="w-2.5 h-2.5 rounded-full border-2 border-brand-600" />
                          ) : (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                            </svg>
                          )}
                        </div>
                        {i < issue.timeline.length - 1 && (
                          <div className="w-0.5 flex-1 bg-slate-200 mt-1" />
                        )}
                      </div>
                      <div className="pb-5 min-w-0">
                        <p className={`font-semibold text-sm ${i === issue.timeline.length - 1 ? 'text-brand-700' : 'text-slate-800'}`}>
                          {event.title}
                        </p>
                        <p className="text-slate-500 text-sm mt-0.5">{event.description}</p>
                        <p className="text-xs text-slate-400 mt-1">{formatDateTime(event.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!issue && !loading && !error && (
          <div className="text-center py-16 text-slate-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth="1.5"/>
              <path d="m21 21-4.35-4.35" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p className="text-sm">Enter your ticket ID above to track your complaint</p>
            <p className="text-xs mt-1">Format: TKT-XXXX</p>
          </div>
        )}
      </div>
    </div>
  );
}
