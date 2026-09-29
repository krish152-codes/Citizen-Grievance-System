const Issue = require('../models/Issue');

// ── GET /api/ai-review ──────────────────────────────────
// Complaints needing human review: low AI confidence, or explicitly flagged.
const getReviewQueue = async (req, res) => {
  try {
    const { source, page = 1, limit = 20 } = req.query;
    const query = { needsAiReview: true };
    if (source) query.source = source;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [issues, total] = await Promise.all([
      Issue.find(query).sort({ createdAt: -1 }).skip(skip).limit(Math.min(parseInt(limit), 100))
        .populate('reportedBy', 'name email').populate('conversation'),
      Issue.countDocuments(query),
    ]);

    res.json({ success: true, issues, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    console.error('AI review queue error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/ai-review/:id ────────────────────────────
// Authority corrects one or more AI-set fields; each correction is logged
// as structured feedback (spec §67) — this never auto-retrains anything.
const reviewIssue = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    const { category, priority, department, clearReviewFlag } = req.body;
    const corrections = [];

    if (category && category !== issue.category) {
      corrections.push({ field: 'category', previousValue: issue.category, correctedValue: category, correctedBy: req.user._id });
      issue.category = category;
    }
    if (priority && priority !== issue.priority) {
      corrections.push({ field: 'priority', previousValue: issue.priority, correctedValue: priority, correctedBy: req.user._id });
      issue.priority = priority;
    }
    if (department && department !== issue.department) {
      corrections.push({ field: 'department', previousValue: issue.department, correctedValue: department, correctedBy: req.user._id });
      issue.department = department;
    }

    if (corrections.length) {
      issue.aiCorrections.push(...corrections);
      issue.timeline.push({
        title: 'AI Classification Corrected',
        description: `${req.user.name} corrected: ${corrections.map((c) => `${c.field} (${c.previousValue || '—'} → ${c.correctedValue})`).join(', ')}.`,
        timestamp: new Date(),
        actor: req.user.name,
      });
    }

    if (clearReviewFlag !== false) issue.needsAiReview = false;
    await issue.save();

    res.json({ success: true, message: 'Review recorded', issue });
  } catch (error) {
    console.error('AI review update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getReviewQueue, reviewIssue };
