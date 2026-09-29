/**
 * Drain Echo — Audio Classifier abstraction
 * ──────────────────────────────────────────
 * The frontend and controller never need to know HOW a recording gets
 * classified. They call `analyze()` and get back a compact, consistent
 * result shape.
 *
 * Two implementations live behind that one interface:
 *   1. ML_SERVICE_URL is set  → POST the audio to a real external service
 *      (e.g. a Python/Librosa microservice) and use its JSON response.
 *   2. ML_SERVICE_URL is unset (default) → a deterministic DEMO HEURISTIC
 *      runs instead. It is NOT a trained acoustic model — it derives a
 *      plausible-looking result from the recording's basic properties
 *      (duration, tap count, file size) so the end-to-end product flow
 *      can be demonstrated honestly. Every result is tagged
 *      `classifierSource: 'DEMO_HEURISTIC'` so nothing downstream can
 *      mistake it for a validated model output.
 *
 * IMPORTANT — safety/product-language constraint (do not relax this):
 * Never surface classifier output as a confirmed physical fact. Always
 * "suspected" / "model classification" / "inconclusive" — never
 * "confirmed blockage". This module only returns raw class + confidence;
 * the "Suspected " / "Model confidence" framing happens in the UI layer.
 */

const CLASSES = ['SILT_SLUDGE', 'SOLID_WASTE_PLASTIC', 'NORMAL_OPEN', 'INCONCLUSIVE'];

const RECOMMENDED_ACTIONS = {
  SILT_SLUDGE:          'Inspect drain / consider jetting equipment for silt or sludge clearance.',
  SOLID_WASTE_PLASTIC:  'Inspect drain / manual removal of solid waste or plastic obstruction may be required.',
  NORMAL_OPEN:          'No acoustic indication of blockage. Routine monitoring is sufficient.',
  INCONCLUSIVE:         'Recording was inconclusive. Consider field verification or a repeat recording.',
};

// ── Step 1: audio quality check (duration + client-reported signal) ──
// Real DSP (clipping/noise-floor analysis) would run here in a full
// implementation; for now this uses what the client recorder can already
// measure (duration, tap count) plus an optional client noise flag.
function checkAudioQuality({ durationSec = 0, tapCount = 0, clientReportedNoisy = false }) {
  if (!durationSec || durationSec < 1.2) return 'TOO_SHORT';
  if (clientReportedNoisy) return 'NOISY';
  if (tapCount === 0) return 'TOO_QUIET';
  if (tapCount >= 2) return 'GOOD';
  return 'INCONCLUSIVE';
}

// ── A small stable hash so the same upload always demos the same result ──
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function demoClassify({ filename, sizeBytes, durationSec, tapCount, audioQuality }) {
  if (audioQuality === 'TOO_SHORT' || audioQuality === 'TOO_QUIET') {
    return {
      predictedClass: 'INCONCLUSIVE',
      confidence: 0.0,
      alternatives: [],
    };
  }

  const seed = hashString(`${filename || ''}-${sizeBytes || 0}-${Math.round((durationSec || 0) * 10)}`);
  const bucket = seed % 100;

  // Weighted demo distribution — not derived from any real acoustic model.
  let predictedClass;
  if (bucket < 40) predictedClass = 'SILT_SLUDGE';
  else if (bucket < 70) predictedClass = 'SOLID_WASTE_PLASTIC';
  else if (bucket < 90) predictedClass = 'NORMAL_OPEN';
  else predictedClass = 'INCONCLUSIVE';

  if (audioQuality === 'NOISY' && bucket % 3 === 0) predictedClass = 'INCONCLUSIVE';

  if (predictedClass === 'INCONCLUSIVE') {
    return { predictedClass, confidence: 0.31 + (seed % 15) / 100, alternatives: [] };
  }

  const primaryConfidence = 0.58 + (seed % 32) / 100; // demo range ~0.58–0.90
  const remaining = CLASSES.filter((c) => c !== predictedClass && c !== 'INCONCLUSIVE');
  const altSeed = seed % remaining.length;
  const altClass = remaining[altSeed];
  const altConfidence = Math.max(0.02, Math.min(0.3, (1 - primaryConfidence) * 0.6));

  return {
    predictedClass,
    confidence: parseFloat(Math.min(0.92, primaryConfidence).toFixed(2)),
    alternatives: [{ class: altClass, confidence: parseFloat(altConfidence.toFixed(2)) }],
  };
}

/**
 * analyze() — the one function the rest of the app calls.
 * @param {object} input
 * @param {string} input.filename
 * @param {number} input.sizeBytes
 * @param {number} input.durationSec  — measured client-side by the recorder
 * @param {number} input.tapCount     — client-side tap detection (0–3+)
 * @param {boolean} [input.clientReportedNoisy]
 * @param {string} [input.audioPath]  — local path, only used if forwarding to ML_SERVICE_URL
 */
async function analyze(input) {
  const audioQuality = checkAudioQuality(input);

  // ── Real ML service path (only runs if configured) ──
  if (process.env.ML_SERVICE_URL) {
    try {
      const fs = require('fs');
      const buffer = input.audioPath ? fs.readFileSync(input.audioPath) : null;
      const res = await fetch(`${process.env.ML_SERVICE_URL.replace(/\/$/, '')}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer,
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const json = await res.json();
        return {
          audioQuality: json.audio_quality || audioQuality,
          predictedClass: json.predicted_class,
          confidence: json.confidence,
          alternatives: json.alternatives || [],
          classifierSource: 'ML_SERVICE',
          recommendedAction: RECOMMENDED_ACTIONS[json.predicted_class] || RECOMMENDED_ACTIONS.INCONCLUSIVE,
        };
      }
      console.warn('ML_SERVICE_URL responded with', res.status, '— falling back to demo heuristic');
    } catch (err) {
      console.warn('ML_SERVICE_URL unreachable — falling back to demo heuristic:', err.message);
    }
  }

  // ── Demo heuristic fallback (default) ──
  const { predictedClass, confidence, alternatives } = demoClassify({ ...input, audioQuality });
  return {
    audioQuality,
    predictedClass,
    confidence,
    alternatives,
    classifierSource: 'DEMO_HEURISTIC',
    recommendedAction: RECOMMENDED_ACTIONS[predictedClass] || RECOMMENDED_ACTIONS.INCONCLUSIVE,
  };
}

module.exports = { analyze, checkAudioQuality, CLASSES, RECOMMENDED_ACTIONS };
