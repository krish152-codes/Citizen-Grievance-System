import React from 'react';
import StatusBadge from './StatusBadge';
import { DRAIN_ECHO_CLASS_CONFIG, formatConfidence } from '../../utils/helpers';

export default function ClassificationCard({ diagnostic }) {
  if (!diagnostic) return null;
  const cls = DRAIN_ECHO_CLASS_CONFIG[diagnostic.predictedClass] || DRAIN_ECHO_CLASS_CONFIG.INCONCLUSIVE;
  const isInconclusive = diagnostic.predictedClass === 'INCONCLUSIVE';

  return (
    <div className="card p-6">
      {isInconclusive ? (
        <div className="text-center py-2">
          <span className="text-3xl block mb-2">❔</span>
          <h3 className="font-display font-bold text-lg text-slate-900 mb-1">Inconclusive</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            The recording does not provide enough signal quality for a reliable model classification.
            Try recording again in a quieter environment with three clear taps.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Suspected Blockage</p>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">{cls.icon}</span>
            <h3 className="font-display font-bold text-2xl text-slate-900">{cls.label}</h3>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl mb-3">
            <span className="text-sm font-semibold text-slate-600">Model confidence</span>
            <span className="font-display text-xl font-bold text-slate-900">{formatConfidence(diagnostic.confidence)}</span>
          </div>

          {diagnostic.alternatives?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-400 mb-1.5">Alternative classification</p>
              {diagnostic.alternatives.map((alt, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <span className="text-slate-600">{DRAIN_ECHO_CLASS_CONFIG[alt.class]?.label || alt.class}</span>
                  <span className="text-slate-400 font-medium">{formatConfidence(alt.confidence)}</span>
                </div>
              ))}
            </div>
          )}

          {diagnostic.recommendedAction && (
            <div className="p-3 bg-blue-50 rounded-xl mb-3">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">Suggested Response</p>
              <p className="text-sm text-blue-800">{diagnostic.recommendedAction}</p>
              <p className="text-[11px] text-blue-500 mt-1">Non-binding guidance — municipal staff make the final decision.</p>
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
        <span className="text-xs text-slate-400">Audio quality</span>
        <StatusBadge kind="audioQuality" status={diagnostic.audioQuality} size="sm" />
      </div>
      <p className="text-[10px] text-slate-400 mt-2 text-center">
        {diagnostic.classifierSource === 'DEMO_HEURISTIC'
          ? 'Demo classifier — not a validated acoustic model. Result is a diagnostic aid only, never a confirmed physical fact.'
          : 'Model classification — a diagnostic aid only, never a confirmed physical fact.'}
      </p>
    </div>
  );
}
