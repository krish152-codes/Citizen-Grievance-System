const mongoose = require('mongoose');
const Drain = require('../models/Drain');
const SensorReading = require('../models/SensorReading');
const Alert = require('../models/Alert');
const { evaluateReading, deriveAlerts, computeDeviceStatus } = require('../services/drainStatusService');

// ── GET /api/drains ────────────────────────────────────
// Public-safe: citizens can see status, but not internal threshold config.
const getDrains = async (req, res) => {
  try {
    const { ward, status, search, includeOffline = 'true' } = req.query;
    const query = { isActive: true };
    if (ward) query.ward = new RegExp(ward, 'i');
    if (status) query['latest.waterStatus'] = status;
    if (search) {
      query.$or = [
        { deviceId: new RegExp(search, 'i') },
        { name: new RegExp(search, 'i') },
        { ward: new RegExp(search, 'i') },
        { 'location.address': new RegExp(search, 'i') },
      ];
    }

    let drains = await Drain.find(query).sort({ 'latest.waterStatus': -1, deviceId: 1 }).lean();

    // Recompute live device-online status (offline timeout may have elapsed
    // since the last reading, without a new reading ever arriving).
    drains = drains.map((d) => ({
      ...d,
      latest: {
        ...d.latest,
        deviceStatus: computeDeviceStatus(d.latest?.timestamp, d.thresholds?.offlineTimeoutMin ?? 15),
      },
    }));

    if (includeOffline === 'false') {
      drains = drains.filter((d) => d.latest.deviceStatus === 'ONLINE');
    }

    const summary = {
      total: drains.length,
      normal: drains.filter((d) => d.latest.waterStatus === 'NORMAL').length,
      warning: drains.filter((d) => d.latest.waterStatus === 'WARNING').length,
      high: drains.filter((d) => d.latest.waterStatus === 'HIGH').length,
      critical: drains.filter((d) => d.latest.waterStatus === 'CRITICAL').length,
      offline: drains.filter((d) => d.latest.deviceStatus === 'OFFLINE').length,
      atmosphereAlerts: drains.filter((d) => d.latest.atmosphereStatus === 'ALERT').length,
    };

    res.json({ success: true, drains, summary });
  } catch (error) {
    console.error('Get drains error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/drains/:id ────────────────────────────────
const getDrainById = async (req, res) => {
  try {
    const idParam = req.params.id;
    const isMongoId = mongoose.isValidObjectId(idParam);
    const drain = await Drain.findOne(isMongoId ? { _id: idParam } : { deviceId: idParam.toUpperCase() }).lean();
    if (!drain) return res.status(404).json({ success: false, message: 'Drain not found' });

    drain.latest.deviceStatus = computeDeviceStatus(drain.latest?.timestamp, drain.thresholds?.offlineTimeoutMin ?? 15);

    const [openAlerts, recentDiagnosticsCount] = await Promise.all([
      Alert.countDocuments({ drain: drain._id, status: { $ne: 'resolved' } }),
      mongoose.model('DrainEchoDiagnostic').countDocuments({ drain: drain._id }),
    ]);

    res.json({ success: true, drain, openAlertsCount: openAlerts, drainEchoCount: recentDiagnosticsCount });
  } catch (error) {
    console.error('Get drain error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/drains/:id/readings ───────────────────────
// Paginated raw readings, most recent first.
const getDrainReadings = async (req, res) => {
  try {
    const drain = await Drain.findById(req.params.id).select('_id');
    if (!drain) return res.status(404).json({ success: false, message: 'Drain not found' });

    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [readings, total] = await Promise.all([
      SensorReading.find({ drain: drain._id }).sort({ timestamp: -1 }).skip(skip).limit(Math.min(parseInt(limit), 200)),
      SensorReading.countDocuments({ drain: drain._id }),
    ]);

    res.json({ success: true, readings, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/drains/:id/trends?range=24h|7d|30d ────────
// Aggregates readings into buckets so the frontend never has to load
// thousands of raw points into a chart.
const getDrainTrends = async (req, res) => {
  try {
    const drain = await Drain.findById(req.params.id).select('_id');
    if (!drain) return res.status(404).json({ success: false, message: 'Drain not found' });

    const range = req.query.range || '24h';
    const rangeConfig = {
      '24h': { hours: 24, dateFormat: '%Y-%m-%dT%H:00' },   // hourly buckets
      '7d':  { hours: 24 * 7, dateFormat: '%Y-%m-%dT%H:00' }, // hourly buckets
      '30d': { hours: 24 * 30, dateFormat: '%Y-%m-%d' },      // daily buckets
    };
    const cfg = rangeConfig[range] || rangeConfig['24h'];
    const since = new Date(Date.now() - cfg.hours * 60 * 60 * 1000);

    const buckets = await SensorReading.aggregate([
      { $match: { drain: drain._id, timestamp: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: cfg.dateFormat, date: '$timestamp' } },
          avgWaterDepthCm: { $avg: '$waterDepthCm' },
          maxWaterDepthCm: { $max: '$waterDepthCm' },
          avgCh4: { $avg: '$ch4Signal' },
          avgH2s: { $avg: '$h2sSignal' },
          avgO2: { $avg: '$o2Percent' },
          rainEvents: { $sum: { $cond: [{ $eq: ['$rainWetness', 'DETECTED'] }, 1, 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const trend = buckets.map((b) => ({
      bucket: b._id,
      waterDepthCm: b.avgWaterDepthCm != null ? parseFloat(b.avgWaterDepthCm.toFixed(1)) : null,
      maxWaterDepthCm: b.maxWaterDepthCm != null ? parseFloat(b.maxWaterDepthCm.toFixed(1)) : null,
      ch4Signal: b.avgCh4 != null ? parseFloat(b.avgCh4.toFixed(2)) : null,
      h2sSignal: b.avgH2s != null ? parseFloat(b.avgH2s.toFixed(2)) : null,
      o2Percent: b.avgO2 != null ? parseFloat(b.avgO2.toFixed(1)) : null,
      rainEvents: b.rainEvents,
    }));

    res.json({ success: true, range, trend, empty: trend.length === 0 });
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/drains ───────────────────────────────────
const createDrain = async (req, res) => {
  try {
    const { deviceId, name, ward, zone, location, dimensions, o2Installed } = req.body;
    if (!deviceId || !name) {
      return res.status(400).json({ success: false, message: 'deviceId and name are required' });
    }
    const existing = await Drain.findOne({ deviceId: deviceId.toUpperCase() });
    if (existing) return res.status(409).json({ success: false, message: `Drain ${deviceId} already exists` });

    const drain = await Drain.create({
      deviceId: deviceId.toUpperCase(),
      name,
      ward: ward || '',
      zone: zone || '',
      location: location || {},
      dimensions: dimensions || {},
      o2Installed: !!o2Installed,
    });

    res.status(201).json({ success: true, message: 'Drain created', drain });
  } catch (error) {
    console.error('Create drain error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/drains/:id/thresholds ───────────────────
const updateThresholds = async (req, res) => {
  try {
    const drain = await Drain.findById(req.params.id);
    if (!drain) return res.status(404).json({ success: false, message: 'Drain not found' });

    const allowedKeys = [
      'warningCm', 'highCm', 'criticalCm', 'rapidRiseCmPerMin',
      'ch4AlertSignal', 'h2sAlertSignal', 'o2LowPercent', 'offlineTimeoutMin',
    ];
    const updates = {};
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        const val = parseFloat(req.body[key]);
        if (Number.isNaN(val) || val < 0) {
          return res.status(400).json({ success: false, message: `Invalid value for ${key}` });
        }
        updates[key] = val;
      }
    }
    // Basic sanity ordering check when the relevant fields are present together
    const merged = { ...drain.thresholds.toObject(), ...updates };
    if (!(merged.warningCm < merged.highCm && merged.highCm < merged.criticalCm)) {
      return res.status(400).json({
        success: false,
        message: 'Thresholds must satisfy warning < high < critical',
      });
    }

    const previous = drain.thresholds.toObject();
    drain.thresholds = merged;
    drain.thresholdHistory.push({
      changedBy: req.user?._id,
      changedByName: req.user?.name || 'Unknown',
      changedAt: new Date(),
      previous,
      updated: merged,
    });
    await drain.save();

    res.json({ success: true, message: 'Thresholds updated', drain });
  } catch (error) {
    console.error('Update thresholds error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/drains/:id/calibration ──────────────────
const updateCalibration = async (req, res) => {
  try {
    const drain = await Drain.findById(req.params.id);
    if (!drain) return res.status(404).json({ success: false, message: 'Drain not found' });

    const { lastCalibratedAt, nextCalibrationDue, lastMaintenanceAt, sensorHealth } = req.body;
    if (lastCalibratedAt) drain.calibration.lastCalibratedAt = new Date(lastCalibratedAt);
    if (nextCalibrationDue) drain.calibration.nextCalibrationDue = new Date(nextCalibrationDue);
    if (lastMaintenanceAt) drain.calibration.lastMaintenanceAt = new Date(lastMaintenanceAt);
    if (sensorHealth && typeof sensorHealth === 'object') {
      drain.calibration.sensorHealth = { ...drain.calibration.sensorHealth.toObject(), ...sensorHealth };
    }
    await drain.save();

    res.json({ success: true, message: 'Calibration/maintenance record updated', drain });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/drains/:id/readings ──────────────────────
// Accepts a raw sensor payload (from real hardware, or the dev simulator),
// evaluates status, persists the reading, updates the drain's denormalized
// snapshot, and raises any alerts that are now warranted.
const ingestReading = async (req, res) => {
  try {
    const drain = await Drain.findById(req.params.id);
    if (!drain) return res.status(404).json({ success: false, message: 'Drain not found' });

    // Lightweight device-key gate for unauthenticated hardware/simulator ingestion.
    const requiredKey = process.env.DEVICE_INGEST_KEY;
    if (requiredKey && !req.user) {
      const providedKey = req.headers['x-device-key'];
      if (providedKey !== requiredKey) {
        return res.status(401).json({ success: false, message: 'Invalid or missing device key' });
      }
    }

    const {
      waterDistanceCm, waterDepthCm, waterFillPct,
      rainWetness, ch4Signal, h2sSignal, o2Percent,
      timestamp,
    } = req.body;

    if (waterDepthCm == null || Number.isNaN(parseFloat(waterDepthCm))) {
      return res.status(400).json({ success: false, message: 'waterDepthCm is required and must be numeric' });
    }
    if (parseFloat(waterDepthCm) < 0) {
      return res.status(400).json({ success: false, message: 'waterDepthCm cannot be negative' });
    }

    const previousReading = await SensorReading.findOne({ drain: drain._id }).sort({ timestamp: -1 });

    const raw = {
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      waterDistanceCm: waterDistanceCm != null ? parseFloat(waterDistanceCm) : undefined,
      waterDepthCm: parseFloat(waterDepthCm),
      waterFillPct: waterFillPct != null ? parseFloat(waterFillPct) : undefined,
      rainWetness: rainWetness === 'DETECTED' ? 'DETECTED' : 'NOT_DETECTED',
      ch4Signal: ch4Signal != null ? parseFloat(ch4Signal) : 0,
      h2sSignal: h2sSignal != null ? parseFloat(h2sSignal) : 0,
      o2Percent: o2Percent != null ? parseFloat(o2Percent) : undefined,
    };

    const evaluated = evaluateReading({
      raw,
      thresholds: drain.thresholds,
      previousReading,
      o2Installed: drain.o2Installed,
    });

    const reading = await SensorReading.create({ drain: drain._id, deviceId: drain.deviceId, ...evaluated });

    drain.latest = evaluated;
    await drain.save();

    // ── Raise alerts, de-duplicated against already-open alerts of the same type ──
    const candidateAlerts = deriveAlerts(drain, evaluated);
    const createdAlerts = [];
    for (const candidate of candidateAlerts) {
      const openExisting = await Alert.findOne({ drain: drain._id, type: candidate.type, status: { $ne: 'resolved' } });
      if (!openExisting) {
        const alert = await Alert.create({ drain: drain._id, deviceId: drain.deviceId, ...candidate });
        createdAlerts.push(alert);
      }
    }

    res.status(201).json({ success: true, message: 'Reading recorded', reading, alertsCreated: createdAlerts.length });
  } catch (error) {
    console.error('Ingest reading error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDrains,
  getDrainById,
  getDrainReadings,
  getDrainTrends,
  createDrain,
  updateThresholds,
  updateCalibration,
  ingestReading,
};
