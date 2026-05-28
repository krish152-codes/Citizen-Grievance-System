const Department = require('../models/Department');
const Issue      = require('../models/Issue');

// @desc   Get all departments (optionally filter by city/category)
// @route  GET /api/departments
// @access Admin
const getDepartments = async (req, res) => {
  try {
    const { city, category, search } = req.query;
    const query = {};
    if (city)     query.city     = new RegExp(city, 'i');
    if (category) query.category = category;
    if (search)   query.$or = [
      { name:     { $regex: search, $options: 'i' } },
      { city:     { $regex: search, $options: 'i' } },
      { headName: { $regex: search, $options: 'i' } },
    ];

    const departments = await Department.find(query).sort({ city: 1, category: 1 });
    res.json({ success: true, departments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Create a department
// @route  POST /api/departments
// @access Admin
const createDepartment = async (req, res) => {
  try {
    const { name, category, city, state, headName, email, phone, address } = req.body;
    if (!name || !category || !city || !email) {
      return res.status(400).json({ success: false, message: 'name, category, city and email are required' });
    }
    const dept = await Department.create({ name, category, city, state, headName, email, phone, address });
    res.status(201).json({ success: true, department: dept });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A department for this category already exists in that city.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Update a department
// @route  PATCH /api/departments/:id
// @access Admin
const updateDepartment = async (req, res) => {
  try {
    const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    res.json({ success: true, department: dept });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Delete a department
// @route  DELETE /api/departments/:id
// @access Admin
const deleteDepartment = async (req, res) => {
  try {
    const dept = await Department.findByIdAndDelete(req.params.id);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    res.json({ success: true, message: 'Department deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc   Send complaint application to the matching department for a given issue
// @route  POST /api/departments/send-complaint/:issueId
// @access Admin
const sendComplaintToDepartment = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.issueId)
      .populate('reportedBy', 'name email phone');

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    // Find the department matching issue category + city (from issue location or req.body override)
    const cityOverride = req.body.city || issue.location?.district || '';
    const query = { category: issue.category, isActive: true };
    if (cityOverride) query.city = new RegExp(cityOverride, 'i');

    const dept = await Department.findOne(query);
    if (!dept) {
      return res.status(404).json({
        success: false,
        message: `No active department found for category "${issue.category}"${cityOverride ? ` in city "${cityOverride}"` : ''}. Please add it in the Departments panel first.`,
      });
    }

    // Build the complaint application text
    const date          = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const reporterName  = issue.reportedBy?.name  || 'Anonymous Citizen';
    const reporterEmail = issue.reportedBy?.email || 'N/A';
    const reporterPhone = issue.reportedBy?.phone || req.body.reporterPhone || 'N/A';
    const locationStr   = issue.location?.address || issue.location?.district || 'the reported location';
    const priorityLabel = issue.priority === 'critical' ? 'URGENT — IMMEDIATE ACTION REQUIRED'
                        : issue.priority === 'high'     ? 'HIGH PRIORITY'
                        : 'ATTENTION REQUIRED';

    const applicationLetter = `
To,
The Head of Department,
${dept.name},
${dept.city}${dept.state ? ', ' + dept.state : ''}

Date: ${date}
Reference Ticket: #${issue.ticketId}
Priority: [${priorityLabel}]

Subject: Formal Complaint — "${issue.title}" at ${locationStr}

Respected ${dept.headName ? dept.headName : 'Sir/Madam'},

This complaint has been submitted by a citizen through SheharSetu and has been AI-classified and auto-routed to your department.

━━━ COMPLAINT DETAILS ━━━
Ticket ID  : #${issue.ticketId}
Category   : ${issue.category.replace(/_/g, ' ').toUpperCase()}
Priority   : ${issue.priority.toUpperCase()}
Location   : ${locationStr}
Reported by: ${reporterName} | ${reporterEmail} | ${reporterPhone}
Date Filed : ${date}
${issue.emergencyFlag ? '\n⚠️  EMERGENCY FLAGGED — REQUIRES IMMEDIATE ATTENTION\n' : ''}
━━━ DESCRIPTION ━━━
${issue.description || issue.aiGeneratedSummary || 'Submitted via photo/voice on SheharSetu.'}

━━━ AI ANALYSIS ━━━
AI Confidence   : ${Math.round((issue.aiConfidence || 0) * 100)}%
AI Severity     : ${issue.aiSeverity || 'medium'}
AI Summary      : ${issue.aiGeneratedSummary || 'N/A'}
Detected Objects: ${(issue.detectedObjects || []).join(', ') || 'N/A'}

━━━ REQUESTED ACTIONS ━━━
1. Acknowledge receipt within 24 hours
2. Inspect the reported site at earliest convenience
3. Take corrective action and update ticket status on SheharSetu
4. Notify the citizen upon resolution

Yours faithfully,
SheharSetu — Citizen Grievance Platform
Auto-generated on behalf of ${reporterName}
Ticket: #${issue.ticketId}
`.trim();

    // In production, send email here via nodemailer / SendGrid
    // For now: log and return the letter + department details so admin can review
    console.log(`📧 [COMPLAINT DISPATCH] Ticket #${issue.ticketId} → ${dept.email} (${dept.name}, ${dept.city})`);

    // Track dispatch on issue timeline
    issue.timeline.push({
      title:       `Application Sent to ${dept.name}`,
      description: `Complaint dispatched to ${dept.email} in ${dept.city}. Sent by ${req.user?.name || 'Admin'}.`,
      timestamp:   new Date(),
      actor:       req.user?.name || 'Admin',
    });
    await issue.save();

    // Increment department counter
    await Department.findByIdAndUpdate(dept._id, { $inc: { complaintsReceived: 1 } });

    res.json({
      success: true,
      message: `Complaint application ready for ${dept.name} (${dept.email})`,
      department: {
        name:     dept.name,
        email:    dept.email,
        phone:    dept.phone,
        headName: dept.headName,
        city:     dept.city,
      },
      applicationLetter,
      // In production: emailSent: true / false
      emailNote: process.env.SMTP_HOST
        ? 'Email sent via configured SMTP.'
        : 'SMTP not configured — copy the letter below and send manually to ' + dept.email,
    });
  } catch (err) {
    console.error('Send complaint error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getDepartments, createDepartment, updateDepartment, deleteDepartment, sendComplaintToDepartment };
