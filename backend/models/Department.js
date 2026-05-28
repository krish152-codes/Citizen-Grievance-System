const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    // Department name, e.g. "Public Works Department"
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
    },
    // Which issue category this department handles
    category: {
      type: String,
      enum: ['waste','water','electricity','roads','infrastructure','public_safety','parks','traffic','other'],
      required: [true, 'Category is required'],
    },
    // City this department belongs to
    city: {
      type: String,
      required: [true, 'City name is required'],
      trim: true,
    },
    // State
    state: {
      type: String,
      default: 'Madhya Pradesh',
      trim: true,
    },
    // Head of department
    headName: { type: String, default: '', trim: true },
    // Official contact email — used to send the complaint application
    email: {
      type: String,
      required: [true, 'Department email is required'],
      trim: true,
      lowercase: true,
    },
    // Official phone
    phone: { type: String, default: '', trim: true },
    // Office address
    address: { type: String, default: '', trim: true },
    // Is this department active?
    isActive: { type: Boolean, default: true },
    // How many complaints routed to it
    complaintsReceived: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index: one department per category per city
departmentSchema.index({ category: 1, city: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
