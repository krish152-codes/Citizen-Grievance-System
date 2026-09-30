/**
 * Regional drain feed — 6 NCR localities.
 *
 * WHAT IS REAL vs SIMULATED (be honest about this in your demo / report):
 *   REAL      : locality names, authority/city, real rainfall (Open-Meteo, free, no API key)
 *   ESTIMATED : lat/lng (approximate - verify on Google Maps and edit below)
 *   SIMULATED : drain dimensions, water depth, gas signals. Water depth is MODELLED from the
 *               real rainfall (more rain -> water rises, then drains away), not measured.
 *
 * Replace SIMULATED values with real sensor readings by POSTing to
 * /api/drains/:id/readings from hardware (see README section in the chat answer).
 */
const Drain = require('../models/Drain');
const SensorReading = require('../models/SensorReading');
const Alert = require('../models/Alert');
const { evaluateReading, deriveAlerts } = require('./drainStatusService');

// ⚠️ lat/lng are APPROXIMATE (±1–2 km). Google Maps -> right-click the spot -> copy coordinates -> paste here.
const LOCALITIES = [
  { deviceId: 'NCR-001', name: 'Alpha 1 Main Drain',     ward: 'Alpha 1',    zone: 'Greater Noida (GNIDA)',            lat: 28.4790, lng: 77.5100, baseDepth: 18, gas: 0.08 },
  { deviceId: 'NCR-002', name: 'Sector 71 Storm Drain',  ward: 'Sector 71',  zone: 'Noida (Noida Authority)',          lat: 28.5450, lng: 77.3900, baseDepth: 22, gas: 0.10 },
  { deviceId: 'NCR-003', name: 'Delta 1 Main Drain',     ward: 'Delta 1',    zone: 'Greater Noida (GNIDA)',            lat: 28.4660, lng: 77.5040, baseDepth: 20, gas: 0.09 },
  { deviceId: 'NCR-004', name: 'Delta 2 Main Drain',     ward: 'Delta 2',    zone: 'Greater Noida (GNIDA)',            lat: 28.4570, lng: 77.5080, baseDepth: 21, gas: 0.09 },
  { deviceId: 'NCR-005', name: 'Nehru Nagar Drain',      ward: 'Nehru Nagar', zone: 'Ghaziabad (Municipal Corporation)', lat: 28.6640, lng: 77.4320, baseDepth: 30, gas: 0.25 },
  { deviceId: 'NCR-006', name: 'Moti Nagar Drain',       ward: 'Moti Nagar', zone: 'Delhi (MCD)',                      lat: 28.6580, lng: 77.1430, baseDepth: 28, gas: 0.22 },
];

const DEPTH_CM = 150;          // assumed drain depth — replace with surveyed value
const CM_PER_MM_RAIN = 4;      // modelled: 1 mm of rain in an hour raises water ~4 cm
const DRAIN_DECAY_PER_HOUR = 0.8; // excess water drains away (20% of the excess per hour)
const rnd = (a, b) => a + Math.random() * (b - a);
const r1 = (n) => Math.round(n * 10) / 10;

