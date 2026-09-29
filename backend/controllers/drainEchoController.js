const mongoose = require('mongoose');
const Drain = require('../models/Drain');
const DrainEchoDiagnostic = require('../models/DrainEchoDiagnostic');
const { analyze } = require('../services/audioClassifierService');
const { computeDeviceStatus } = require('../services/drainStatusService');

// ── POST /api/drain-echo/analyze ───────────────────────
// multipart/form-data: audio (file, required) + drainId, durationSec,
// tapCount, lat, lng, address, clientReportedNoisy (optional)
const analyzeDrainEcho = async (req, res) => {
  try {
    const { drainId, durationSec, tapCount, lat, lng, address, clientReportedNoisy } = req.body;

    if (!drainId) return res.status(400).json({ success: false, message: 'drainId is required' });
    const drain = await Drain.findById(drainId);
    if (!drain) return res.status(404).json({ success: false, message: 'Drain not found' });

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'An audio recording is required.' });
    }

    const audioUrl = `/uploads/drain-echo/${req.file.filename}`;
    const parsedDuration = parseFloat(durationSec) || 0;
    const parsedTapCount = parseInt(tapCount) || 0;

    const result = await analyze({
      filename: req.file.filename,
      sizeBytes: req.file.size,
      durationSec: parsedDuration,
      tapCount: parsedTapCount,
      clientReportedNoisy: clientReportedNoisy === 'true' || clientReportedNoisy === true,
      audioPath: req.file.path,
    });

    // Sensor context snapshot, clearly separate from the acoustic result.
    const deviceStatus = computeDeviceStatus(drain.latest?.timestamp, drain.thresholds?.offlineTimeoutMin ?? 15);
    const sensorContext = {
      waterStatus: drain.latest?.waterStatus || 'NORMAL',
      waterFillPct: drain.latest?.waterFillPct,
      rainWetness: drain.latest?.rainWetness || 'NOT_DETECTED',
      atmosphereStatus: drain.latest?.atmosphereStatus || 'NORMAL',
      ch4Status: drain.latest?.ch4Status || 'NORMAL',
      h2sStatus: drain.latest?.h2sStatus || 'NORMAL',
      o2Status: drain.latest?.o2Status || 'NOT_INSTALLED',
      capturedAt: drain.latest?.timestamp,
    };
    if (deviceStatus === 'OFFLINE') {
      sensorContext.stale = true;
    }

    const diagnostic = await DrainEchoDiagnostic.create({
      drain: drain._id,
      reportedBy: req.user?._id || null,
      location: {
        address: address || drain.location?.address || '',
        lat: lat != null ? parseFloat(lat) : drain.location?.lat,
        lng: lng != null ? parseFloat(lng) : drain.location?.lng,
      },
      audioUrl,
      audioDurationSec: parsedDuration,
      tapCount: parsedTapCount,
      audioQuality: result.audioQuality,
      predictedClass: result.predictedClass,
      confidence: result.confidence,
      alternatives: result.alternatives,
      classifierSource: result.classifierSource,
      recommendedAction: result.recommendedAction,
      sensorContext,
    });

    res.status(201).json({ success: true, message: 'Recording analyzed', diagnostic, deviceStatus });
  } catch (error) {
    console.error('Drain Echo analyze error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to analyze recording' });
  }
};

// ── GET /api/drain-echo/history ────────────────────────
const getDrainEchoHistory = async (req, res) => {
  try {
    const { drain, predictedClass, minConfidence, incidentStatus, page = 1, limit = 30 } = req.query;
    const query = {};
    if (drain) query.drain = drain;
    if (predictedClass) query.predictedClass = predictedClass;
    if (minConfidence) query.confidence = { $gte: parseFloat(minConfidence) };

    let diagnostics = await DrainEchoDiagnostic.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 100))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('drain', 'deviceId name ward')
      .populate('reportedBy', 'name')
      .populate({ path: 'incident', select: 'incidentId status' });

    if (incidentStatus === 'none') {
      diagnostics = diagnostics.filter((d) => !d.incident);
    } else if (incidentStatus) {
      diagnostics = diagnostics.filter((d) => d.incident?.status === incidentStatus);
    }

    const total = await DrainEchoDiagnostic.countDocuments(query);
    res.json({ success: true, diagnostics, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    console.error('Drain Echo history error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/drain-echo/:id ────────────────────────────
const getDrainEchoById = async (req, res) => {
  try {
    const diagnostic = await DrainEchoDiagnostic.findById(req.params.id)
      .populate('drain')
      .populate('reportedBy', 'name')
      .populate('incident');
    if (!diagnostic) return res.status(404).json({ success: false, message: 'Diagnostic not found' });
    res.json({ success: true, diagnostic });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { analyzeDrainEcho, getDrainEchoHistory, getDrainEchoById };
