const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema(
  {
    drain:    { type: mongoose.Schema.Types.ObjectId, ref: 'Drain', required: true },
    deviceId: { type: String, required: true, uppercase: true },
    timestamp: { type: Date, default: Date.now },

    waterDistanceCm: { type: Number },
    waterDepthCm:    { type: Number },
    waterFillPct:    { type: Number },

    rainWetness: { type: String, enum: ['DETECTED', 'NOT_DETECTED'], default: 'NOT_DETECTED' },

    ch4Signal: { type: Number, default: 0 },
    ch4Status: { type: String, enum: ['NORMAL', 'ALERT'], default: 'NORMAL' },

    h2sSignal: { type: Number, default: 0 },
    h2sStatus: { type: String, enum: ['NORMAL', 'ALERT'], default: 'NORMAL' },

    o2Percent: { type: Number },
    o2Status:  { type: String, enum: ['NORMAL', 'LOW', 'NOT_INSTALLED'], default: 'NOT_INSTALLED' },

    waterStatus:      { type: String, enum: ['NORMAL', 'WARNING', 'HIGH', 'CRITICAL'], default: 'NORMAL' },
    rapidRise:         { type: Boolean, default: false },
    atmosphereStatus: { type: String, enum: ['NORMAL', 'ALERT'], default: 'NORMAL' },
    deviceStatus:     { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'ONLINE' },

    isSimulated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Fast range queries per drain, newest first
sensorReadingSchema.index({ drain: 1, timestamp: -1 });

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
