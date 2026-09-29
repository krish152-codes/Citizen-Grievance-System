const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['WEB', 'WHATSAPP'], required: true },

    // Web: linked to a logged-in user if authenticated (guest allowed, like /issues/report).
    citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // WhatsApp: we never store the raw phone number — only a one-way hash,
    // enough to recognize returning conversations without keeping PII in
    // plaintext (see spec §43 Privacy).
    whatsappNumberHash: { type: String, default: null, index: true },
    whatsappDisplayName: { type: String, default: '' }, // WhatsApp profile name, if provided — display only

    language: { type: String, default: 'en' }, // BCP-47-ish: 'en' | 'hi' | ... (extensible)

    // Conversational state machine (spec §22)
    state: {
      type: String,
      enum: [
        'NEW', 'UNDERSTANDING', 'COLLECTING_DETAILS', 'LOCATION_REQUIRED',
        'MEDIA_OPTIONAL', 'CLASSIFICATION', 'CONFIRMATION', 'SUBMITTED', 'TRACKING',
      ],
      default: 'NEW',
    },

    draft: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplaintDraft', default: null },

    // Once a grievance is created from this conversation, or the citizen is
    // just checking on one, we remember which one they're talking about.
    activeIssue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', default: null },

    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.index({ channel: 1, whatsappNumberHash: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
