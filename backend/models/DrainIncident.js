const mongoose = require('mongoose');

const timelineEventSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  timestamp:   { type: Date, default: Date.now },
  actor:       { type: String, default: 'System' },
}, { _id: false });

const STATUS_FLOW = ['NEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const drainIncidentSchema = new mongoose.Schema(
  {
    incidentId: { type: String, unique: true },

    source: { type: String, enum: ['SENSOR_ALERT', 'DRAIN_ECHO', 'MANUAL'], required: true },
    drain:  { type: mongoose.Schema.Types.ObjectId, ref: 'Drain', required: true },
    alert:      { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', default: null },
    diagnostic: { type: mongoose.Schema.Types.ObjectId, ref: 'DrainEchoDiagnostic', default: null },

    status:   { type: String, enum: STATUS_FLOW, default: 'NEW' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },

    reportedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTeam: { type: String, default: '' },
    assignedTo:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    actionTaken:     { type: String, default: '' },
    resolutionNotes: { type: String, default: '' },

    // Snapshot of context at creation time, so the incident reads standalone
    // even if the drain's live readings move on.
    contextSnapshot: {
      waterStatus:      { type: String, default: '' },
      waterFillPct:     { type: Number },
      rainWetness:       { type: String, default: '' },
      atmosphereStatus: { type: String, default: '' },
      predictedClass:    { type: String, default: '' },
      confidence:         { type: Number },
    },

    timeline: [timelineEventSchema],

    acknowledgedAt: { type: Date },
    assignedAt:     { type: Date },
    startedAt:      { type: Date },
    resolvedAt:     { type: Date },
    closedAt:       { type: Date },
  },
  { timestamps: true }
);

drainIncidentSchema.pre('save', async function (next) {
  if (!this.incidentId) {
    const count = await mongoose.model('DrainIncident').countDocuments();
    this.incidentId = `INC-${String(count + 1000).padStart(4, '0')}`;
  }
  next();
});

// Minutes between creation and acknowledgement / resolution — null until reached.
drainIncidentSchema.virtual('timeToAcknowledgeMin').get(function () {
  if (!this.acknowledgedAt) return null;
  return Math.round((this.acknowledgedAt - this.createdAt) / 60000);
});
drainIncidentSchema.virtual('timeToResolveMin').get(function () {
  if (!this.resolvedAt) return null;
  return Math.round((this.resolvedAt - this.createdAt) / 60000);
});
drainIncidentSchema.set('toJSON', { virtuals: true });

drainIncidentSchema.index({ drain: 1, createdAt: -1 });
drainIncidentSchema.index({ status: 1 });

module.exports = mongoose.model('DrainIncident', drainIncidentSchema);
module.exports.STATUS_FLOW = STATUS_FLOW;
