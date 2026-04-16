/**
 * Database Seeder
 * Populates the DB with sample data for development/demo
 * Run: node utils/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Issue = require('../models/Issue');

const connectDB = require('../config/db');

const USERS = [
  {
    name: 'James Miller',
    email: 'admin@citypulse.gov',
    password: 'admin123',
    role: 'admin',
    department: 'Central Governance',
    isActive: true,
  },
  {
    name: 'Alisha Moore',
    email: 'a.moore@infrastructure.gov',
    password: 'manager123',
    role: 'manager',
    department: 'Public Works',
    isActive: true,
  },
  {
    name: 'Rahul Sharma',
    email: 'rahul@citizen.in',
    password: 'citizen123',
    role: 'citizen',
    isActive: true,
  },
  {
    name: 'Priya Patel',
    email: 'priya@citizen.in',
    password: 'citizen123',
    role: 'citizen',
    isActive: true,
  },
];

const ISSUES = [
  {
    title: 'Illegal Dumping on 5th & Main',
    description: 'Large quantities of construction debris, including drywall and timber, have been left on the sidewalk and partially blocking the bike lane.',
    category: 'waste',
    priority: 'high',
    status: 'in_progress',
    department: 'Sanitation & Waste',
    aiConfidence: 0.98,
    location: { address: 'Intersection of 5th Ave and Main St', district: 'Central District', lat: 22.7196, lng: 75.8577 },
    timeline: [
      { title: 'Issue Reported', description: 'Reported via Mobile App by Citizen #8291', timestamp: new Date('2024-10-12T08:42:00') },
      { title: 'AI Categorized', description: 'Classified as "Environmental Hazard - Illegal Dumping"', timestamp: new Date('2024-10-12T08:43:00'), actor: 'AI System' },
      { title: 'Assigned to Public Works', description: 'Routing confirmed to Waste Management Division', timestamp: new Date('2024-10-12T09:15:00') },
      { title: 'In Progress', description: 'Cleanup crew dispatched to location', timestamp: new Date('2024-10-12T11:30:00') },
    ],
  },
  {
    title: 'Severe Pothole Cluster on 5th Ave',
    description: 'Multiple deep potholes forming on 5th Ave intersection causing traffic hazards and vehicle damage.',
    category: 'roads',
    priority: 'critical',
    status: 'pending',
    department: 'Public Works',
    aiConfidence: 0.95,
    location: { address: '5th Ave & Market St', district: 'North Industrial', lat: 22.73, lng: 75.87 },
    timeline: [
      { title: 'Issue Reported', description: 'Reported via Web App', timestamp: new Date() },
    ],
  },
  {
    title: 'Damaged Street Lighting at Sunset Park',
    description: 'Flickering light fixture at the entrance of Sunset Park. Reported as safety concern for pedestrians.',
    category: 'electricity',
    priority: 'medium',
    status: 'in_progress',
    department: 'Infrastructure',
    aiConfidence: 0.87,
    location: { address: 'Sunset Park Gate 4', district: 'South Sector', lat: 22.71, lng: 75.84 },
    timeline: [
      { title: 'Issue Reported', description: 'Reported via Mobile App', timestamp: new Date() },
    ],
  },
  {
    title: 'Burst Water Main on Pine Street',
    description: 'Major water leakage causing street flooding on Pine Street. Water pressure issues in Sector 4.',
    category: 'water',
    priority: 'critical',
    status: 'in_progress',
    department: 'Public Works',
    aiConfidence: 0.96,
    isUrgent: true,
    location: { address: 'Pine Street, Sector 4', district: 'Central District', lat: 22.725, lng: 75.865 },
    timeline: [
      { title: 'Issue Reported', description: 'Reported via Citizen Portal', timestamp: new Date() },
    ],
  },
  {
    title: 'Illegal Graffiti on Heritage Clock Tower',
    description: 'New graffiti tags on the historical clock tower wall. Needs specialized cleaning crew.',
    category: 'infrastructure',
    priority: 'low',
    status: 'pending',
    department: 'Parks & Recreation',
    aiConfidence: 0.72,
    location: { address: 'Heritage Square', district: 'Central District', lat: 22.718, lng: 75.855 },
    timeline: [
      { title: 'Issue Reported', description: 'Reported by citizen', timestamp: new Date() },
    ],
  },
];

const seed = async () => {
  try {
    await connectDB();
    console.log('🌱 Starting database seed...');

    // Clear existing data
    await Promise.all([User.deleteMany({}), Issue.deleteMany({})]);
    console.log('🗑️  Cleared existing data');

    // Seed users
    const createdUsers = await User.create(USERS);
    console.log(`✅ Created ${createdUsers.length} users`);

    // Seed issues (assign to citizen user)
    const citizenUser = createdUsers.find((u) => u.role === 'citizen');
    const issuesWithUser = ISSUES.map((issue) => ({
      ...issue,
      reportedBy: citizenUser._id,
    }));

    const createdIssues = await Issue.create(issuesWithUser);
    console.log(`✅ Created ${createdIssues.length} issues`);

    console.log('\n📋 Demo Credentials:');
    console.log('Admin:   admin@citypulse.gov / admin123');
    console.log('Manager: a.moore@infrastructure.gov / manager123');
    console.log('Citizen: rahul@citizen.in / citizen123');
    console.log('\n✅ Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seed();
