/**
 * Dev/demo sensor simulator.
 *
 * Only starts if SENSOR_SIMULATOR=true is set (see server.js) — by default
 * it never runs, so production behavior is completely unaffected.
 *
 * It only ever writes to drains flagged `isDemo: true` (created by
 * `npm run seed:drains`), so it can never fabricate data on a drain that's
 * receiving real hardware readings. Every reading it creates is tagged
 * `isSimulated: true` so the UI can label it clearly.
 */
const Drain = require('../models/Drain');
const SensorReading = require('../models/SensorReading');
const Alert = require('../models/Alert');
const { evaluateReading, deriveAlerts } = require('../services/drainStatusService');

const INTERVAL_MS = parseInt(process.env.SENSOR_SIMULATOR_INTERVAL_MS) || 60 * 1000;
let timer = null;

async function tick() {
  try {
    const demoDrains = await Drain.find({ isDemo: true, isActive: true });
    for (const drain of demoDrains) {
      const previous = drain.latest?.waterDepthCm ?? 20;
      // Small random walk — mostly stable, occasionally drifts.
      const delta = (Math.random() - 0.5) * 4;
      const depth = Math.max(2, parseFloat((previous + delta).toFixed(1)));

      const raw = {
        timestamp: new Date(),
        waterDistanceCm: parseFloat((120 - depth).toFixed(1)),
        waterDepthCm: depth,
        waterFillPct: parseFloat(((depth / 120) * 100).toFixed(1)),
        rainWetness: Math.random() < 0.1 ? 'DETECTED' : 'NOT_DETECTED',
        ch4Signal: parseFloat((Math.random() * 0.25).toFixed(2)),
        h2sSignal: parseFloat((Math.random() * 0.2).toFixed(2)),
        o2Percent: drain.o2Installed ? parseFloat((20.9 - Math.random() * 0.6).toFixed(1)) : undefined,
      };

      const previousReading = await SensorReading.findOne({ drain: drain._id }).sort({ timestamp: -1 });
      const evaluated = evaluateReading({ raw, thresholds: drain.thresholds, previousReading, o2Installed: drain.o2Installed });

      await SensorReading.create({ drain: drain._id, deviceId: drain.deviceId, ...evaluated, isSimulated: true });
      drain.latest = evaluated;
      await drain.save();

      const candidates = deriveAlerts(drain, evaluated);
      for (const c of candidates) {
        const openExisting = await Alert.findOne({ drain: drain._id, type: c.type, status: { $ne: 'resolved' } });
        if (!openExisting) await Alert.create({ drain: drain._id, deviceId: drain.deviceId, ...c });
      }
    }
  } catch (err) {
    // Never let a simulator hiccup take down the server.
    console.warn('⚠️  Sensor simulator tick failed:', err.message);
  }
}

function start() {
  if (timer) return;
  console.log(`🛰️  Sensor simulator started (every ${INTERVAL_MS / 1000}s, demo drains only)`);
  timer = setInterval(tick, INTERVAL_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop };
