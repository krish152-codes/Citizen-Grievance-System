const DrainIncident = require('../models/DrainIncident');
const Drain = require('../models/Drain');
const Alert = require('../models/Alert');
const DrainEchoDiagnostic = require('../models/DrainEchoDiagnostic');

const { STATUS_FLOW } = DrainIncident;

// Forward-only workflow — no arbitrary jumps. CLOSED can only follow RESOLVED.
const ALLOWED_TRANSITIONS = {
  NEW:          ['VERIFIED', 'ASSIGNED'],
  VERIFIED:     ['ASSIGNED'],
  ASSIGNED:     ['IN_PROGRESS'],
  IN_PROGRESS:  ['RESOLVED'],
  RESOLVED:     ['CLOSED', 'IN_PROGRESS'], // allow reopening if resolution didn't hold
  CLOSED:       [],
};

// ── GET /api/incidents ─────────────────────────────────
const getIncidents = async (req, res) => {
  try {
    const { status, priority, source, drain, page = 1, limit = 50 } = req.query;
    const query = {};
    if (status) query.status = status.includes(',') ? { $in: status.split(',') } : status;
    if (priority) query.priority = priority;
    if (source) query.source = source;
    if (drain) query.drain = drain;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [incidents, total] = await Promise.all([
      DrainIncident.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Math.min(parseInt(limit), 100))
        .populate('drain', 'deviceId name ward location')
        .populate('reportedBy', 'name')
        .populate('assignedTo', 'name'),
      DrainIncident.countDocuments(query),
    ]);

    res.json({ success: true, incidents, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/incidents/:id ─────────────────────────────
const getIncidentById = async (req, res) => {
  try {
    const incident = await DrainIncident.findById(req.params.id)
      .populate('drain')
      .populate('alert')
      .populate('diagnostic')
      .populate('reportedBy', 'name email')
      .populate('assignedTo', 'name email');
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });
    res.json({ success: true, incident });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/incidents ────────────────────────────────
// source: SENSOR_ALERT (needs alertId), DRAIN_ECHO (needs diagnosticId), or MANUAL
const createIncident = async (req, res) => {
  try {
    const { drainId, source, alertId, diagnosticId, priority, notes } = req.body;
    if (!drainId || !source) {
      return res.status(400).json({ success: false, message: 'drainId and source are required' });
    }
    const drain = await Drain.findById(drainId);
    if (!drain) return res.status(404).json({ success: false, message: 'Drain not found' });

    let alert = null;
    let diagnostic = null;
    let contextSnapshot = {
      waterStatus: drain.latest?.waterStatus || '',
      waterFillPct: drain.latest?.waterFillPct,
      rainWetness: drain.latest?.rainWetness || '',
      atmosphereStatus: drain.latest?.atmosphereStatus || '',
    };

    if (source === 'SENSOR_ALERT') {
      if (!alertId) return res.status(400).json({ success: false, message: 'alertId is required for SENSOR_ALERT incidents' });
      alert = await Alert.findById(alertId);
      if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    } else if (source === 'DRAIN_ECHO') {
      if (!diagnosticId) return res.status(400).json({ success: false, message: 'diagnosticId is required for DRAIN_ECHO incidents' });
      diagnostic = await DrainEchoDiagnostic.findById(diagnosticId);
      if (!diagnostic) return res.status(404).json({ success: false, message: 'Drain Echo diagnostic not found' });
      contextSnapshot.predictedClass = diagnostic.predictedClass;
      contextSnapshot.confidence = diagnostic.confidence;
    }

    const derivedPriority = priority
      || (drain.latest?.waterStatus === 'CRITICAL' || drain.latest?.atmosphereStatus === 'ALERT' ? 'critical'
        : drain.latest?.waterStatus === 'HIGH' ? 'high' : 'medium');

    const incident = await DrainIncident.create({
      source,
      drain: drain._id,
      alert: alert?._id || null,
      diagnostic: diagnostic?._id || null,
      priority: derivedPriority,
      reportedBy: req.user?._id || null,
      contextSnapshot,
      timeline: [
        {
          title: 'Incident Created',
          description: notes || `Created from ${source.replace(/_/g, ' ').toLowerCase()}${req.user ? ` by ${req.user.name}` : ''}.`,
          timestamp: new Date(),
          actor: req.user?.name || 'System',
        },
      ],
    });

    if (diagnostic) {
      diagnostic.incident = incident._id;
      await diagnostic.save();
    }

    const populated = await DrainIncident.findById(incident._id).populate('drain').populate('diagnostic').populate('alert');
    res.status(201).json({ success: true, message: 'Incident created', incident: populated });
  } catch (error) {
    console.error('Create incident error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/incidents/:id ───────────────────────────
// Handles status transitions, assignment, and action/resolution notes in one endpoint.
const updateIncident = async (req, res) => {
  try {
    const incident = await DrainIncident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    const { status, assignedTeam, assignedTo, actionTaken, resolutionNotes, priority } = req.body;
    const actorName = req.user?.name || 'Municipal Staff';

    if (status && status !== incident.status) {
      if (!STATUS_FLOW.includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
      }
      const allowed = ALLOWED_TRANSITIONS[incident.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot move incident from ${incident.status} to ${status}. Allowed next steps: ${allowed.join(', ') || 'none'}.`,
        });
      }
      const prevStatus = incident.status;
      incident.status = status;
      if (status === 'VERIFIED' && !incident.acknowledgedAt) incident.acknowledgedAt = new Date();
      if (status === 'ASSIGNED') incident.assignedAt = new Date();
      if (status === 'IN_PROGRESS') incident.startedAt = new Date();
      if (status === 'RESOLVED') incident.resolvedAt = new Date();
      if (status === 'CLOSED') incident.closedAt = new Date();

      incident.timeline.push({
        title: `Status: ${prevStatus} → ${status}`,
        description: `Updated by ${actorName}.`,
        timestamp: new Date(),
        actor: actorName,
      });
    }

    if (assignedTeam !== undefined) {
      incident.assignedTeam = assignedTeam;
      if (!incident.assignedAt) incident.assignedAt = new Date();
      incident.timeline.push({
        title: 'Team Assigned',
        description: `Assigned to ${assignedTeam || 'Unassigned'} by ${actorName}.`,
        timestamp: new Date(),
        actor: actorName,
      });
    }
    if (assignedTo !== undefined) incident.assignedTo = assignedTo || null;

    if (priority) incident.priority = priority;

    if (actionTaken !== undefined && actionTaken !== '') {
      incident.actionTaken = actionTaken;
      incident.timeline.push({
        title: 'Action Recorded',
        description: actionTaken,
        timestamp: new Date(),
        actor: actorName,
      });
    }

    if (resolutionNotes !== undefined && resolutionNotes !== '') {
      incident.resolutionNotes = resolutionNotes;
      incident.timeline.push({
        title: 'Resolution Notes',
        description: resolutionNotes,
        timestamp: new Date(),
        actor: actorName,
      });
    }

    await incident.save();
    const populated = await DrainIncident.findById(incident._id)
      .populate('drain').populate('diagnostic').populate('alert')
      .populate('reportedBy', 'name').populate('assignedTo', 'name');
    res.json({ success: true, message: 'Incident updated', incident: populated });
  } catch (error) {
    console.error('Update incident error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getIncidents, getIncidentById, createIncident, updateIncident, STATUS_FLOW: STATUS_FLOW, ALLOWED_TRANSITIONS };
