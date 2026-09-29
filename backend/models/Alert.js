const mongoose = require('mongoose');

const ALERT_TYPES = [
  'WATER_WARNING',
  'WATER_HIGH',
  'WATER_CRITICAL',
  'RAPID_RISE',
  'ATMOSPHERE_CH4',
  'ATMOSPHERE_H2S',
  'ATMOSPHERE_O2',
  'DEVICE_OFFLINE',
  'SENSOR_FAULT',
];

const alertSchema = new mongoose.Schema(
  {
    drain:    { type: mongoose.Schema.Types.ObjectId, ref: 'Drain', required: true },
    deviceId: { type: String, required: true, uppercase: true },

    type:     { type: String, enum: ALERT_TYPES, required: true },
    severity: { type: String, enum: ['info', 'warning', 'high', 'critical'], default: 'warning' },
    message:  { type: String, required: true },

    currentValues: { type: mongoose.Schema.Types.Mixed, default: {} },

    status: { type: String, enum: ['unacknowledged', 'acknowledged', 'resolved'], default: 'unacknowledged' },

    acknowledgedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt:   { type: Date },
    assignedTeam:     { type: String, default: '' },
    assignedAt:       { type: Date },
    resolvedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt:       { type: Date },
    resolutionNotes:  { type: String, default: '' },
  },
  { timestamps: true }
);

alertSchema.index({ drain: 1, type: 1, status: 1 });
alertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
module.exports.ALERT_TYPES = ALERT_TYPES;
