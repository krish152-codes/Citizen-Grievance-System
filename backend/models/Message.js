const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },

    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    messageType: { type: String, enum: ['TEXT', 'AUDIO', 'IMAGE', 'LOCATION', 'SYSTEM'], required: true },

    // The citizen's own words, preserved verbatim — never overwritten by translation (spec §29).
    text: { type: String, default: '' },
    transcript: { type: String, default: '' }, // for AUDIO messages
    detectedLanguage: { type: String, default: '' },

    media: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', default: null },

    location: {
      lat: Number,
      lng: Number,
      name: String,
      address: String,
    },

    // Compact, non-chain-of-thought structured AI metadata for this message only
    // (e.g. what the classifier extracted at this turn) — for audit (spec §46, §97).
    aiMetadata: { type: mongoose.Schema.Types.Mixed, default: null },

    // WhatsApp's own message ID — required for idempotent webhook processing (spec §79).
    whatsappMessageId: { type: String, default: null, index: true, sparse: true },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
