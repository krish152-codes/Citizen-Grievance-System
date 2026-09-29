/**
 * Complaint Orchestrator
 * ──────────────────────
 * The one place that turns a sequence of inbound messages (from either the
 * website widget or WhatsApp) into a ComplaintDraft and, on confirmation, a
 * real Issue in the existing grievance system. Both channels call
 * `handleMessage()` — nothing about the conversation logic is duplicated
 * per channel (spec §40: "do not build two separate complaint systems").
 *
 * This is deliberately a rule-based state machine, not an LLM agent: every
 * transition is explicit and auditable, and nothing here can silently
 * invent a department, complaint ID, or status (spec §16, §32, §61).
 */
const Issue = require('../models/Issue');
const ComplaintDraft = require('../models/ComplaintDraft');
const Media = require('../models/Media');
const Drain = require('../models/Drain');
const aiService = require('./aiService');
const { detectLanguage } = require('./languageService');
const { t } = require('./responseTemplates');
const { resolveWard, resolveDepartment, findNearbyDrain } = require('./locationRoutingService');

const AI_REVIEW_CONFIDENCE_THRESHOLD = parseFloat(process.env.AI_REVIEW_CONFIDENCE_THRESHOLD) || 0.6;

// ── Lightweight bilingual intent detection (rule-based — see file header) ──
const GREETING_WORDS = ['hi', 'hello', 'hey', 'namaste', 'start', 'शुरू', 'नमस्ते'];
const HELP_WORDS = ['help', 'what can you do', 'madad', 'मदद', 'सहायता'];
const CANCEL_WORDS = ['cancel', 'stop', 'radd karo', 'रद्द', 'cancel karo'];
const AFFIRMATIVE_WORDS = ['yes', 'y', 'submit', 'confirm', 'ok', 'okay', 'haan', 'ha', 'हाँ', 'हां'];
const NEGATIVE_WORDS = ['no', 'n', 'skip', 'nahi', 'nahin', 'नहीं'];
const EDIT_WORDS = ['edit', 'change', 'badlo', 'badal', 'बदलो'];
const STATUS_WORDS = ['status', 'track', 'tracking', 'स्थिति', 'ट्रैक'];

const norm = (text) => (text || '').toLowerCase().trim();
const matchesAny = (text, list) => { const n = norm(text); return list.some((w) => n === w || n.includes(w)); };

const isGreeting = (text) => matchesAny(text, GREETING_WORDS);
const isHelpRequest = (text) => matchesAny(text, HELP_WORDS);
const isCancelRequest = (text) => matchesAny(text, CANCEL_WORDS);
const isAffirmative = (text) => matchesAny(text, AFFIRMATIVE_WORDS);
const isNegativeOrSkip = (text) => matchesAny(text, NEGATIVE_WORDS);
const isEditRequest = (text) => matchesAny(text, EDIT_WORDS);
const isStatusQuery = (text) => /TKT-\d{3,}/i.test(text || '') || matchesAny(text, STATUS_WORDS);
const extractTicketId = (text) => (text || '').match(/TKT-\d{3,}/i)?.[0]?.toUpperCase() || null;

const reply = (replyText, conversation, draft, issue = null) => ({ replyText, conversation, draft, issue });

// Flat-earth distance approximation, city-scale only (same approach as locationRoutingService).
const approxDist = (lat1, lng1, lat2, lng2) => Math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2);

async function findRecentSimilarIssue(category, lat, lng, sinceMinutes = 60) {
  if (!category || lat == null || lng == null) return null;
  const since = new Date(Date.now() - sinceMinutes * 60000);
  const candidates = await Issue.find({ category, createdAt: { $gte: since }, 'location.lat': { $exists: true } })
    .select('ticketId location createdAt').limit(20).lean();
  for (const c of candidates) {
    if (c.location?.lat == null) continue;
    if (approxDist(lat, lng, c.location.lat, c.location.lng) < 0.003) return c; // ~300m
  }
  return null;
}

