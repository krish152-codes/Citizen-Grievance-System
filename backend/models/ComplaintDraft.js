const mongoose = require('mongoose');

const complaintDraftSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },

    category: { type: String, default: '' },
    subcategory: { type: String, default: '' },
    description: { type: String, default: '' },

    location: {
      text: { type: String, default: '' },   // free-text address/landmark the citizen typed
      lat: Number,
      lng: Number,
      ward: { type: String, default: '' },
      zone: { type: String, default: '' },
      resolved: { type: Boolean, default: false }, // has a usable location been captured?
    },

    imageMedia: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
    audioMedia: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],

    // Full result object from aiService.multimodalAnalysis/classifyIssue —
    // stored as Mixed (not a fixed sub-schema) so every field it returns
    // (category, confidence, summary, criticalityScore, detectedObjects,
    // extractedKeywords, emergencyFlag, department, ...) survives intact
    // and can be copied onto the final Issue at submission time.
    aiClassification: { type: mongoose.Schema.Types.Mixed, default: null },

    // Nearby monitored drain, if the complaint looks drain-related and one
    // was found close to the reported location (spec §62–64, §121–122).
    nearbyDrain: { type: mongoose.Schema.Types.ObjectId, ref: 'Drain', default: null },

    confirmationState: {
      type: String,
      enum: ['DRAFTING', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'CANCELLED'],
      default: 'DRAFTING',
    },

    // Populated once submitted — the draft stays as a record even after the
    // real grievance exists.
    submittedIssue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ComplaintDraft', complaintDraftSchema);
