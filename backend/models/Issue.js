const mongoose = require('mongoose');

const timelineEventSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  timestamp:   { type: Date, default: Date.now },
  actor:       { type: String, default: 'System' },
});

const issueSchema = new mongoose.Schema(
  {
    ticketId: { type: String, unique: true },

    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      enum: ['waste','water','electricity','roads','infrastructure','public_safety','parks','traffic','other'],
      default: 'other',
    },
    priority: {
      type: String,
      enum: ['low','medium','high','critical'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['pending','in_progress','resolved','on_hold','escalated','closed'],
      default: 'pending',
    },

    // ── Media ──────────────────────────────────────────
    imageUrls:       [{ type: String }],
    voiceMessageUrl: { type: String, default: '' },

    // ── AI Multimodal Analysis ─────────────────────────
    transcript:         { type: String, default: '' },
    aiGeneratedSummary: { type: String, default: '' },
    aiDetectedCategory: { type: String, default: '' },
    aiCriticality:      { type: Number, default: 0, min: 0, max: 10 },
    aiConfidence:       { type: Number, default: 0, min: 0, max: 1 },
    aiSeverity:         { type: String, default: 'medium', enum: ['low','medium','high','critical'] },
    emergencyFlag:      { type: Boolean, default: false },
    detectedObjects:    [{ type: String }],
    extractedKeywords:  [{ type: String }],
    analysisTimestamp:  { type: Date },

    // ── Legacy AI fields (kept for compatibility) ──────
    aiCategory:          { type: String, default: '' },
    aiRecommendedAction: { type: String, default: '' },
    sentiment: {
      score: { type: Number, default: 0 },
      label: { type: String, default: 'neutral' },
    },

    // ── Location ───────────────────────────────────────
    location: {
      address:  { type: String, default: '' },
      lat:      { type: Number },
      lng:      { type: Number },
      district: { type: String, default: '' },
    },

    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    department: { type: String, default: 'Public Works' },
    slaDeadline:{ type: Date },
    timeline:   [timelineEventSchema],
    isUrgent:   { type: Boolean, default: false },
    upvotes:    { type: Number, default: 0 },
    views:      { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-generate ticket ID
issueSchema.pre('save', async function (next) {
  if (!this.ticketId) {
    const count = await mongoose.model('Issue').countDocuments();
    this.ticketId = `TKT-${String(count + 1000).padStart(4, '0')}`;
  }
  next();
});

// Set SLA deadline based on priority
issueSchema.pre('save', function (next) {
  if (this.isNew && !this.slaDeadline) {
    const hoursMap = { critical: 4, high: 24, medium: 72, low: 168 };
    const hours = hoursMap[this.priority] || 72;
    this.slaDeadline = new Date(Date.now() + hours * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('Issue', issueSchema);
