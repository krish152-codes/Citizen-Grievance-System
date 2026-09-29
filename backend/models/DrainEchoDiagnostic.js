const mongoose = require('mongoose');

const drainEchoDiagnosticSchema = new mongoose.Schema(
  {
    diagnosticId: { type: String, unique: true },

    drain:      { type: mongoose.Schema.Types.ObjectId, ref: 'Drain', required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    timestamp: { type: Date, default: Date.now },
    location: {
      address: { type: String, default: '' },
      lat:     { type: Number },
      lng:     { type: Number },
    },

    // ── Audio evidence ─────────────────────────────────
    audioUrl:         { type: String, default: '' },       // e.g. /uploads/drain-echo/xyz.webm
    audioDurationSec:  { type: Number, default: 0 },        // reported by the client recorder
    tapCount:          { type: Number, default: 0 },        // client-side detected taps (0–3+)
    audioQuality: {
      type: String,
      enum: ['GOOD', 'NOISY', 'TOO_QUIET', 'TOO_SHORT', 'INCONCLUSIVE'],
      default: 'INCONCLUSIVE',
    },

    // ── Model output — always a diagnostic aid, never a confirmed fact ──
    predictedClass: {
      type: String,
      enum: ['SILT_SLUDGE', 'SOLID_WASTE_PLASTIC', 'NORMAL_OPEN', 'INCONCLUSIVE'],
      default: 'INCONCLUSIVE',
    },
    confidence:   { type: Number, min: 0, max: 1, default: 0 },
    alternatives: [{ class: String, confidence: Number }],
    classifierSource: { type: String, enum: ['DEMO_HEURISTIC', 'ML_SERVICE'], default: 'DEMO_HEURISTIC' },
    recommendedAction: { type: String, default: '' },

    // ── Sensor context at (or near) the time of recording ──
    // Snapshot only — this is informational context, kept clearly separate
    // from the acoustic classification above.
    sensorContext: {
      waterStatus:      { type: String, default: '' },
      waterFillPct:     { type: Number },
      rainWetness:      { type: String, default: '' },
      atmosphereStatus: { type: String, default: '' },
      ch4Status:         { type: String, default: '' },
      h2sStatus:         { type: String, default: '' },
      o2Status:          { type: String, default: '' },
      capturedAt:        { type: Date },
    },

    incident: { type: mongoose.Schema.Types.ObjectId, ref: 'DrainIncident', default: null },
  },
  { timestamps: true }
);

drainEchoDiagnosticSchema.pre('save', async function (next) {
  if (!this.diagnosticId) {
    const count = await mongoose.model('DrainEchoDiagnostic').countDocuments();
    this.diagnosticId = `DE-${String(count + 1000).padStart(4, '0')}`;
  }
  next();
});

drainEchoDiagnosticSchema.index({ drain: 1, createdAt: -1 });

module.exports = mongoose.model('DrainEchoDiagnostic', drainEchoDiagnosticSchema);
