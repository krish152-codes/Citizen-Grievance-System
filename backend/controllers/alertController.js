const Alert = require('../models/Alert');
const Drain = require('../models/Drain');

// ── GET /api/alerts ─────────────────────────────────────
const getAlerts = async (req, res) => {
  try {
    const { severity, type, status, drain, ward, page = 1, limit = 50 } = req.query;
    const query = {};
    if (severity) query.severity = severity;
    if (type) query.type = type;
    if (status) query.status = status;
    if (drain) query.drain = drain;

    let drainIdsForWard = null;
    if (ward) {
      const wardDrains = await Drain.find({ ward: new RegExp(ward, 'i') }).select('_id');
      drainIdsForWard = wardDrains.map((d) => d._id);
      query.drain = { $in: drainIdsForWard };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [alerts, total] = await Promise.all([
      Alert.find(query)
        .sort({ status: 1, severity: -1, createdAt: -1 })
        .skip(skip)
        .limit(Math.min(parseInt(limit), 100))
        .populate('drain', 'deviceId name ward location')
        .populate('acknowledgedBy', 'name'),
      Alert.countDocuments(query),
    ]);

    const summary = {
      total,
      unacknowledged: await Alert.countDocuments({ ...query, status: 'unacknowledged' }),
      critical: await Alert.countDocuments({ ...query, severity: 'critical', status: { $ne: 'resolved' } }),
    };

    res.json({ success: true, alerts, summary, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/alerts/:id ─────────────────────────────────
const getAlertById = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('drain')
      .populate('acknowledgedBy', 'name')
      .populate('resolvedBy', 'name');
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    res.json({ success: true, alert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/alerts/:id/acknowledge ───────────────────
const acknowledgeAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    if (alert.status === 'unacknowledged') {
      alert.status = 'acknowledged';
      alert.acknowledgedBy = req.user._id;
      alert.acknowledgedAt = new Date();
    }
    await alert.save();
    res.json({ success: true, message: 'Alert acknowledged', alert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/alerts/:id/assign ───────────────────────
const assignAlert = async (req, res) => {
  try {
    const { assignedTeam } = req.body;
    if (!assignedTeam) return res.status(400).json({ success: false, message: 'assignedTeam is required' });

    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });

    alert.assignedTeam = assignedTeam;
    alert.assignedAt = new Date();
    if (alert.status === 'unacknowledged') {
      alert.status = 'acknowledged';
      alert.acknowledgedBy = req.user._id;
      alert.acknowledgedAt = new Date();
    }
    await alert.save();
    res.json({ success: true, message: 'Team assigned', alert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/alerts/:id/resolve ──────────────────────
const resolveAlert = async (req, res) => {
  try {
    const { resolutionNotes } = req.body;
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });

    alert.status = 'resolved';
    alert.resolvedBy = req.user._id;
    alert.resolvedAt = new Date();
    alert.resolutionNotes = resolutionNotes || '';
    await alert.save();

    res.json({ success: true, message: 'Alert resolved', alert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAlerts, getAlertById, acknowledgeAlert, assignAlert, resolveAlert };
