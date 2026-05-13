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
      .select('ticketId title status priority category location timeline createdAt updatedAt department aiConfidence aiRecommendedAction emergencyFlag aiGeneratedSummary')
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
  reassignIssue,
  trackComplaint,
  deleteIssue,
};
