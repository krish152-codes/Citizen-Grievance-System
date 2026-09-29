/**
 * Seed demo data for the Smart Drain Monitoring + Drain Echo module.
 *
 * Safe to run independently of `npm run seed` — it only touches this
 * module's own collections (drains, sensorreadings, alerts,
 * drainechodiagnostics, drainincidents) and never drops `users` or
 * `issues`, so it will not disturb the existing grievance-system demo data.
 *
 * Usage:  cd backend && npm run seed:drains
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Drain = require('../models/Drain');
const SensorReading = require('../models/SensorReading');
const Alert = require('../models/Alert');
const DrainEchoDiagnostic = require('../models/DrainEchoDiagnostic');
const DrainIncident = require('../models/DrainIncident');
const User = require('../models/User');

const { evaluateReading, deriveAlerts } = require('../services/drainStatusService');

// Indore-area coordinates, consistent with the existing grievance demo data.
const BASE_LAT = 22.7196;
const BASE_LNG = 75.8577;
const jitter = (n) => n + (Math.random() - 0.5) * 0.04;

// Each demo drain's target end-state, and how its water depth trends toward it.
const DRAIN_DEFS = [
  { deviceId: 'DR-001', name: 'MG Road Storm Drain',      ward: 'Ward 4',  targetDepth: 22, o2Installed: false, endsOffline: false, rapidRise: false },
  { deviceId: 'DR-002', name: 'Rajwada Market Drain',      ward: 'Ward 7',  targetDepth: 63, o2Installed: false, endsOffline: false, rapidRise: false },
  { deviceId: 'DR-003', name: 'Palasia Square Drain',      ward: 'Ward 12', targetDepth: 79, o2Installed: true,  endsOffline: false, rapidRise: false },
  { deviceId: 'DR-004', name: 'Sarafa Bazaar Drain',       ward: 'Ward 12', targetDepth: 93, o2Installed: true,  endsOffline: false, rapidRise: false },
  { deviceId: 'DR-005', name: 'Bhawarkuan Junction Drain', ward: 'Ward 15', targetDepth: 58, o2Installed: false, endsOffline: false, rapidRise: true  },
  { deviceId: 'DR-006', name: 'Vijay Nagar Drain',         ward: 'Ward 3',  targetDepth: 31, o2Installed: false, endsOffline: true,  rapidRise: false },
];

async function seedDrainCollections() {
  const db = mongoose.connection.db;
  const existing = (await db.listCollections().toArray()).map((c) => c.name);
  for (const name of ['drains', 'sensorreadings', 'alerts', 'drainechodiagnostics', 'drainincidents']) {
    if (existing.includes(name)) await db.dropCollection(name);
  }
  console.log('🗑️  Cleared existing drain-module data (users/issues untouched)');
}

async function seedOneDrain(def) {
  const drain = await Drain.create({
    deviceId: def.deviceId,
    name: def.name,
    ward: def.ward,
    zone: 'Central Zone',
    location: { address: `${def.name}, Indore`, lat: jitter(BASE_LAT), lng: jitter(BASE_LNG) },
    dimensions: { depthCm: 120, notes: 'Standard RCC storm drain' },
    o2Installed: def.o2Installed,
    isDemo: true,
    calibration: {
      lastCalibratedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      nextCalibrationDue: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000),
      lastMaintenanceAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      sensorHealth: {
        ultrasonic: 'HEALTHY', rain: 'HEALTHY', ch4: 'HEALTHY', h2s: 'HEALTHY',
        o2: def.o2Installed ? 'HEALTHY' : 'NOT_INSTALLED',
      },
    },
  });

  // ── Generate 48 hourly readings trending toward the target depth ──
  const hours = 48;
  let previousReading = null;
  let lastEvaluated = null;
  const startDepth = Math.max(5, def.targetDepth - (def.rapidRise ? 35 : 18));

  for (let i = hours; i >= 0; i--) {
    const timestamp = new Date(Date.now() - i * 60 * 60 * 1000);
    const progress = 1 - i / hours; // 0 → 1 as we approach "now"

    let depth;
    if (def.rapidRise && i <= 1) {
      // Sharp final jump in the last hour to demonstrate rapid-rise detection.
      depth = def.targetDepth;
    } else {
      depth = startDepth + (def.targetDepth - startDepth) * progress + (Math.random() - 0.5) * 3;
    }
    depth = Math.max(2, parseFloat(depth.toFixed(1)));

    // Device goes offline for the demo "offline" drain — stop reporting for the last 40 min.
    if (def.endsOffline && i === 0) break;

    const raw = {
      timestamp,
      waterDistanceCm: parseFloat((120 - depth).toFixed(1)),
      waterDepthCm: depth,
      waterFillPct: parseFloat(((depth / 120) * 100).toFixed(1)),
      rainWetness: Math.random() < 0.15 ? 'DETECTED' : 'NOT_DETECTED',
      ch4Signal: def.deviceId === 'DR-004' && i < 3 ? 0.72 : parseFloat((Math.random() * 0.25).toFixed(2)),
      h2sSignal: parseFloat((Math.random() * 0.2).toFixed(2)),
      o2Percent: def.o2Installed ? parseFloat((20.9 - Math.random() * 0.6).toFixed(1)) : undefined,
    };

    const evaluated = evaluateReading({
      raw,
      thresholds: drain.thresholds,
      previousReading,
      o2Installed: def.o2Installed,
    });

    await SensorReading.create({ drain: drain._id, deviceId: drain.deviceId, ...evaluated, isSimulated: true });
    previousReading = { timestamp, waterDepthCm: depth };
    lastEvaluated = evaluated;
  }

  if (def.endsOffline) {
    // Leave `latest` populated but stale (last reading ~10 hours ago) so the
    // deviceStatus computation naturally reports OFFLINE.
    drain.latest = { ...lastEvaluated, deviceStatus: 'OFFLINE' };
  } else {
    drain.latest = lastEvaluated;
  }
  await drain.save();

  // ── Raise any alerts this final state warrants ──
  const candidates = deriveAlerts(drain, drain.latest);
  const createdAlerts = [];
  for (const c of candidates) {
    const alert = await Alert.create({ drain: drain._id, deviceId: drain.deviceId, ...c });
    createdAlerts.push(alert);
  }

  return { drain, alerts: createdAlerts };
}

async function seed() {
  try {
    await connectDB();
    console.log('🌱 Seeding Smart Drain Monitoring demo data...');
    await seedDrainCollections();

    const results = [];
    for (const def of DRAIN_DEFS) {
      results.push(await seedOneDrain(def));
      console.log(`✅ Seeded ${def.deviceId} — ${def.name}`);
    }

    // ── One fully worked example: Drain Echo diagnostic → Incident on DR-004 (CRITICAL) ──
    const criticalResult = results.find((r) => r.drain.deviceId === 'DR-004');
    const reporter = await User.findOne({ role: 'citizen' });

    if (criticalResult) {
      const diagnostic = await DrainEchoDiagnostic.create({
        drain: criticalResult.drain._id,
        reportedBy: reporter?._id || null,
        location: criticalResult.drain.location,
        audioUrl: '',
        audioDurationSec: 3.1,
        tapCount: 3,
        audioQuality: 'GOOD',
        predictedClass: 'SILT_SLUDGE',
        confidence: 0.85,
        alternatives: [{ class: 'SOLID_WASTE_PLASTIC', confidence: 0.09 }],
        classifierSource: 'DEMO_HEURISTIC',
        recommendedAction: 'Inspect drain / consider jetting equipment for silt or sludge clearance.',
        sensorContext: {
          waterStatus: criticalResult.drain.latest.waterStatus,
          waterFillPct: criticalResult.drain.latest.waterFillPct,
          rainWetness: criticalResult.drain.latest.rainWetness,
          atmosphereStatus: criticalResult.drain.latest.atmosphereStatus,
          ch4Status: criticalResult.drain.latest.ch4Status,
          h2sStatus: criticalResult.drain.latest.h2sStatus,
          o2Status: criticalResult.drain.latest.o2Status,
          capturedAt: criticalResult.drain.latest.timestamp,
        },
      });

      const incident = await DrainIncident.create({
        source: 'DRAIN_ECHO',
        drain: criticalResult.drain._id,
        diagnostic: diagnostic._id,
        status: 'ASSIGNED',
        priority: 'critical',
        reportedBy: reporter?._id || null,
        assignedTeam: 'Zone 3 Rapid Response',
        contextSnapshot: {
          waterStatus: criticalResult.drain.latest.waterStatus,
          waterFillPct: criticalResult.drain.latest.waterFillPct,
          rainWetness: criticalResult.drain.latest.rainWetness,
          atmosphereStatus: criticalResult.drain.latest.atmosphereStatus,
          predictedClass: diagnostic.predictedClass,
          confidence: diagnostic.confidence,
        },
        acknowledgedAt: new Date(Date.now() - 25 * 60 * 1000),
        assignedAt: new Date(Date.now() - 15 * 60 * 1000),
        timeline: [
          { title: 'Incident Created', description: 'Created from drain echo by demo citizen.', timestamp: new Date(Date.now() - 30 * 60 * 1000), actor: reporter?.name || 'Demo Citizen' },
          { title: 'Status: NEW → VERIFIED', description: 'Updated by Municipal Staff.', timestamp: new Date(Date.now() - 25 * 60 * 1000), actor: 'Alisha Moore' },
          { title: 'Status: VERIFIED → ASSIGNED', description: 'Updated by Municipal Staff.', timestamp: new Date(Date.now() - 15 * 60 * 1000), actor: 'Alisha Moore' },
          { title: 'Team Assigned', description: 'Assigned to Zone 3 Rapid Response by Alisha Moore.', timestamp: new Date(Date.now() - 15 * 60 * 1000), actor: 'Alisha Moore' },
        ],
      });

      diagnostic.incident = incident._id;
      await diagnostic.save();
      console.log('✅ Seeded a worked Drain Echo → Incident example on DR-004');
    }

    const totalAlerts = results.reduce((sum, r) => sum + r.alerts.length, 0);
    console.log(`\n📋 Demo drains: ${results.length}, alerts raised: ${totalAlerts}`);
    console.log('   DR-001 NORMAL · DR-002 WARNING · DR-003 HIGH · DR-004 CRITICAL · DR-005 RAPID RISE · DR-006 OFFLINE');
    console.log('\n✅ Drain module seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Drain seed error:', error);
    process.exit(1);
  }
}

seed();
