const mongoose = require('mongoose');

// A citizen's "I fixed / cleaned this" showcase post.
const communityPostSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, required: true, trim: true },

    activityType: {
      type: String,
      enum: ['pothole_fixing', 'drain_cleaning', 'garbage_cleanup', 'tree_planting', 'water_leak_repair', 'streetlight_repair', 'other'],
      default: 'other',
      index: true,
    },

    caption: { type: String, required: true, trim: true, maxlength: [280, 'Caption cannot exceed 280 characters'] },

    // Exactly two photos, e.g. before / after
    images: {
      type: [{ type: String }],
      validate: [(v) => v.length === 2, 'Exactly 2 photos are required'],
    },

    location: {
      address:     { type: String, required: true, trim: true, maxlength: 300 }, // manual
      lat:         { type: Number, min: -90,  max: 90 },                         // GPS (optional)
      lng:         { type: Number, min: -180, max: 180 },
      gpsAccuracy: { type: Number },                                              // metres
    },
    gpsVerified: { type: Boolean, default: false },

    appreciations:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    appreciationCount: { type: Number, default: 0, index: true },

    status: { type: String, enum: ['published', 'hidden'], default: 'published', index: true },
  },
  { timestamps: true }
);

communityPostSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CommunityPost', communityPostSchema);