// ── Status query (works regardless of conversation state) ──
async function handleStatusQuery(conversation, text, lang) {
  const ticketId = extractTicketId(text);
  let issue = null;
  if (ticketId) {
    issue = await Issue.findOne({ ticketId });
  } else if (conversation.activeIssue) {
    issue = await Issue.findById(conversation.activeIssue);
  }
  if (!issue) return reply(t('statusNotFound', lang), conversation, null);
  const lastEvent = issue.timeline?.[issue.timeline.length - 1];
  return reply(
    t('statusFound', lang, { ticketId: issue.ticketId, status: issue.status, department: issue.department, lastUpdate: lastEvent?.description }),
    conversation, null
  );
}

// ── Final submission — creates the real Issue, mirroring the exact field
// shape issueController.reportIssue uses for the web flow, minus the
// image-required constraint (WhatsApp/voice-only complaints are valid) ──
async function submitComplaint(conversation, draft, lang) {
  const [imageMediaDocs, audioMediaDocs] = await Promise.all([
    Media.find({ _id: { $in: draft.imageMedia } }),
    Media.find({ _id: { $in: draft.audioMedia } }),
  ]);

  const aiResult = draft.aiClassification || {};
  const deptInfo = await resolveDepartment(draft.category, aiResult.department);

  const autoTitle = (draft.description || '').trim().slice(0, 80)
    || aiResult.aiGeneratedSummary?.slice(0, 80)
    || `${(draft.category || 'civic').replace(/_/g, ' ')} issue reported`;

  const issue = await Issue.create({
    title: autoTitle,
    description: draft.description || aiResult.aiGeneratedSummary || 'Reported via SheharSetu AI Assistant.',
    category: draft.category || aiResult.category || 'other',
    priority: aiResult.priority || aiResult.severity || 'medium',
    isUrgent: !!aiResult.emergencyFlag,

    imageUrls: imageMediaDocs.map((m) => m.storageRef),
    voiceMessageUrl: audioMediaDocs[0]?.storageRef || '',

    transcript: draft.description,
    aiGeneratedSummary: aiResult.aiGeneratedSummary || '',
    aiDetectedCategory: aiResult.category || '',
    aiCriticality: Math.round(aiResult.criticalityScore || 0),
    aiConfidence: aiResult.confidence || 0,
    aiSeverity: aiResult.severity || 'medium',
    emergencyFlag: !!aiResult.emergencyFlag,
    detectedObjects: aiResult.detectedObjects || [],
    extractedKeywords: aiResult.extractedKeywords || [],
    analysisTimestamp: aiResult.analysisTimestamp || new Date(),

    aiCategory: aiResult.category || '',
    aiRecommendedAction: aiResult.recommendedAction || '',
    sentiment: aiResult.sentiment || { score: 0, label: 'neutral' },

    location: {
      address: draft.location.text || '',
      lat: draft.location.lat,
      lng: draft.location.lng,
      district: draft.location.zone || '',
      ward: draft.location.ward || '',
      zone: draft.location.zone || '',
    },

    reportedBy: conversation.citizen || null,
    department: deptInfo.name,
    status: 'pending',

    source: conversation.channel === 'WHATSAPP' ? 'WHATSAPP' : 'AI',
    conversation: conversation._id,
    originalLanguage: conversation.language,
    drain: draft.nearbyDrain || null,
    needsAiReview: (aiResult.confidence || 0) < AI_REVIEW_CONFIDENCE_THRESHOLD,

    timeline: [
      {
        title: 'Issue Reported',
        description: `Reported via SheharSetu AI Assistant (${conversation.channel}). ${imageMediaDocs.length} image(s)${audioMediaDocs.length ? ', voice message' : ''} attached.`,
        timestamp: new Date(),
        actor: conversation.channel === 'WHATSAPP' ? 'Citizen (WhatsApp)' : 'Citizen (Web Chat)',
      },
      {
        title: 'AI Classification Complete',
        description: `Classified as "${draft.category}" (${Math.round((aiResult.confidence || 0) * 100)}% confidence). Priority: ${aiResult.priority || aiResult.severity || 'medium'}. Routed to ${deptInfo.name}.${(aiResult.confidence || 0) < AI_REVIEW_CONFIDENCE_THRESHOLD ? ' Flagged for human review (low confidence).' : ''}`,
        timestamp: new Date(),
        actor: 'SheharSetu AI',
      },
    ],
  });

  draft.confirmationState = 'CONFIRMED';
  draft.submittedIssue = issue._id;
  await draft.save();

  conversation.state = 'SUBMITTED';
  conversation.activeIssue = issue._id;
  conversation.draft = null;

  return reply(
    t('submitted', lang, { ticketId: issue.ticketId, category: issue.category, department: issue.department, locationText: draft.location.text }),
    conversation, draft, issue
  );
}

