/**
 * WhatsApp Cloud API webhook.
 *
 * NOTE on background processing (spec §25, §80): this processes messages
 * synchronously within the webhook request rather than via a job queue.
 * The demo classifier is fast enough that this is fine for the traffic
 * this environment will ever see; a production deployment expecting real
 * volume should move `processIncomingMessage` onto a queue (e.g. BullMQ)
 * without changing its signature — it's already a standalone function for
 * exactly that reason.
 */
const path = require('path');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { handleMessage } = require('../services/complaintOrchestrator');
const whatsapp = require('../services/whatsappService');

const MAX_MEDIA_BYTES = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;
const MEDIA_DIR = path.join(__dirname, '../uploads/whatsapp');

// ── GET /api/webhooks/whatsapp — verification challenge ──
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token && process.env.WHATSAPP_VERIFY_TOKEN && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

async function findOrCreateConversation(waId, displayName) {
  const hash = whatsapp.hashPhoneNumber(waId);
  let conversation = await Conversation.findOne({ channel: 'WHATSAPP', whatsappNumberHash: hash });
  if (!conversation) {
    conversation = await Conversation.create({ channel: 'WHATSAPP', whatsappNumberHash: hash, whatsappDisplayName: displayName || '' });
  }
  return conversation;
}

async function processIncomingMessage(waMessage, waId, displayName) {
  // Idempotency (spec §79) — WhatsApp can retry webhook delivery.
  const already = await Message.findOne({ whatsappMessageId: waMessage.id });
  if (already) return; // silently skip — already processed

  const conversation = await findOrCreateConversation(waId, displayName);

  let input = null;
  let inboundExtra = { whatsappMessageId: waMessage.id };

  if (waMessage.type === 'text') {
    input = { messageType: 'TEXT', text: waMessage.text?.body || '' };
  } else if (waMessage.type === 'location') {
    const loc = waMessage.location || {};
    input = { messageType: 'LOCATION', location: { lat: loc.latitude, lng: loc.longitude, name: loc.name, address: loc.address } };
    inboundExtra.location = input.location;
  } else if (waMessage.type === 'image' || waMessage.type === 'audio') {
    const mediaField = waMessage[waMessage.type];
    try {
      const downloaded = await whatsapp.downloadMedia(mediaField.id, MEDIA_DIR, MAX_MEDIA_BYTES);
      input = {
        messageType: waMessage.type.toUpperCase(),
        mediaFile: { url: `/uploads/whatsapp/${downloaded.filename}`, mimetype: downloaded.mimeType, size: downloaded.size, path: downloaded.path },
      };
    } catch (err) {
      console.error('WhatsApp media download failed:', err.message);
      input = { messageType: 'TEXT', text: '' }; // falls through to the orchestrator's fallback response
    }
  } else {
    // Unsupported type (document, sticker, etc.) — spec §26
    await Message.create({ conversation: conversation._id, direction: 'inbound', messageType: 'SYSTEM', text: `Unsupported message type: ${waMessage.type}`, ...inboundExtra });
    if (whatsapp.isConfigured()) {
      try { await whatsapp.sendTextMessage(waId, 'I can currently understand text, voice messages, images, and shared locations.'); } catch (e) { console.error('WhatsApp send failed:', e.message); }
    }
    return;
  }

  await Message.create({ conversation: conversation._id, direction: 'inbound', messageType: input.messageType, text: input.text || '', location: input.location, ...inboundExtra });

  const result = await handleMessage(conversation, input);
  await conversation.save();

  await Message.create({ conversation: conversation._id, direction: 'outbound', messageType: 'TEXT', text: result.replyText });

  if (whatsapp.isConfigured()) {
    try {
      await whatsapp.sendTextMessage(waId, result.replyText);
    } catch (err) {
      console.error('WhatsApp send failed:', err.message);
    }
  } else {
    console.log(`[WhatsApp not configured — reply not sent] → ${waId}: ${result.replyText}`);
  }
}

// ── POST /api/webhooks/whatsapp — inbound events ──
const receiveWebhook = async (req, res) => {
  // req.body is a raw Buffer here (see routes/whatsappWebhook.js) so we can
  // verify the signature against the exact bytes Meta signed (spec §78).
  const signature = req.headers['x-hub-signature-256'];
  if (!whatsapp.verifySignature(req.body, signature)) {
    return res.sendStatus(401);
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.sendStatus(400);
  }

  // Acknowledge immediately with 200 so Meta doesn't retry, then process.
  // (See file header re: moving this to a real queue for production scale.)
  res.sendStatus(200);

  try {
    const entries = payload.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const displayName = value.contacts?.[0]?.profile?.name;
        for (const waMessage of value.messages || []) {
          await processIncomingMessage(waMessage, waMessage.from, displayName);
        }
      }
    }
  } catch (err) {
    console.error('WhatsApp webhook processing error:', err);
  }
};

module.exports = { verifyWebhook, receiveWebhook };
