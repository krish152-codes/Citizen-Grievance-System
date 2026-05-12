require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

const USERS = [
  { name: 'James Miller',  email: 'admin@citypulse.gov',          password: 'admin123',   role: 'admin',   department: 'Central Governance', isActive: true },
  { name: 'Alisha Moore',  email: 'a.moore@infrastructure.gov',   password: 'manager123', role: 'manager', department: 'Public Works',        isActive: true },
  { name: 'Rahul Sharma',  email: 'rahul@citizen.in',             password: 'citizen123', role: 'citizen', isActive: true },
  { name: 'Priya Patel',   email: 'priya@citizen.in',             password: 'citizen123', role: 'citizen', isActive: true },
];

const seed = async () => {
  try {
    await connectDB();
    console.log('🌱 Starting database seed...');

    // ── Drop entire collections to wipe all indexes ──────
    const db = mongoose.connection.db;
    const existing = (await db.listCollections().toArray()).map(c => c.name);
    if (existing.includes('users'))  await db.dropCollection('users');
    if (existing.includes('issues')) await db.dropCollection('issues');
    console.log('🗑️  Cleared existing data');

    // ── Seed users via Mongoose (handles password hashing) ──
    const createdUsers = await User.create(USERS);
    console.log(`✅ Created ${createdUsers.length} users`);

    // ── Seed issues via RAW insertMany (bypasses Mongoose index recreation) ──
    const citizen = createdUsers.find(u => u.role === 'citizen');
    const now = new Date();

    const issues = [
      {
        ticketId: 'TKT-3001',
        title: 'Illegal Dumping on 5th & Main',
        description: 'Large quantities of construction debris left on the sidewalk blocking the bike lane.',
        category: 'waste', priority: 'high', status: 'in_progress',
        department: 'Sanitation & Waste Management', aiConfidence: 0.98, isUrgent: false, upvotes: 0, views: 0,
        location: { address: '5th Ave and Main St', district: 'Central District', lat: 22.7196, lng: 75.8577 },
        reportedBy: citizen._id,
        sentiment: { score: -0.4, label: 'negative' },
        slaDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        timeline: [
          { title: 'Issue Reported', description: 'Reported via CityPulse AI', timestamp: now, actor: 'Rahul Sharma' },
          { title: 'AI Classification Complete', description: 'Classified as waste with 98% confidence', timestamp: now, actor: 'CityPulse AI' },
        ],
        createdAt: now, updatedAt: now,
      },
      {
        ticketId: 'TKT-3002',
        title: 'Severe Pothole Cluster on 5th Ave',
        description: 'Multiple deep potholes causing traffic hazards and vehicle damage at intersection.',
        category: 'roads', priority: 'critical', status: 'pending',
        department: 'Public Works Department', aiConfidence: 0.95, isUrgent: true, upvotes: 0, views: 0,
        location: { address: '5th Ave & Market St', district: 'North Industrial', lat: 22.73, lng: 75.87 },
        reportedBy: citizen._id,
        sentiment: { score: -0.6, label: 'negative' },
        slaDeadline: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        timeline: [
          { title: 'Issue Reported', description: 'Reported via CityPulse AI', timestamp: now, actor: 'Priya Patel' },
          { title: 'AI Classification Complete', description: 'Classified as roads with 95% confidence', timestamp: now, actor: 'CityPulse AI' },
        ],
        createdAt: now, updatedAt: now,
      },
      {
        ticketId: 'TKT-3003',
        title: 'Damaged Street Lighting at Sunset Park',
        description: 'Flickering light fixture at entrance of Sunset Park. Safety concern for pedestrians.',
        category: 'electricity', priority: 'medium', status: 'in_progress',
        department: 'Electricity Department', aiConfidence: 0.87, isUrgent: false, upvotes: 0, views: 0,
        location: { address: 'Sunset Park Gate 4', district: 'South Sector', lat: 22.71, lng: 75.84 },
        reportedBy: citizen._id,
        sentiment: { score: 0, label: 'neutral' },
        slaDeadline: new Date(now.getTime() + 72 * 60 * 60 * 1000),
        timeline: [
          { title: 'Issue Reported', description: 'Reported via CityPulse AI', timestamp: now, actor: 'Rahul Sharma' },
          { title: 'AI Classification Complete', description: 'Classified as electricity with 87% confidence', timestamp: now, actor: 'CityPulse AI' },
        ],
        createdAt: now, updatedAt: now,
      },
      {
        ticketId: 'TKT-3004',
        title: 'Burst Water Main on Pine Street',
        description: 'Major water leakage causing street flooding. Water pressure issues in Sector 4.',
        category: 'water', priority: 'critical', status: 'in_progress',
        department: 'Water Supply Department', aiConfidence: 0.96, isUrgent: true, upvotes: 0, views: 0,
        location: { address: 'Pine Street, Sector 4', district: 'Central District', lat: 22.725, lng: 75.865 },
        reportedBy: citizen._id,
        sentiment: { score: -0.6, label: 'negative' },
        slaDeadline: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        timeline: [
          { title: 'Issue Reported', description: 'Reported via CityPulse AI', timestamp: now, actor: 'Priya Patel' },
          { title: 'AI Classification Complete', description: 'Classified as water with 96% confidence', timestamp: now, actor: 'CityPulse AI' },
        ],
        createdAt: now, updatedAt: now,
      },
      {
        ticketId: 'TKT-3005',
        title: 'Graffiti on Heritage Clock Tower',
        description: 'New graffiti tags on the historical clock tower wall. Needs specialized cleaning crew.',
        category: 'infrastructure', priority: 'low', status: 'pending',
        department: 'Infrastructure Department', aiConfidence: 0.72, isUrgent: false, upvotes: 0, views: 0,
        location: { address: 'Heritage Square', district: 'Central District', lat: 22.718, lng: 75.855 },
        reportedBy: citizen._id,
        sentiment: { score: 0, label: 'neutral' },
        slaDeadline: new Date(now.getTime() + 168 * 60 * 60 * 1000),
        timeline: [
          { title: 'Issue Reported', description: 'Reported via CityPulse AI', timestamp: now, actor: 'Rahul Sharma' },
          { title: 'AI Classification Complete', description: 'Classified as infrastructure with 72% confidence', timestamp: now, actor: 'CityPulse AI' },
        ],
        createdAt: now, updatedAt: now,
      },
    ];

    await db.collection('issues').insertMany(issues);
    console.log(`✅ Created ${issues.length} issues`);

    console.log('\n📋 Demo Credentials:');
    console.log('  Admin:   admin@citypulse.gov / admin123');
    console.log('  Manager: a.moore@infrastructure.gov / manager123');
    console.log('  Citizen: rahul@citizen.in / citizen123');
    console.log('\n✅ Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

seed();