const Issue  = require('../models/Issue');
const User   = require('../models/User');
const {
  classifyIssue,
  multimodalAnalysis,
  transcribeVoice,
} = require('../services/aiService');

// ── POST /api/issues/report ───────────────────────────
const reportIssue = async (req, res) => {
  try {
    const { title, description, category, priority, location, isUrgent, transcript: bodyTranscript } = req.body;

    // ── Collect uploaded files ────────────────────────
    // combinedUpload puts images under req.files.images and voice under req.files.voice
    const imageFiles = (req.files?.images || req.files || []);
    const voiceFiles = req.files?.voice || [];

    // At least 1 image is required
    if (!imageFiles || imageFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least 1 image is required to submit a complaint.',
      });
    }

    const imageUrls     = imageFiles.map(f => `/uploads/${f.filename}`);
    const imageFilenames = imageFiles.map(f => f.filename);
    const voiceFile     = voiceFiles[0] || null;
    const voiceUrl      = voiceFile ? `/uploads/voice/${voiceFile.filename}` : '';

    // ── Voice transcription (Whisper if API key set) ──
    let transcript = bodyTranscript || '';
    if (voiceFile && !transcript) {
      try {
        const result = await transcribeVoice(voiceFile.path);
        transcript = result.transcript || '';
      } catch (_) {}
    }

    // ── Multimodal AI analysis ────────────────────────
    const combinedText = description?.trim() || '';
    const aiResult = await multimodalAnalysis({
      text:            combinedText,
      imageFilenames,
      transcript,
    });

    // ── Parse location ────────────────────────────────
    let parsedLocation = {};
    try {
      parsedLocation = typeof location === 'string' ? JSON.parse(location) : (location || {});
    } catch (_) {}

    // ── Build issue title (auto if not provided) ──────
    const autoTitle = title?.trim()
      || (combinedText ? combinedText.slice(0, 80) : null)
      || aiResult.aiGeneratedSummary?.slice(0, 80)
      || `${aiResult.category?.replace(/_/g, ' ')} issue reported`;

    // ── Build issue ───────────────────────────────────
    const issueData = {
      title:       autoTitle,
      description: combinedText || aiResult.aiGeneratedSummary || 'Submitted via image/voice.',
      category:    category   || aiResult.category   || 'other',
      priority:    priority   || aiResult.priority   || 'medium',
      isUrgent:    isUrgent === 'true' || isUrgent === true || aiResult.emergencyFlag,

      // Media
      imageUrls,
      voiceMessageUrl: voiceUrl,

      // AI multimodal fields
      transcript,
      aiGeneratedSummary: aiResult.aiGeneratedSummary || '',
      aiDetectedCategory: aiResult.category           || '',
      aiCriticality:      Math.round(aiResult.criticalityScore || 0),
      aiConfidence:       aiResult.confidence         || 0,
      aiSeverity:         aiResult.severity           || 'medium',
      emergencyFlag:      aiResult.emergencyFlag      || false,
      detectedObjects:    aiResult.detectedObjects    || [],
      extractedKeywords:  aiResult.extractedKeywords  || [],
      analysisTimestamp:  aiResult.analysisTimestamp  || new Date(),

      // Legacy compat
      aiCategory:          aiResult.category          || '',
      aiRecommendedAction: aiResult.recommendedAction || '',
      sentiment:           aiResult.sentiment         || { score: 0, label: 'neutral' },

      location: {
        address:  parsedLocation.address  || '',
        lat:      parsedLocation.lat      || null,
        lng:      parsedLocation.lng      || null,
        district: parsedLocation.district || '',
      },

      reportedBy: req.user?._id || null,
      department: aiResult.department || 'Municipal Corporation',
      status:     'pending',

      timeline: [
        {
          title:       'Issue Reported',
          description: `Reported via Nagar Mitra${req.user ? ` by ${req.user.name}` : ' (anonymous)'}. ${imageFiles.length} image(s)${voiceFile ? ', voice message' : ''} attached.`,
          timestamp:   new Date(),
          actor:       req.user?.name || 'Anonymous Citizen',
        },
        {
          title:       'AI Multimodal Analysis Complete',
          description: `Classified as "${aiResult.category}" (${Math.round((aiResult.confidence || 0) * 100)}% confidence). Priority: ${aiResult.priority}. ${aiResult.emergencyFlag ? '🚨 EMERGENCY FLAGGED.' : ''} Routed to ${aiResult.department}.`,
          timestamp:   new Date(),
          actor:       'Nagar Mitra AI',
        },
      ],
    };

    const issue = await Issue.create(issueData);

    if (req.user?._id) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { issuesReported: 1 } });
    }

    const populated = await Issue.findById(issue._id).populate('reportedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Issue reported successfully',
      issue:   populated,
    });
  } catch (error) {
    console.error('Report issue error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to report issue' });
  }
};

