/**
 * WhatsApp Business (Meta) Cloud API client.
 *
 * This talks to the OFFICIAL Meta Graph API — never WhatsApp Web scraping
 * or personal-account automation (spec §24). It requires real credentials
 * (see .env.example: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
 * WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN) from a Meta developer account
 * — nothing in this codebase can substitute for those. Every function below
 * fails loudly and clearly if they're missing, rather than pretending to
 * have sent a message.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v25.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function isConfigured() {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Verify an inbound webhook payload's signature (spec §78).
 * Meta signs the raw request body with WHATSAPP_APP_SECRET as
 * `X-Hub-Signature-256: sha256=<hmac>`.
 */
function verifySignature(rawBody, signatureHeader) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return false; // never trust an unverifiable payload
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false; // length mismatch etc — treat as invalid, not a crash
  }
}

/** One-way hash of a phone number for privacy-preserving conversation lookup (spec §43). */
function hashPhoneNumber(phoneNumber) {
  const salt = process.env.WHATSAPP_HASH_SALT || 'sheharsetu-default-salt-change-me';
  return crypto.createHash('sha256').update(`${salt}:${phoneNumber}`).digest('hex');
}

async function sendTextMessage(toPhoneNumber, text) {
  if (!isConfigured()) throw new Error('WhatsApp is not configured (missing WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)');
  const res = await fetch(`${GRAPH_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: toPhoneNumber, type: 'text', text: { body: text } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`WhatsApp send failed: ${data?.error?.message || res.status}`);
  return data;
}

/** Resolve a WhatsApp media ID to a short-lived download URL, then download it to disk. */
async function downloadMedia(mediaId, destDir, maxBytes) {
  if (!isConfigured()) throw new Error('WhatsApp is not configured');

  const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
  });
  const meta = await metaRes.json();
  if (!metaRes.ok || !meta.url) throw new Error(`Could not resolve WhatsApp media ${mediaId}`);

  if (maxBytes && meta.file_size && meta.file_size > maxBytes) {
    throw new Error(`Media exceeds the allowed size (${meta.file_size} > ${maxBytes} bytes)`);
  }

  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } });
  if (!fileRes.ok) throw new Error(`Failed to download WhatsApp media ${mediaId}`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());

  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const ext = (meta.mime_type || '').split('/')[1]?.split(';')[0] || 'bin';
  const filename = `wa-${mediaId}-${Date.now()}.${ext}`;
  const destPath = path.join(destDir, filename);
  fs.writeFileSync(destPath, buffer);

  return { path: destPath, filename, mimeType: meta.mime_type, size: buffer.length };
}

module.exports = { isConfigured, verifySignature, hashPhoneNumber, sendTextMessage, downloadMedia, GRAPH_BASE };
