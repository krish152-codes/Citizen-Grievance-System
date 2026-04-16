const { classifyIssue, detectGarbage, sentimentAnalysis } = require('../services/aiService');

// @desc    Classify an issue from text
// @route   POST /api/ai/classify
// @access  Public
const classify = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }
    const result = await classifyIssue(text);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Detect garbage in image
// @route   POST /api/ai/detect
// @access  Public
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

// @desc    Perform sentiment analysis
// @route   POST /api/ai/sentiment
// @access  Public
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

module.exports = { classify, detect, sentiment };
