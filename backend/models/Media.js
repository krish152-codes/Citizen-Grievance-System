const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'], required: true },
    storageRef: { type: String, required: true }, // local path served under /uploads/... (see backend/uploads)
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    checksum: { type: String, default: '' },
    source: { type: String, enum: ['WEB', 'WHATSAPP'], required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Media', mediaSchema);
