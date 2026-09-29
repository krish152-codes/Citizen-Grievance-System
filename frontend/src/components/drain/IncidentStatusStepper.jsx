import React from 'react';
import { INCIDENT_STATUS_FLOW, INCIDENT_STATUS_CONFIG } from '../../utils/helpers';

const NEXT_STEPS = {
  NEW: ['VERIFIED', 'ASSIGNED'],
  VERIFIED: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};

export default function IncidentStatusStepper({ status, onAdvance, canEdit, busy }) {
  const currentIndex = INCIDENT_STATUS_FLOW.indexOf(status);
  const nextOptions = NEXT_STEPS[status] || [];

  return (
    <div className="card p-5">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Response Workflow</p>

      <div className="flex items-center mb-5">
        {INCIDENT_STATUS_FLOW.map((step, i) => {
          const reached = i <= currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                  isCurrent ? 'bg-brand-600 border-brand-600 text-white'
                  : reached ? 'bg-brand-100 border-brand-300 text-brand-700'
                  : 'bg-white border-slate-200 text-slate-300'
                }`}>
                  {reached ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] font-semibold text-center leading-tight ${isCurrent ? 'text-slate-900' : 'text-slate-400'}`}>
                  {INCIDENT_STATUS_CONFIG[step].label}
                </span>
              </div>
              {i < INCIDENT_STATUS_FLOW.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${i < currentIndex ? 'bg-brand-400' : 'bg-slate-150'}`} style={{ backgroundColor: i < currentIndex ? undefined : '#e2e8f0' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {canEdit && nextOptions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500 font-medium">Advance to:</span>
          {nextOptions.map((step) => (
            <button
              key={step}
              disabled={busy}
              onClick={() => onAdvance(step)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              {INCIDENT_STATUS_CONFIG[step].label}
            </button>
          ))}
        </div>
      )}
      {status === 'CLOSED' && <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">This incident is closed.</p>}
    </div>
  );
}
