import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import { aiReviewAPI } from '../services/api';
import { timeAgo } from '../utils/helpers';

const CATEGORY_OPTIONS = ['waste', 'water', 'electricity', 'roads', 'infrastructure', 'public_safety', 'parks', 'traffic', 'other'];
const SOURCE_LABELS = { WEB: ' Web', WHATSAPP: ' WhatsApp', AI: ' AI Chat', MANUAL: 'Manual' };

function ReviewRow({ issue, onSaved }) {
  const [category, setCategory] = useState(issue.category);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await aiReviewAPI.review(issue._id, { category });
      onSaved(data.issue);
    } finally {
      setSaving(false);
    }
  };

  const dismiss = async () => {
    setSaving(true);
    try {
      const { data } = await aiReviewAPI.review(issue._id, {}); // clears the review flag with no field changes
      onSaved(data.issue);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-xs font-bold text-slate-400">{issue.ticketId}</span>
            <span className="text-xs">{SOURCE_LABELS[issue.source] || issue.source}</span>
            <span className="text-[11px] text-slate-400">{timeAgo(issue.createdAt)}</span>
          </div>
          <p className="font-semibold text-sm text-slate-900">{issue.title}</p>
        </div>
        <span className="text-xs font-bold text-amber-600 bg-amber-50 rounded-full px-2.5 py-1">
          {Math.round((issue.aiConfidence || 0) * 100)}% confidence
        </span>
      </div>

      <p className="text-sm text-slate-500 mb-3">{issue.description || issue.aiGeneratedSummary}</p>

      {issue.originalLanguage && issue.originalLanguage !== 'en' && (
        <p className="text-xs text-slate-400 mb-3">Original language: {issue.originalLanguage}</p>
      )}

      <div className="flex items-center gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field text-xs py-1.5 flex-1">
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        <button disabled={saving} onClick={save} className="btn-primary text-xs py-1.5 px-3">Correct & Approve</button>
        <button disabled={saving} onClick={dismiss} className="btn-secondary text-xs py-1.5 px-3">Looks Right</button>
      </div>
    </div>
  );
}

export default function AIReviewPage() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    aiReviewAPI.getQueue({ limit: 30 }).then(({ data }) => setIssues(data.issues)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (updatedIssue) => {
    setIssues((prev) => prev.filter((i) => i._id !== updatedIssue._id));
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="font-display text-3xl font-bold text-slate-900 mb-1">AI Review Queue</h1>
        <p className="text-slate-500 text-sm mb-6">
          Complaints where the AI Complaint Assistant's classification confidence was below the review threshold.
          Correcting a category here updates the live grievance and is logged as feedback — nothing retrains automatically.
        </p>

        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
        ) : issues.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">
            <span className="text-3xl block mb-2">✅</span>
            <p className="text-sm font-medium">Nothing needs review right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => (
              <div key={issue._id}>
                <ReviewRow issue={issue} onSaved={handleSaved} />
                <button onClick={() => navigate(`/issues/${issue._id}`)} className="text-[11px] text-brand-600 font-bold hover:underline mt-1 ml-1">
                  View full complaint →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