// ── Main entry point ──────────────────────────────────
/**
 * @param {Document} conversation  a loaded Conversation mongoose document
 * @param {object} input
 *   { messageType: 'TEXT'|'IMAGE'|'AUDIO'|'LOCATION',
 *     text, location: {lat,lng,name,address},
 *     mediaFile: {url, mimetype, size, path} }
 */
async function handleMessage(conversation, input) {
  const lang = conversation.language || 'en';
  const text = (input.text || '').trim();

  // ── Universal intents (work in any state) ──
  if (isHelpRequest(text)) return reply(t('help', lang), conversation, null);
  if (isStatusQuery(text)) return handleStatusQuery(conversation, text, lang);

  if (conversation.state === 'NEW' && (isGreeting(text) || !text)) {
    conversation.state = 'UNDERSTANDING';
    return reply(t('greeting', lang), conversation, null);
  }

  let draft = conversation.draft ? await ComplaintDraft.findById(conversation.draft) : null;

  if (isCancelRequest(text) && draft) {
    draft.confirmationState = 'CANCELLED';
    await draft.save();
    conversation.state = 'NEW';
    conversation.draft = null;
    return reply(t('cancelled', lang), conversation, draft);
  }

  // ── Confirmation-state handling: yes / cancel / correction (spec §19–20) ──
  if (conversation.state === 'CONFIRMATION' && draft) {
    if (isAffirmative(text)) return submitComplaint(conversation, draft, lang);
    if (isNegativeOrSkip(text)) {
      draft.confirmationState = 'CANCELLED';
      await draft.save();
      conversation.state = 'NEW';
      conversation.draft = null;
      return reply(t('cancelled', lang), conversation, draft);
    }
    if (isEditRequest(text) && text.split(/\s+/).length <= 2) {
      return reply(t('askWhatToEdit', lang), conversation, draft); // stay in CONFIRMATION; next message is the correction
    }
    // Any other message is treated as a targeted correction to one field only.
    if (/location|लोकेशन|जगह/i.test(text)) {
      draft.location.text = text.replace(/^(actually |it'?s |location is |location:)/i, '').trim();
      draft.location.resolved = true;
    } else if (text) {
      draft.description = text;
      const aiResult = await aiService.classifyIssue(draft.description);
      draft.aiClassification = { ...(draft.aiClassification || {}), ...aiResult };
      draft.category = aiResult.category;
    }
    await draft.save();
    const summaryText = t('summary', lang, {
      category: draft.category, description: draft.description, locationText: draft.location.text,
      hasPhoto: draft.imageMedia.length > 0, priority: draft.aiClassification?.priority,
    });
    return reply(`${summaryText}\n\n${t('askConfirmation', lang)}`, conversation, draft);
  }

  // ── Ingest this message into the draft ──
  if (!draft) {
    draft = await ComplaintDraft.create({ conversation: conversation._id });
    conversation.draft = draft._id;
  }

  if (text) {
    const detected = detectLanguage(text);
    if (detected.confident) conversation.language = detected.language;
  }

  if ((input.messageType === 'LOCATION' || input.location) && input.location) {
    const { lat, lng, address, name } = input.location;
    const wardInfo = resolveWard(lat, lng);
    draft.location = {
      text: address || name || draft.location?.text || '',
      lat, lng,
      ward: wardInfo.ward, zone: wardInfo.zone,
      resolved: true,
    };
  }

  let transcriptionFailed = false;
  if (input.messageType === 'IMAGE' && input.mediaFile) {
    const media = await Media.create({
      type: 'IMAGE', storageRef: input.mediaFile.url, mimeType: input.mediaFile.mimetype,
      size: input.mediaFile.size, source: conversation.channel,
    });
    draft.imageMedia.push(media._id);
  }
  if (input.messageType === 'AUDIO' && input.mediaFile) {
    const media = await Media.create({
      type: 'AUDIO', storageRef: input.mediaFile.url, mimeType: input.mediaFile.mimetype,
      size: input.mediaFile.size, source: conversation.channel,
    });
    draft.audioMedia.push(media._id);
    try {
      const { transcript } = await aiService.transcribeVoice(input.mediaFile.path);
      if (transcript) {
        draft.description = [draft.description, transcript].filter(Boolean).join(' ');
      } else {
        transcriptionFailed = true; // no OPENAI_API_KEY configured — expected in demo mode
      }
    } catch (_) {
      transcriptionFailed = true;
    }
  }
  if (input.messageType === 'TEXT' && text) {
    draft.description = [draft.description, text].filter(Boolean).join(' ');
  }

  // ── Re-classify with everything accumulated so far ──
  if (draft.description || draft.imageMedia.length) {
    const imageFilenames = (await Media.find({ _id: { $in: draft.imageMedia } }).select('storageRef')).map((m) => m.storageRef);
    const aiResult = await aiService.multimodalAnalysis({ text: draft.description, imageFilenames, transcript: '' });
    draft.aiClassification = aiResult;
    draft.category = aiResult.category;
  }

  if (draft.category && draft.location?.lat != null && !draft.nearbyDrain) {
    const nearby = await findNearbyDrain(draft.category, draft.location.lat, draft.location.lng);
    if (nearby) draft.nearbyDrain = nearby._id;
  }

  await draft.save();

  // ── Decide the single next question (spec §21, §106: ask one thing at a time) ──
  const replyParts = [];

  if (transcriptionFailed) replyParts.push(t('transcriptionFailed', lang));

  if (!draft.description && draft.imageMedia.length === 0) {
    conversation.state = 'COLLECTING_DETAILS';
    replyParts.push(t('fallbackError', lang));
    return reply(replyParts.join('\n\n'), conversation, draft);
  }

  if (conversation.state === 'UNDERSTANDING' || conversation.state === 'NEW' || conversation.state === 'COLLECTING_DETAILS') {
    if (draft.aiClassification?.category) replyParts.push(t('categoryDetected', lang, { category: draft.aiClassification.category }));
  }

  if (!draft.location?.resolved) {
    conversation.state = 'LOCATION_REQUIRED';
    replyParts.push(t('askLocation', lang));
    return reply(replyParts.join('\n\n'), conversation, draft);
  }
  if (conversation.state === 'LOCATION_REQUIRED') replyParts.push(t('locationReceived', lang));

  if (draft.imageMedia.length === 0 && conversation.state !== 'MEDIA_OPTIONAL') {
    conversation.state = 'MEDIA_OPTIONAL';
    replyParts.push(t('askPhotoOptional', lang));
    return reply(replyParts.join('\n\n'), conversation, draft);
  }
  if (draft.imageMedia.length > 0 && input.messageType === 'IMAGE') replyParts.push(t('photoReceived', lang));

  // ── Everything we need is in — build the confirmation summary ──
  conversation.state = 'CONFIRMATION';

  const dup = await findRecentSimilarIssue(draft.category, draft.location.lat, draft.location.lng);
  if (dup) replyParts.push(t('duplicateFound', lang));

  if (draft.nearbyDrain) {
    const drainDoc = await Drain.findById(draft.nearbyDrain).select('latest').lean();
    if (drainDoc) replyParts.push(t('nearbyDrainNote', lang, { waterStatus: drainDoc.latest?.waterStatus }));
  }

  replyParts.push(t('summary', lang, {
    category: draft.category,
    description: draft.description,
    locationText: draft.location.text || [draft.location.ward, draft.location.zone].filter(Boolean).join(', '),
    hasPhoto: draft.imageMedia.length > 0,
    priority: draft.aiClassification?.priority,
  }));
  replyParts.push(t('askConfirmation', lang));

  return reply(replyParts.join('\n\n'), conversation, draft);
}

module.exports = { handleMessage, isGreeting, extractTicketId };
