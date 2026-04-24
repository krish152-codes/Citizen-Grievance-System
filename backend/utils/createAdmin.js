/**
 * Admin Creator Script
 * Run: node utils/createAdmin.js
 * Creates or updates an admin account with your email
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const bcrypt = require('bcryptjs');

const connectDB = require('../config/db');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  phone:      { type: String, default: '' },
  password:   { type: String, select: false },
  role:       { type: String, enum: ['citizen','admin','manager','department_lead'], default: 'citizen' },
  department: { type: String, default: 'Central Governance' },
  isActive:   { type: Boolean, default: true },
  lastActive: { type: Date, default: Date.now },
  issuesReported: { type: Number, default: 0 },
  otp:        { type: Object },
  avatar:     { type: String, default: '' },
}, { timestamps: true });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

const createAdmin = async () => {
  try {
    await connectDB();

    console.log('\n========================================');
    console.log('   CityPulse AI — Admin Account Setup   ');
    console.log('========================================\n');

    const name     = await ask('Enter your full name: ');
    const email    = await ask('Enter your email (Gmail or any): ');
    const password = await ask('Enter password (min 6 chars): ');
    const role     = await ask('Role — admin or manager? (default: admin): ') || 'admin';

    if (!name.trim() || !email.trim() || !password.trim()) {
      console.log('\n❌ Name, email and password are all required.');
      process.exit(1);
    }

    if (password.length < 6) {
      console.log('\n❌ Password must be at least 6 characters.');
      process.exit(1);
    }

    // Dynamically get the User model (avoids schema re-registration)
    let User;
    try {
      User = mongoose.model('User');
    } catch {
      User = mongoose.model('User', userSchema);
    }

    const salt   = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password.trim(), salt);

    const existing = await User.findOne({ email: email.toLowerCase().trim() });

    if (existing) {
      // Update existing user to admin
      existing.name       = name.trim();
      existing.password   = hashed;
      existing.role       = role.trim() || 'admin';
      existing.department = 'Central Governance';
      existing.isActive   = true;
      await existing.save({ validateBeforeSave: false });

      console.log('\n✅ Existing account UPGRADED to admin:');
    } else {
      // Create new admin
      await User.create({
        name:       name.trim(),
        email:      email.toLowerCase().trim(),
        password:   hashed,
        role:       role.trim() || 'admin',
        department: 'Central Governance',
        isActive:   true,
      });

      console.log('\n✅ New admin account CREATED:');
    }

    console.log(`   Name:  ${name.trim()}`);
    console.log(`   Email: ${email.toLowerCase().trim()}`);
    console.log(`   Role:  ${role.trim() || 'admin'}`);
    console.log('\n🔑 You can now log in at http://localhost:5173/login');
    console.log('========================================\n');

    rl.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    rl.close();
    process.exit(1);
  }
};

createAdmin();