/**
 * Feed realistic drain data (Indore) into the app.
 *
 *   cd backend
 *   npm run feed:drains            -> adds 10 drains + 7 days of hourly readings + alerts
 *   npm run feed:drains -- --reset -> removes previously fed drains (IND-*) first, then re-adds
 *   npm run feed:drains -- --live  -> after feeding, keeps sending a new reading every 30s
 *
 * Safe: never touches users/issues, never touches the seeded DR-001..DR-006 demo drains.
 * To use YOUR OWN drains, just edit the DRAINS array below (or send real readings via
 * POST /api/drains/:id/readings from your sensor hardware).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Drain = require('../models/Drain');
const SensorReading = require('../models/SensorReading');
const Alert = require('../models/Alert');
const { evaluateReading, deriveAlerts } = require('../services/drainStatusService');

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const LIVE = args.includes('--live');

// baseDepth = normal water depth (cm) | peak = depth at the height of a rain spike
// now = depth right now (decides current status) | gas = current CH4/H2S signal (0-1)
const DRAINS = [
  { deviceId: 'IND-001', name: 'MG Road Storm Drain',        ward: 'Ward 4',  zone: 'Zone 1', lat: 22.7196, lng: 75.8577, address: 'MG Road, near Regal Square',          depthCm: 150, baseDepth: 18, peak: 55, now: 21, gas: 0.08, o2: false },
  { deviceId: 'IND-002', name: 'Rajwada Market Drain',       ward: 'Ward 7',  zone: 'Zone 2', lat: 22.7185, lng: 75.8555, address: 'Rajwada Palace Road',                 depthCm: 140, baseDepth: 30, peak: 70, now: 64, gas: 0.22, o2: false },
  { deviceId: 'IND-003', name: 'Palasia Square Drain',       ward: 'Ward 12', zone: 'Zone 3', lat: 22.7244, lng: 75.8839, address: 'Palasia Chauraha',                    depthCm: 160, baseDepth: 35, peak: 88, now: 78, gas: 0.35, o2: true  },
  { deviceId: 'IND-004', name: 'Sarafa Bazaar Drain',        ward: 'Ward 12', zone: 'Zone 3', lat: 22.7178, lng: 75.8562, address: 'Sarafa Bazaar Lane',                  depthCm: 130, baseDepth: 40, peak: 96, now: 93, gas: 0.72, o2: true  },
  { deviceId: 'IND-005', name: 'Bhawarkuan Junction Drain',  ward: 'Ward 15', zone: 'Zone 4', lat: 22.6928, lng: 75.8675, address: 'Bhawarkuan Square',                   depthCm: 170, baseDepth: 25, peak: 80, now: 47, gas: 0.15, o2: false },
  { deviceId: 'IND-006', name: 'Vijay Nagar Main Drain',     ward: 'Ward 3',  zone: 'Zone 5', lat: 22.7533, lng: 75.8937, address: 'Vijay Nagar Square',                  depthCm: 145, baseDepth: 20, peak: 50, now: 24, gas: 0.05, o2: false },
  { deviceId: 'IND-007', name: 'Rau Circle Drain',           ward: 'Ward 20', zone: 'Zone 6', lat: 22.6410, lng: 75.8060, address: 'Rau Circle, AB Road',                 depthCm: 155, baseDepth: 22, peak: 62, now: 28, gas: 0.12, o2: false },
  { deviceId: 'IND-008', name: 'Khajrana Ganesh Mandir Drain', ward: 'Ward 9', zone: 'Zone 2', lat: 22.7263, lng: 75.9027, address: 'Khajrana Square',                   depthCm: 135, baseDepth: 28, peak: 74, now: 61, gas: 0.66, o2: true  },
  { deviceId: 'IND-009', name: 'Annapurna Road Drain',       ward: 'Ward 18', zone: 'Zone 4', lat: 22.6923, lng: 75.8340, address: 'Annapurna Road',                      depthCm: 150, baseDepth: 19, peak: 45, now: 20, gas: 0.09, o2: false },
  { deviceId: 'IND-010', name: 'Lasudia Mori Drain',         ward: 'Ward 25', zone: 'Zone 6', lat: 22.7590, lng: 75.9110, address: 'Lasudia Mori Chauraha',               depthCm: 140, baseDepth: 26, peak: 65, now: 33, gas: 0.10, o2: false, offline: true }, // last reading > 15 min ago -> shows OFFLINE
];

const HOURS = 24 * 7; // history length
const rnd = (a, b) => a + Math.random() * (b - a);
const round1 = (n) => Math.round(n * 10) / 10;

function buildRaw(def, ts, depth, gasBoost = 0) {
  const gas = Math.min(0.95, def.gas * rnd(0.6, 1.1) + gasBoost);
  return {
    timestamp: ts,
    waterDistanceCm: round1(def.depthCm - depth),
    waterDepthCm: round1(depth),
    waterFillPct: round1((depth / def.depthCm) * 100),
    rainWetness: depth > def.baseDepth * 1.6 ? 'DETECTED' : 'NOT_DETECTED',
    ch4Signal: parseFloat(gas.toFixed(2)),
    h2sSignal: parseFloat((gas * rnd(0.5, 0.9)).toFixed(2)),
    o2Percent: def.o2 ? round1(gas > 0.6 ? rnd(18.8, 19.4) : rnd(20.5, 20.9)) : undefined,
  };
}

// Water depth over time: calm baseline + a rain storm ~2 days ago + a smaller one recently.
function depthAt(def, hoursAgo) {
  if (hoursAgo === 0) return def.now;
  const wave = (center, width, height) => Math.exp(-Math.pow((hoursAgo - center) / width, 2)) * height;
  const storm = wave(46, 4, def.peak - def.baseDepth) + wave(6, 3, (def.now - def.baseDepth) * 0.8);
  return Math.max(3, def.baseDepth + storm + rnd(-1.5, 1.5));
}

async function feedOne(def) {
  let drain = await Drain.findOne({ deviceId: def.deviceId });
  if (drain) { console.log(`↷ ${def.deviceId} already exists (use --reset to rebuild)`); return drain; }

  drain = await Drain.create({
    deviceId: def.deviceId, name: def.name, ward: def.ward, zone: def.zone,
    location: { address: `${def.address}, Indore`, lat: def.lat, lng: def.lng },
    dimensions: { depthCm: def.depthCm, notes: 'Field-fed data' },
    o2Installed: def.o2, isDemo: false,
    calibration: {
      lastCalibratedAt: new Date(Date.now() - 20 * 86400000),
      nextCalibrationDue: new Date(Date.now() + 40 * 86400000),
      lastMaintenanceAt: new Date(Date.now() - 35 * 86400000),
      sensorHealth: { ultrasonic: 'HEALTHY', rain: 'HEALTHY', ch4: 'HEALTHY', h2s: 'HEALTHY', o2: def.o2 ? 'HEALTHY' : 'NOT_INSTALLED' },
    },
  });

  const now = Date.now();
  const lastAgoMin = def.offline ? 90 : 1; // offline drain: last seen 90 min ago
  const docs = [];
  let prev = null;
  for (let h = HOURS; h >= 0; h--) {
    const ts = new Date(now - h * 3600000 - lastAgoMin * 60000);
    const raw = buildRaw(def, ts, depthAt(def, h), h < 3 ? 0 : 0);
    const ev = evaluateReading({ raw, thresholds: drain.thresholds, previousReading: prev, o2Installed: def.o2 });
    docs.push({ drain: drain._id, deviceId: def.deviceId, ...ev, deviceStatus: 'ONLINE' });
    prev = ev;
  }
  await SensorReading.insertMany(docs);

  const latest = docs[docs.length - 1];
  drain.latest = latest;
  await drain.save();

  // Alerts based on the current (latest) state
  for (const c of deriveAlerts(drain, latest)) {
    const open = await Alert.findOne({ drain: drain._id, type: c.type, status: { $ne: 'resolved' } });
    if (!open) await Alert.create({ drain: drain._id, deviceId: def.deviceId, ...c });
  }
  console.log(`✅ ${def.deviceId} — ${def.name}  [${latest.waterStatus}, depth ${latest.waterDepthCm} cm, ${docs.length} readings]`);
  return drain;
}

async function liveLoop() {
  console.log('\n🛰️  Live mode: sending a new reading every 30s. Ctrl+C to stop.');
  setInterval(async () => {
    const drains = await Drain.find({ deviceId: /^IND-/, isActive: true });
    for (const drain of drains) {
      const def = DRAINS.find((d) => d.deviceId === drain.deviceId);
      if (!def || def.offline) continue;
      const prevDepth = drain.latest?.waterDepthCm ?? def.now;
      const depth = Math.max(3, Math.min(def.depthCm - 5, prevDepth + rnd(-2, 2) + (def.now - prevDepth) * 0.1));
      const raw = buildRaw(def, new Date(), depth);
      const previousReading = await SensorReading.findOne({ drain: drain._id }).sort({ timestamp: -1 });
      const ev = evaluateReading({ raw, thresholds: drain.thresholds, previousReading, o2Installed: def.o2 });
      await SensorReading.create({ drain: drain._id, deviceId: drain.deviceId, ...ev });
      drain.latest = ev;
      await drain.save();
      for (const c of deriveAlerts(drain, ev)) {
        const open = await Alert.findOne({ drain: drain._id, type: c.type, status: { $ne: 'resolved' } });
        if (!open) await Alert.create({ drain: drain._id, deviceId: drain.deviceId, ...c });
      }
    }
    console.log(`📡 ${new Date().toLocaleTimeString()} readings sent for ${drains.length} drains`);
  }, 30000);
}

(async () => {
  await connectDB();
  if (RESET) {
    const old = await Drain.find({ deviceId: /^IND-/ });
    const ids = old.map((d) => d._id);
    await SensorReading.deleteMany({ drain: { $in: ids } });
    await Alert.deleteMany({ drain: { $in: ids } });
    await Drain.deleteMany({ _id: { $in: ids } });
    console.log(`🗑️  Removed ${old.length} previously fed drains`);
  }
  console.log('🌱 Feeding drain data...');
  for (const def of DRAINS) await feedOne(def);
  console.log('\n✅ Done. Open the app → Drains / Alerts / Drain Map.');
  if (LIVE) return liveLoop();
  await mongoose.disconnect();
})().catch((e) => { console.error('❌ Feed failed:', e.message); process.exit(1); });