// ── GET /api/issues ───────────────────────────────────
const getIssues = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category, priority, search, district, department, emergency } = req.query;
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (status)     { const statuses = status.split(','); query.status = statuses.length > 1 ? { $in: statuses } : status; }
    if (category)   query.category   = category;
    if (priority)   query.priority   = priority;
    if (department) query.department = new RegExp(department, 'i');
    if (district)   query['location.district'] = new RegExp(district, 'i');
    if (emergency === 'true') query.emergencyFlag = true;
    if (search) {
      query.$or = [
        { title:             { $regex: search, $options: 'i' } },
        { description:       { $regex: search, $options: 'i' } },
        { ticketId:          { $regex: search, $options: 'i' } },
        { aiGeneratedSummary:{ $regex: search, $options: 'i' } },
        { 'location.address':{ $regex: search, $options: 'i' } },
      ];
    }
    if (req.user?.role === 'citizen') query.reportedBy = req.user._id;

    // Emergency complaints always at top, then by date
    const [issues, total] = await Promise.all([
      Issue.find(query)
        .sort({ emergencyFlag: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('reportedBy', 'name email')
        .populate('assignedTo', 'name email'),
      Issue.countDocuments(query),
    ]);

    res.json({
      success:    true,
      issues,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), limit: parseInt(limit) },
    });
  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/issues/:id ───────────────────────────────