// ── Real rainfall from Open-Meteo (free, no key) ──────────────────────────
async function fetchRain(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=precipitation&current=precipitation&past_days=7&forecast_days=1&timezone=Asia%2FKolkata`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const j = await res.json();
  return {
    hourly: (j.hourly.time || []).map((t, i) => ({ time: new Date(t + '+05:30'), mm: j.hourly.precipitation[i] || 0 })),
    currentMm: j.current?.precipitation ?? 0,
  };
}

function nextDepth(prev, base, rainMm, hours) {
  const excess = Math.max(0, prev - base) * Math.pow(DRAIN_DECAY_PER_HOUR, hours);
  return Math.min(DEPTH_CM - 5, Math.max(3, base + excess + rainMm * CM_PER_MM_RAIN + rnd(-0.6, 0.6)));
}

function buildRaw(loc, ts, depth, rainMm) {
  const gas = Math.min(0.95, loc.gas * rnd(0.85, 1.15) + (depth > 60 ? 0.08 : 0));
  return {
    timestamp: ts,
    waterDistanceCm: r1(DEPTH_CM - depth),
    waterDepthCm: r1(depth),
    waterFillPct: r1((depth / DEPTH_CM) * 100),
    rainWetness: rainMm > 0.1 ? 'DETECTED' : 'NOT_DETECTED',
    ch4Signal: parseFloat(gas.toFixed(2)),
    h2sSignal: parseFloat((gas * rnd(0.5, 0.9)).toFixed(2)),
  };
}

async function raiseAlerts(drain, ev) {
  for (const c of deriveAlerts(drain, ev)) {
    const open = await Alert.findOne({ drain: drain._id, type: c.type, status: { $ne: 'resolved' } });
    if (!open) await Alert.create({ drain: drain._id, deviceId: drain.deviceId, ...c });
  }
}

// ── Create drains + 7 days of history built from REAL past rainfall ───────
async function ensureDrain(loc, { reset = false } = {}) {
  let drain = await Drain.findOne({ deviceId: loc.deviceId });
  if (drain && reset) {
    await SensorReading.deleteMany({ drain: drain._id });
    await Alert.deleteMany({ drain: drain._id });
    await Drain.deleteOne({ _id: drain._id });
    drain = null;
  }
  if (drain) return drain;

  drain = await Drain.create({
    deviceId: loc.deviceId, name: loc.name, ward: loc.ward, zone: loc.zone,
    location: { address: `${loc.ward}, ${loc.zone}`, lat: loc.lat, lng: loc.lng },
    dimensions: { depthCm: DEPTH_CM, notes: 'Location real (coords approx). Depth/gas SIMULATED; rainfall REAL (Open-Meteo).' },
    o2Installed: false, isDemo: false,
    calibration: {
      lastCalibratedAt: new Date(), nextCalibrationDue: new Date(Date.now() + 60 * 86400000),
      sensorHealth: { ultrasonic: 'HEALTHY', rain: 'HEALTHY', ch4: 'HEALTHY', h2s: 'HEALTHY', o2: 'NOT_INSTALLED' },
    },
  });

  let rain;
  try { rain = await fetchRain(loc.lat, loc.lng); }
  catch (e) { console.warn(`⚠️  ${loc.deviceId}: rainfall fetch failed (${e.message}) — using dry history`); rain = { hourly: [], currentMm: 0 }; }

  const nowMs = Date.now();
  const hist = rain.hourly.filter((h) => h.time.getTime() <= nowMs).slice(-168);
  let depth = loc.baseDepth, prev = null;
  const docs = [];
  for (const h of hist) {
    depth = nextDepth(depth, loc.baseDepth, h.mm, 1);
    const raw = buildRaw(loc, h.time, depth, h.mm);
    const ev = evaluateReading({ raw, thresholds: drain.thresholds, previousReading: prev, o2Installed: false });
    docs.push({ drain: drain._id, deviceId: loc.deviceId, ...ev, deviceStatus: 'ONLINE' });
    prev = ev;
  }
  if (docs.length) {
    await SensorReading.insertMany(docs);
    drain.latest = docs[docs.length - 1];
    await drain.save();
  }
  await tickOne(loc, drain, rain.currentMm);
  return drain;
}

// ── One live reading (uses REAL current rainfall) ─────────────────────────
async function tickOne(loc, drain, currentMmOverride) {
  let mm = currentMmOverride;
  if (mm === undefined) {
    try { mm = (await fetchRain(loc.lat, loc.lng)).currentMm; }
    catch (e) { mm = 0; console.warn(`⚠️  ${loc.deviceId}: rainfall fetch failed (${e.message})`); }
  }
  const previousReading = await SensorReading.findOne({ drain: drain._id }).sort({ timestamp: -1 });
  const prevDepth = previousReading?.waterDepthCm ?? loc.baseDepth;
  const gapH = previousReading ? Math.min(2, (Date.now() - previousReading.timestamp) / 3600000) : 1;
  const depth = nextDepth(prevDepth, loc.baseDepth, mm * Math.min(1, gapH * 4), gapH);
  const raw = buildRaw(loc, new Date(), depth, mm);
  const ev = evaluateReading({ raw, thresholds: drain.thresholds, previousReading, o2Installed: false });
  await SensorReading.create({ drain: drain._id, deviceId: loc.deviceId, ...ev, deviceStatus: 'ONLINE' });
  drain.latest = ev;
  await drain.save();
  await raiseAlerts(drain, ev);
  console.log(`📡 ${loc.deviceId} ${loc.ward}: rain ${mm} mm → depth ${ev.waterDepthCm} cm [${ev.waterStatus}]`);
}

async function tickAll() {
  for (const loc of LOCALITIES) {
    const drain = await Drain.findOne({ deviceId: loc.deviceId });
    if (drain) await tickOne(loc, drain); else await ensureDrain(loc);
  }
}

async function seedAll(opts) {
  for (const loc of LOCALITIES) {
    await ensureDrain(loc, opts);
    console.log(`✅ ${loc.deviceId} — ${loc.name} (${loc.zone})`);
  }
}

/** Start in-process live feed (used by server.js when REGIONAL_DRAIN_LIVE=true). */
function startLive(intervalMin = 10) {
  seedAll().then(() => {
    console.log(`🌧️  Regional drain feed live: real rainfall every ${intervalMin} min for ${LOCALITIES.length} localities`);
    setInterval(() => tickAll().catch((e) => console.warn('Regional feed tick failed:', e.message)), intervalMin * 60000);
  }).catch((e) => console.warn('Regional feed failed to start:', e.message));
}

module.exports = { LOCALITIES, seedAll, tickAll, startLive, fetchRain, nextDepth };
