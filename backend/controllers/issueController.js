const Issue = require('../models/Issue');
const User = require('../models/User');
const { classifyIssue } = require('../services/aiService');

// @desc    Report a new issue
// @route   POST /api/issues/report
// @access  Private/Public
const reportIssue = async (req, res) => {
  try {
    const { title, description, category, priority, location, isUrgent } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    // Process uploaded images
    const imageUrls = req.files
      ? req.files.map((file) => `/uploads/${file.filename}`)
      : [];

    // Parse location if string
    let parsedLocation = {};
    try {
      parsedLocation = typeof location === 'string' ? JSON.parse(location) : location || {};
    } catch (_) {}

    // AI classification
    const aiResult = await classifyIssue(description);

    const issueData = {
      title,
      description,
      category: category || aiResult.category || 'other',
      priority: priority || aiResult.priority || 'medium',
      imageUrls,
      location: parsedLocation,
      isUrgent: isUrgent === 'true' || isUrgent === true,
      aiConfidence: aiResult.confidence || 0,
      aiCategory: aiResult.category || '',
      aiRecommendedAction: aiResult.recommendedAction || '',
      sentiment: aiResult.sentiment || { score: 0, label: 'neutral' },
      reportedBy: req.user?._id,
      department: aiResult.department || 'Public Works',
      timeline: [
        {
          title: 'Issue Reported',
          description: `Reported via Web App${req.user ? ` by ${req.user.name}` : ' anonymously'}`,
          timestamp: new Date(),
          actor: req.user?.name || 'Anonymous',
        },
        {
          title: 'AI Categorized',
          description: `Classified as "${aiResult.category || 'General Issue'}" with ${Math.round((aiResult.confidence || 0) * 100)}% confidence`,
          timestamp: new Date(),
          actor: 'AI System',
        },
      ],
    };

    const issue = await Issue.create(issueData);

    // Update user issue count
    if (req.user?._id) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { issuesReported: 1 } });
    }

    res.status(201).json({
      success: true,
      message: 'Issue reported successfully',
      issue,
    });
  } catch (error) {
    console.error('Report issue error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to report issue' });
  }
};

// @desc    Get all issues (admin) or user's issues
// @route   GET /api/issues
// @access  Private
const getIssues = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category, priority, search, district } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (district) query['location.district'] = district;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { ticketId: { $regex: search, $options: 'i' } },
      ];
    }

    // Citizens only see their own issues
    if (req.user?.role === 'citizen') {
      query.reportedBy = req.user._id;
    }

    const [issues, total] = await Promise.all([
      Issue.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('reportedBy', 'name email')
        .populate('assignedTo', 'name email'),
      Issue.countDocuments(query),
    ]);

    res.json({
      success: true,
      issues,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single issue by ID
// @route   GET /api/issues/:id
// @access  Private
const getIssueById = async (req, res) => {
  try {
    const issue = await Issue.findOne({
      $or: [{ _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null }, { ticketId: req.params.id }],
    })
      .populate('reportedBy', 'name email phone')
      .populate('assignedTo', 'name email');

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    // Increment view count
    await Issue.findByIdAndUpdate(issue._id, { $inc: { views: 1 } });

    res.json({ success: true, issue });
  } catch (error) {
    console.error('Get issue error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update issue status
// @route   PATCH /api/issues/:id/status
// @access  Private (Admin)
const updateIssueStatus = async (req, res) => {
  try {
    const { status, notes, notifyCitizen } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    const prevStatus = issue.status;
    issue.status = status;

    // Add timeline event
    issue.timeline.push({
      title: `Status Updated to ${status.replace('_', ' ').toUpperCase()}`,
      description: notes || `Status changed from ${prevStatus} to ${status}`,
      timestamp: new Date(),
      actor: req.user?.name || 'Admin',
    });

    await issue.save();

    // Notification simulation
    if (notifyCitizen && issue.reportedBy) {
      console.log(`📧 Notification sent to citizen about issue ${issue.ticketId}`);
    }

    res.json({
      success: true,
      message: 'Issue status updated',
      issue,
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reassign issue to department
// @route   PATCH /api/issues/:id/reassign
// @access  Private (Admin)
const reassignIssue = async (req, res) => {
  try {
    const { department, reason } = req.body;

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    const prevDept = issue.department;
    issue.department = department;
    issue.timeline.push({
      title: 'Reassigned to ' + department,
      description: reason || `Moved from ${prevDept} to ${department}`,
      timestamp: new Date(),
      actor: req.user?.name || 'Admin',
    });

    await issue.save();

    res.json({ success: true, message: 'Issue reassigned', issue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Track complaint by ticket ID (public)
// @route   GET /api/issues/track/:ticketId
// @access  Public
const trackComplaint = async (req, res) => {
  try {
    const issue = await Issue.findOne({ ticketId: req.params.ticketId })
      .select('ticketId title status priority category location timeline createdAt updatedAt department')
      .populate('reportedBy', 'name');

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Complaint not found with this ticket ID' });
    }

    res.json({ success: true, issue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { reportIssue, getIssues, getIssueById, updateIssueStatus, reassignIssue, trackComplaint };
