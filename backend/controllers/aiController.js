const { classifyIssue, generateApplicationLetter, detectGarbage, sentimentAnalysis } = require('../services/aiService');
const Issue = require('../models/Issue');

// POST /api/ai/classify
const classify = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Text is required (min 3 chars)' });
    }
    const result = await classifyIssue(text);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/ai/preview-classify  (for live form preview, no saving)
const previewClassify = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.length < 10) return res.json({ success: true, result: null });
    const result = await classifyIssue(text);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/ai/detect
const detect = async (req, res) => {
  try {
    const imagePath = req.file ? req.file.path : req.body.imagePath;
    if (!imagePath) {
      return res.status(400).json({ success: false, message: 'Image is required' });
    }
    const result = await detectGarbage(imagePath);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/ai/sentiment
const sentiment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }
    const result = await sentimentAnalysis(text);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/ai/generate-letter  — generate formal complaint letter for an issue
const generateLetter = async (req, res) => {
  try {
    const { issueId } = req.body;
    if (!issueId) {
      return res.status(400).json({ success: false, message: 'issueId is required' });
    }
    const issue = await Issue.findById(issueId).populate('reportedBy', 'name email phone');
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }
    const result = await generateApplicationLetter(issue);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { classify, previewClassify, detect, sentiment, generateLetter };