const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { handleMessage } = require('../services/complaintOrchestrator');

async function getOrCreateConversation(conversationId, req) {
  if (conversationId && mongoose.isValidObjectId(conversationId)) {
    const existing = await Conversation.findById(conversationId);
    if (existing) return existing;
  }
  return Conversation.create({ channel: 'WEB', citizen: req.user?._id || null });
}

async function respond(res, conversation, input, extraMessageFields = {}) {
  conversation.lastMessageAt = new Date();

  await Message.create({
    conversation: conversation._id,
    direction: 'inbound',
    messageType: input.messageType,
    text: input.text || '',
    location: input.location || undefined,
    ...extraMessageFields,
  });

  const result = await handleMessage(conversation, input);
  await conversation.save();

  await Message.create({
    conversation: conversation._id,
    direction: 'outbound',
    messageType: 'TEXT',
    text: result.replyText,
  });

  res.json({
    success: true,
    conversationId: conversation._id,
    reply: result.replyText,
    state: conversation.state,
    language: conversation.language,
    issue: result.issue ? { ticketId: result.issue.ticketId, id: result.issue._id, status: result.issue.status } : null,
  });
}

// ── POST /api/chatbot/message ──────────────────────────
const sendMessage = async (req, res) => {
  try {
    const { conversationId, text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'text is required' });

    const conversation = await getOrCreateConversation(conversationId, req);
    await respond(res, conversation, { messageType: 'TEXT', text });
  } catch (error) {
    console.error('Chatbot message error:', error);
    res.status(500).json({ success: false, message: 'The assistant is temporarily unavailable. Please try again.' });
  }
};

// ── POST /api/chatbot/location ─────────────────────────
const sendLocation = async (req, res) => {
  try {
    const { conversationId, lat, lng, address, name } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ success: false, message: 'lat and lng are required' });

    const conversation = await getOrCreateConversation(conversationId, req);
    const location = { lat: parseFloat(lat), lng: parseFloat(lng), address: address || '', name: name || '' };
    await respond(res, conversation, { messageType: 'LOCATION', location }, { location });
  } catch (error) {
    console.error('Chatbot location error:', error);
    res.status(500).json({ success: false, message: 'The assistant is temporarily unavailable. Please try again.' });
  }
};

// ── POST /api/chatbot/image ─────────────────────────────
// multipart/form-data: image (file) + conversationId
const sendImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'An image file is required.' });
    const { conversationId } = req.body;
    const conversation = await getOrCreateConversation(conversationId, req);

    const mediaFile = { url: `/uploads/${req.file.filename}`, mimetype: req.file.mimetype, size: req.file.size, path: req.file.path };
    await respond(res, conversation, { messageType: 'IMAGE', mediaFile });
  } catch (error) {
    console.error('Chatbot image error:', error);
    res.status(500).json({ success: false, message: 'The assistant is temporarily unavailable. Please try again.' });
  }
};

// ── POST /api/chatbot/voice ─────────────────────────────
// multipart/form-data: voice (file) + conversationId
const sendVoice = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'An audio recording is required.' });
    const { conversationId } = req.body;
    const conversation = await getOrCreateConversation(conversationId, req);

    const mediaFile = { url: `/uploads/voice/${req.file.filename}`, mimetype: req.file.mimetype, size: req.file.size, path: req.file.path };
    await respond(res, conversation, { messageType: 'AUDIO', mediaFile });
  } catch (error) {
    console.error('Chatbot voice error:', error);
    res.status(500).json({ success: false, message: 'The assistant is temporarily unavailable. Please try again.' });
  }
};

// ── GET /api/chatbot/conversation/:id ──────────────────
const getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });
    const messages = await Message.find({ conversation: conversation._id }).sort({ createdAt: 1 });
    res.json({ success: true, conversation, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { sendMessage, sendLocation, sendImage, sendVoice, getConversation };