const getIssueById = async (req, res) => {
  try {
    const idParam  = req.params.id;
    const isMongoId = /^[a-f\d]{24}$/i.test(idParam);
    const issue    = await Issue.findOne(isMongoId ? { _id: idParam } : { ticketId: idParam })
      .populate('reportedBy', 'name email phone')
      .populate('assignedTo', 'name email');

    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    await Issue.findByIdAndUpdate(issue._id, { $inc: { views: 1 } });
    res.json({ success: true, issue });
  } catch (error) {
    console.error('Get issue error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/issues/:id/status ──────────────────────
const updateIssueStatus = async (req, res) => {
  try {
    const { status, notes, notifyCitizen } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'Status is required' });

    const issue = await Issue.findById(req.params.id);
    if (!issue)  return res.status(404).json({ success: false, message: 'Issue not found' });

    const FINAL = ['resolved', 'closed'];
    const hasProof = (issue.resolution?.proofImageUrls || []).length > 0;

    // Resolving/closing requires a photo of the completed work (see resolveIssueWithProof)
    if (FINAL.includes(status) && !hasProof) {
      return res.status(400).json({
        success: false,
        code: 'PROOF_REQUIRED',
        message: 'Upload a photo of the completed work to resolve or close this complaint.',
      });
    }
    // Re-opening a finished complaint clears its old proof
    if (!FINAL.includes(status) && FINAL.includes(issue.status)) {
      issue.resolution = { proofImageUrls: [] };
    }

    const prevStatus = issue.status;
    issue.status     = status;
    issue.timeline.push({
      title:       `Status: ${status.replace(/_/g, ' ').toUpperCase()}`,
      description: notes || `Status changed from ${prevStatus} to ${status} by ${req.user?.name || 'Admin'}`,
      timestamp:   new Date(),
      actor:       req.user?.name || 'Admin',
    });
    await issue.save();

    if (notifyCitizen && issue.reportedBy) {
      console.log(`📧 [NOTIFICATION] Citizen notified — issue ${issue.ticketId} status: ${status}`);
    }

    const populated = await Issue.findById(issue._id)
      .populate('reportedBy', 'name email')
      .populate('assignedTo', 'name email');
    res.json({ success: true, message: 'Status updated successfully', issue: populated });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// ── POST /api/issues/:id/resolve  (admin) ─────────────
// Resolve/close a complaint WITH photo proof of the completed work.
// multipart: proof[] (1-3 images), status, notes, lat, lng, accuracy, overrideReason
const path = require('path');
const fs   = require('fs');
const { verifyResolution } = require('../services/resolutionVerificationService');

const toRad = (d) => (d * Math.PI) / 180;
const distanceM = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1); const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};
const uploadsRoot = path.join(__dirname, '../uploads');
const localPath = (url) => {                       // '/uploads/x.jpg' → absolute path (inside uploads only)
  if (!url || !url.startsWith('/uploads/')) return null;
  const abs = path.join(__dirname, '..', url);
  return abs.startsWith(uploadsRoot) ? abs : null;
};
const removeFiles = (files = []) => files.forEach((f) => fs.unlink(f.path, () => {}));

const resolveIssueWithProof = async (req, res) => {
  const files = req.files || [];
  try {
    const { notes = '', overrideReason = '' } = req.body;
    const status = req.body.status === 'closed' ? 'closed' : 'resolved';

    if (!files.length) {
      return res.status(400).json({ success: false, code: 'PHOTO_REQUIRED', message: 'Please upload at least one photo of the completed work.' });
    }
    const issue = await Issue.findById(req.params.id);
    if (!issue) { removeFiles(files); return res.status(404).json({ success: false, message: 'Issue not found' }); }

    // ── Location check (warning only — laptop/Wi-Fi GPS can be inaccurate) ──
    const lat = parseFloat(req.body.lat); const lng = parseFloat(req.body.lng);
    const accuracy = parseFloat(req.body.accuracy);
    let locationCheck = 'UNKNOWN'; let distance;
    if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(issue.location?.lat) && Number.isFinite(issue.location?.lng)) {
      distance = Math.round(distanceM(lat, lng, issue.location.lat, issue.location.lng));
      const tolerance = Math.max(150, Number.isFinite(accuracy) ? accuracy : 0);
      locationCheck = distance <= tolerance ? 'MATCH' : 'FAR';
    }

    // ── AI verification (before vs after) ──
    const verification = await verifyResolution({
      beforePaths: (issue.imageUrls || []).map(localPath).filter(Boolean),
      afterPaths:  files.map((f) => f.path),
      issue,
    });

    const failed = verification.verdict === 'NOT_RESOLVED' || verification.verdict === 'UNCLEAR'
      || (verification.verdict === 'RESOLVED' && verification.confidence < 0.6);
    const override = overrideReason.trim();

    if (failed && override.length < 10) {
      removeFiles(files);
      return res.status(422).json({
        success: false,
        code: 'VERIFICATION_FAILED',
        message: verification.verdict === 'UNCLEAR'
          ? 'The photo is not clear enough to confirm the work. Please upload a clearer photo of the exact site.'
          : 'The photo does not show the problem as fixed.',
        verification, locationCheck, distanceFromComplaintM: distance,
      });
    }

    // ── Accept: store proof, update status, log timeline ──
    const overridden = failed && override.length >= 10;
    issue.resolution = {
      proofImageUrls: files.map((f) => `/uploads/proof/${f.filename}`),
      notes: notes.trim(),
      submittedBy: req.user?._id,
      submittedAt: new Date(),
      gps: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, accuracyM: Number.isFinite(accuracy) ? accuracy : undefined } : undefined,
      distanceFromComplaintM: distance,
      locationCheck,
      verification: { ...verification, overridden, overrideReason: overridden ? override : '' },
    };

    const prevStatus = issue.status;
    issue.status = status;
    const label = overridden ? 'closed with manager override'
      : verification.verdict === 'RESOLVED' ? 'photo proof verified'
      : 'photo proof submitted, awaiting manual review';
    issue.timeline.push({
      title: `Status: ${status.toUpperCase()} — ${label}`,
      description: [
        notes.trim() || `Status changed from ${prevStatus} to ${status} by ${req.user?.name || 'Admin'}`,
        verification.reason && `Check: ${verification.reason}`,
        overridden && `Override reason: ${override}`,
        locationCheck === 'FAR' && `⚠ Photo taken ${distance} m from the complaint location.`,
      ].filter(Boolean).join(' '),
      timestamp: new Date(),
      actor: req.user?.name || 'Admin',
    });
    await issue.save();

    const populated = await Issue.findById(issue._id)
      .populate('reportedBy', 'name email')
      .populate('assignedTo', 'name email');
    res.json({ success: true, message: 'Complaint updated with photo proof', issue: populated, verification, locationCheck });
  } catch (error) {
    removeFiles(files);
    console.error('Resolve with proof error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/issues/:id/reassign ────────────────────
const reassignIssue = async (req, res) => {
  try {
    const { department, reason } = req.body;
    if (!department) return res.status(400).json({ success: false, message: 'Department is required' });

    const issue = await Issue.findById(req.params.id);
    if (!issue)  return res.status(404).json({ success: false, message: 'Issue not found' });

    const prev    = issue.department;
    issue.department = department;
    issue.timeline.push({
      title:       `Reassigned to ${department}`,
      description: reason || `Moved from "${prev}" to "${department}"`,
      timestamp:   new Date(),
      actor:       req.user?.name || 'Admin',
    });
    await issue.save();

    const populated = await Issue.findById(issue._id)
      .populate('reportedBy', 'name email')
      .populate('assignedTo', 'name email');
    res.json({ success: true, message: 'Issue reassigned', issue: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/issues/track/:ticketId (public) ──────────
const trackComplaint = async (req, res) => {
  try {
    const issue = await Issue.findOne({ ticketId: req.params.ticketId })
      .select('ticketId title status priority category location timeline createdAt updatedAt department aiConfidence aiRecommendedAction emergencyFlag aiGeneratedSummary resolution.submittedAt resolution.verification.verdict resolution.verification.method')
      .populate('reportedBy', 'name');

    if (!issue) return res.status(404).json({ success: false, message: 'No complaint found with ticket ID: ' + req.params.ticketId });
    res.json({ success: true, issue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── DELETE /api/issues/:id (admin only) ───────────────
const deleteIssue = async (req, res) => {
  try {
    const issue = await Issue.findByIdAndDelete(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    res.json({ success: true, message: 'Issue deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  reportIssue,
  getIssues,
  getIssueById,
  updateIssueStatus,
  resolveIssueWithProof,
  reassignIssue,
  trackComplaint,
  deleteIssue,
};
