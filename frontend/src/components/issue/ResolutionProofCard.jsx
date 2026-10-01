import React from 'react';
import { SERVER_URL } from '../../services/api';

const VERDICTS = {
  RESOLVED:     { icon: '✅', label: 'Work verified by AI',        cls: 'bg-green-50 text-green-700 border-green-200' },
  NOT_RESOLVED: { icon: '❌', label: 'Not resolved',               cls: 'bg-red-50 text-red-700 border-red-200' },
  UNCLEAR:      { icon: '⚠️', label: 'Photo unclear',              cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  UNVERIFIED:   { icon: '🕓', label: 'Awaiting manual review',     cls: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export function VerdictBadge({ verification }) {
  if (!verification) return null;
  const v = verification.overridden
    ? { icon: '⚠️', label: 'Closed by manager override', cls: 'bg-purple-50 text-purple-700 border-purple-200' }
    : VERDICTS[verification.verdict] || VERDICTS.UNVERIFIED;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${v.cls}`}>
      {v.icon} {v.label}
    </span>
  );
}

const Photos = ({ title, urls }) => (
  <div>
    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</p>
    {urls?.length ? (
      <div className="flex gap-2 flex-wrap">
        {urls.map((u, i) => (
          <a key={i} href={`${SERVER_URL}${u}`} target="_blank" rel="noreferrer">
            <img src={`${SERVER_URL}${u}`} alt={`${title} ${i + 1}`} className="w-28 h-24 object-cover rounded-xl border border-slate-200 hover:opacity-90" />
          </a>
        ))}
      </div>
    ) : <p className="text-xs text-slate-400">No photo</p>}
  </div>
);

export default function ResolutionProofCard({ issue }) {
  const r = issue.resolution;
  if (!r?.proofImageUrls?.length) return null;
  const v = r.verification;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <p className="label !mb-0">Completion Proof</p>
        <VerdictBadge verification={v} />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <Photos title="Before (citizen)" urls={issue.imageUrls} />
        <Photos title="After (work completed)" urls={r.proofImageUrls} />
      </div>

      {v?.reason && (
        <p className="text-sm text-slate-600 mt-4 p-3 bg-slate-50 rounded-xl">
          <b>{v.method === 'AI' ? 'AI check' : 'Note'}:</b> {v.reason}
          {v.method === 'AI' && <span className="text-slate-400"> · confidence {Math.round((v.confidence || 0) * 100)}%</span>}
        </p>
      )}
      {v?.overridden && (
        <p className="text-sm text-purple-700 mt-2 p-3 bg-purple-50 rounded-xl"><b>Override reason:</b> {v.overrideReason}</p>
      )}
      {r.locationCheck === 'FAR' && (
        <p className="text-sm text-amber-700 mt-2 p-3 bg-amber-50 rounded-xl">
          ⚠️ The proof photo was taken about {r.distanceFromComplaintM} m away from the complaint location.
        </p>
      )}
      {r.locationCheck === 'MATCH' && (
        <p className="text-xs text-green-700 mt-2">📍 Photo location matches the complaint site.</p>
      )}
      {r.notes && <p className="text-xs text-slate-500 mt-2">Staff notes: {r.notes}</p>}
    </div>
  );
}
