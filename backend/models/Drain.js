const mongoose = require('mongoose');

// ── Default thresholds (illustrative demo values — see docs/SMART_DRAIN_MODULE.md) ──
// These are NOT universal physical constants. Every drain has its own thresholds,
// configurable by a municipal user from `PATCH /api/drains/:id/thresholds`.
const DEFAULT_THRESHOLDS = {
  warningCm:        60,
  highCm:           75,
  criticalCm:       90,
  rapidRiseCmPerMin: 2,
  ch4AlertSignal:   0.6,   // normalized 0–1 MQ-4 signal
  h2sAlertSignal:   0.6,   // normalized 0–1 MQ-136 signal
  o2LowPercent:     19.5,  // % vol — below this is a low-oxygen concern
  offlineTimeoutMin: 15,
};

const thresholdChangeSchema = new mongoose.Schema({
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changedByName: { type: String, default: '' },
  changedAt: { type: Date, default: Date.now },
  previous:  { type: mongoose.Schema.Types.Mixed },
  updated:   { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

const drainSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: { type: String, required: true, trim: true },
    ward: { type: String, default: '', trim: true },
    zone: { type: String, default: '', trim: true },

    location: {
      address: { type: String, default: '' },
      lat:     { type: Number },
      lng:     { type: Number },
    },

    dimensions: {
      depthCm: { type: Number },       // full depth of the drain, for context only
      notes:   { type: String, default: '' },
    },

    thresholds: {
      warningCm:         { type: Number, default: DEFAULT_THRESHOLDS.warningCm },
      highCm:             { type: Number, default: DEFAULT_THRESHOLDS.highCm },
      criticalCm:         { type: Number, default: DEFAULT_THRESHOLDS.criticalCm },
      rapidRiseCmPerMin:  { type: Number, default: DEFAULT_THRESHOLDS.rapidRiseCmPerMin },
      ch4AlertSignal:     { type: Number, default: DEFAULT_THRESHOLDS.ch4AlertSignal },
      h2sAlertSignal:     { type: Number, default: DEFAULT_THRESHOLDS.h2sAlertSignal },
      o2LowPercent:       { type: Number, default: DEFAULT_THRESHOLDS.o2LowPercent },
      offlineTimeoutMin:  { type: Number, default: DEFAULT_THRESHOLDS.offlineTimeoutMin },
    },
    thresholdHistory: [thresholdChangeSchema],

    // Denormalized snapshot of the most recent reading, kept in sync by
    // drainStatusService so dashboard/list views don't need a second query.
    latest: {
      timestamp:        { type: Date },
      waterDistanceCm:  { type: Number },
      waterDepthCm:     { type: Number },
      waterFillPct:     { type: Number },
      rainWetness:      { type: String, enum: ['DETECTED', 'NOT_DETECTED'], default: 'NOT_DETECTED' },
      ch4Signal:        { type: Number, default: 0 },
      ch4Status:        { type: String, enum: ['NORMAL', 'ALERT'], default: 'NORMAL' },
      h2sSignal:        { type: Number, default: 0 },
      h2sStatus:        { type: String, enum: ['NORMAL', 'ALERT'], default: 'NORMAL' },
      o2Percent:        { type: Number },
      o2Status:         { type: String, enum: ['NORMAL', 'LOW', 'NOT_INSTALLED'], default: 'NOT_INSTALLED' },
      waterStatus:      { type: String, enum: ['NORMAL', 'WARNING', 'HIGH', 'CRITICAL'], default: 'NORMAL' },
      rapidRise:        { type: Boolean, default: false },
      atmosphereStatus: { type: String, enum: ['NORMAL', 'ALERT'], default: 'NORMAL' },
      deviceStatus:     { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'OFFLINE' },
    },

    calibration: {
      lastCalibratedAt: { type: Date },
      nextCalibrationDue: { type: Date },
      lastMaintenanceAt: { type: Date },
      sensorHealth: {
        ultrasonic: { type: String, enum: ['HEALTHY', 'FAULT', 'UNKNOWN'], default: 'UNKNOWN' },
        rain:       { type: String, enum: ['HEALTHY', 'FAULT', 'UNKNOWN'], default: 'UNKNOWN' },
        ch4:        { type: String, enum: ['HEALTHY', 'FAULT', 'UNKNOWN'], default: 'UNKNOWN' },
        h2s:        { type: String, enum: ['HEALTHY', 'FAULT', 'UNKNOWN'], default: 'UNKNOWN' },
        o2:         { type: String, enum: ['HEALTHY', 'FAULT', 'NOT_INSTALLED'], default: 'NOT_INSTALLED' },
      },
    },

    o2Installed: { type: Boolean, default: false },
    isDemo:      { type: Boolean, default: false }, // true for seeded/simulated demo drains
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

drainSchema.index({ 'location.lat': 1, 'location.lng': 1 });

module.exports = mongoose.model('Drain', drainSchema);
module.exports.DEFAULT_THRESHOLDS = DEFAULT_THRESHOLDS;
