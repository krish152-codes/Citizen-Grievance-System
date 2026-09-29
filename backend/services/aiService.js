/**
 * AI Service — Multimodal analysis: image + voice + text
 * Works 100% without any API keys using rule-based logic.
 * Set OPENAI_API_KEY in .env for AI-generated letters + Whisper transcription.
 */

const CATEGORY_KEYWORDS = {
  waste:          ['garbage','trash','waste','dumping','litter','rubbish','sanitation','debris','filth','dump','stench','smell','odor','rats','rodents','flies','sweeper','overflow','overflowing garbage'],
  water:          ['water','pipe','leak','flood','drain','sewage','plumbing','burst','overflow','puddle','stagnant','waterlogging','tap','supply','shortage','contamination','sewage overflow'],
  electricity:    ['electricity','electric','power','light','streetlight','bulb','wire','transformer','outage','blackout','sparking','shock','short circuit','pole','cable','exposed wire','live wire'],
  roads:          ['road','pothole','pavement','sidewalk','footpath','crack','bump','asphalt','street','highway','divider','speed breaker','broken road','damaged road','road damage','road collapse'],
  infrastructure: ['building','bridge','wall','construction','structure','fence','barrier','overhead','collapse','boundary','compound','public toilet','school building'],
  public_safety:  ['danger','unsafe','hazard','fire','accident','crime','theft','violence','security','dark','no light','open drain','uncovered','exposed wire','fire risk','flooding','severe flood'],
  parks:          ['park','garden','tree','bench','playground','grass','plant','ground','recreation','fallen tree','broken bench'],
  traffic:        ['traffic','signal','sign','jam','congestion','vehicle','zebra crossing','parking','no signal','broken signal','road marking','traffic blockage'],
};

const PRIORITY_KEYWORDS = {
  critical: ['emergency','urgent','immediate','collapse','burst','flood','fire','accident','danger','hazard','critical','life threatening','exposed wire','road collapse','severe flooding'],
  high:     ['major','large','multiple','severe','bad','broken','blocked','weeks','months','affecting many','no water','no power','overflowing','dangerous','safety risk'],
  medium:   ['problem','issue','need','repair','fix','damage','dirty','smell','inconvenient'],
  low:      ['minor','small','slight','little','suggestion','aesthetic','cosmetic','improvement'],
};

// Objects detectable from image filename/context hints + explicit labels
const VISUAL_PATTERNS = {
  waste:          { keywords: ['garbage','trash','waste','litter','dump','rubbish','overflow','bin'],         objects: ['garbage pile','waste overflow','litter'] },
  roads:          { keywords: ['pothole','crack','broken','asphalt','road','pavement','damaged'],             objects: ['pothole','road crack','road damage'] },
  water:          { keywords: ['water','leak','flood','sewage','puddle','drain','pipe'],                      objects: ['water leak','flooding','sewage overflow'] },
  electricity:    { keywords: ['wire','electric','cable','transformer','pole','light','blackout','sparking'], objects: ['exposed wire','broken streetlight','transformer fault'] },
  public_safety:  { keywords: ['fire','smoke','collapse','danger','hazard','unsafe','open','exposed'],        objects: ['fire hazard','safety risk','open drain'] },
  infrastructure: { keywords: ['wall','building','bridge','collapse','crack','broken','fence'],               objects: ['structural damage','broken wall','bridge issue'] },
  traffic:        { keywords: ['signal','traffic','jam','congestion','sign','zebra'],                        objects: ['traffic jam','broken signal','road blockage'] },
  parks:          { keywords: ['tree','park','bench','grass','garden','playground'],                         objects: ['fallen tree','broken bench','garden damage'] },
};

// Emergency-level visual indicators
const EMERGENCY_VISUAL = ['exposed wire','live wire','fire','road collapse','severe flood','flooding','sewage overflow','open drain','collapse','dangerous'];

const DEPARTMENT_MAP = {
  waste:          'Sanitation & Waste Management',
  water:          'Water Supply Department',
  electricity:    'Electricity Department',
  roads:          'Public Works Department',
  infrastructure: 'Infrastructure Department',
  public_safety:  'Public Safety Department',
  parks:          'Parks & Recreation Department',
  traffic:        'Traffic Management Department',
  other:          'Municipal Corporation',
};

const RECOMMENDED_ACTIONS = {
  waste:          'Dispatch sanitation crew and schedule waste pickup',
  water:          'Send plumbing team for inspection and repair',
  electricity:    'Alert electrical maintenance team for urgent inspection',
  roads:          'Schedule road repair crew with materials',
  infrastructure: 'Conduct structural inspection and safety assessment',
  public_safety:  'Immediate dispatch of safety response team',
  parks:          'Schedule parks maintenance team',
  traffic:        'Alert traffic control center and signal maintenance',
  other:          'Route to relevant municipal department',
};

// ── Core text classification ──────────────────────────
const classifyIssue = async (text) => {
  const lower = (text || '').toLowerCase();

  let maxScore = 0;
  let category = 'other';
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > maxScore) { maxScore = score; category = cat; }
  }

  let priority = 'medium';
  for (const [prio, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) { priority = prio; break; }
  }

  const confidence = Math.min(0.97, 0.55 + maxScore * 0.08);

  const negWords = ['terrible','worst','disgusting','horrible','outrage','angry','frustrated','pathetic','useless','shameful','negligence'];
  const posWords = ['please','hope','request','appreciate','thank','good','nice','helpful'];
  const neg = negWords.filter(w => lower.includes(w)).length;
  const pos = posWords.filter(w => lower.includes(w)).length;
  const sentimentScore = neg > pos ? -0.6 : pos > neg ? 0.4 : 0;

  return {
    category,
    priority,
    confidence: parseFloat(confidence.toFixed(2)),
    department: DEPARTMENT_MAP[category],
    recommendedAction: RECOMMENDED_ACTIONS[category],
    sentiment: {
      score: sentimentScore,
      label: sentimentScore > 0 ? 'positive' : sentimentScore < 0 ? 'negative' : 'neutral',
    },
  };
};

// ── Image analysis (rule-based on filename / future hook) ──
const analyzeImage = async (imagePath, imageFilename) => {
  const lower = (imageFilename || imagePath || '').toLowerCase();

  let detectedCategory = 'other';
  let detectedObjects  = [];
  let maxMatches = 0;

  for (const [cat, { keywords, objects }] of Object.entries(VISUAL_PATTERNS)) {
    const matches = keywords.filter(kw => lower.includes(kw)).length;
    if (matches > maxMatches) {
      maxMatches       = matches;
      detectedCategory = cat;
      detectedObjects  = objects.slice(0, 3);
    }
  }

  // If no filename hints, default to generic civic issue
  if (maxMatches === 0) {
    detectedCategory = 'other';
    detectedObjects  = ['civic issue'];
  }

  const confidence = Math.min(0.95, 0.60 + maxMatches * 0.08);
  const isEmergency = detectedObjects.some(obj =>
    EMERGENCY_VISUAL.some(ev => obj.toLowerCase().includes(ev))
  );

  const severityMap = { public_safety: 'high', electricity: 'high', water: 'high', roads: 'medium', waste: 'medium', traffic: 'low', parks: 'low', infrastructure: 'medium', other: 'medium' };

  return {
    category:    detectedCategory,
    severity:    isEmergency ? 'critical' : severityMap[detectedCategory] || 'medium',
    confidence:  parseFloat(confidence.toFixed(2)),
    emergency:   isEmergency,
    detectedObjects,
    criticalityScore: isEmergency ? 8 + Math.random() * 2 : 3 + Math.random() * 4,
  };
};

// ── Voice / transcript analysis ───────────────────────
const analyzeTranscript = async (transcript) => {
  if (!transcript) return null;
  const textResult = await classifyIssue(transcript);

  // Extract location hints from transcript
  const locationHints = [];
  const locationWords = ['near','beside','in front of','behind','at','opposite','next to','corner of','road','street','lane','area','colony','sector','ward','district','main','market','school','hospital','park','bridge'];
  const words = transcript.toLowerCase().split(/\s+/);
  words.forEach((word, i) => {
    if (locationWords.includes(word) && words[i + 1]) {
      locationHints.push(`${word} ${words[i + 1]}`);
    }
  });

  // Extract keywords
  const urgencyKeywords = ['emergency','urgent','immediate','dangerous','accident','fire','flood','collapse','expose','leak'];
  const extractedKeywords = urgencyKeywords.filter(kw => transcript.toLowerCase().includes(kw));

  return {
    ...textResult,
    locationHints: [...new Set(locationHints)],
    extractedKeywords,
    transcriptLength: transcript.length,
  };
};

// ── OpenAI Whisper transcription (optional) ───────────
const transcribeVoice = async (audioFilePath) => {
  if (!process.env.OPENAI_API_KEY) {
    // Fallback — return empty; frontend should use Web Speech API
    return { transcript: '', method: 'unavailable' };
  }

  try {
    const fs   = require('fs');
    const path = require('path');
    const https = require('https');
    const FormData = require('form-data');

    const form = new FormData();
    form.append('file', fs.createReadStream(audioFilePath), {
      filename: path.basename(audioFilePath),
      contentType: 'audio/webm',
    });
    form.append('model', 'whisper-1');
    form.append('language', 'en');

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.openai.com',
        path:     '/v1/audio/transcriptions',
        method:   'POST',
        headers:  {
          ...form.getHeaders(),
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      form.pipe(req);
    });

    return { transcript: result.text || '', method: 'whisper' };
  } catch (err) {
    console.log('Whisper unavailable:', err.message);
    return { transcript: '', method: 'failed' };
  }
};

// ── Combined multimodal analysis ──────────────────────
const multimodalAnalysis = async ({ text, imageFilenames = [], transcript = '' }) => {
  const combinedText = [text, transcript].filter(Boolean).join(' ');

  const [textResult, transcriptResult] = await Promise.all([
    combinedText ? classifyIssue(combinedText) : null,
    transcript   ? analyzeTranscript(transcript) : null,
  ]);

  // Analyze each image
  const imageResults = await Promise.all(
    imageFilenames.map(fn => analyzeImage('', fn))
  );

  // Vote on category
  const votes = {};
  const addVote = (cat, weight) => { votes[cat] = (votes[cat] || 0) + weight; };
  if (textResult)       addVote(textResult.category, 1.5);
  if (transcriptResult) addVote(transcriptResult.category, 1.2);
  imageResults.forEach(r => addVote(r.category, 1.0));

  let finalCategory = 'other';
  let maxVotes = 0;
  for (const [cat, score] of Object.entries(votes)) {
    if (score > maxVotes) { maxVotes = score; finalCategory = cat; }
  }

  // Aggregate severity / emergency
  const allEmergency = imageResults.some(r => r.emergency) ||
    (transcriptResult?.extractedKeywords || []).some(kw => ['emergency','fire','collapse','flood','exposed'].includes(kw));

  const priorities = [textResult?.priority, transcriptResult?.priority, ...imageResults.map(r => r.severity)].filter(Boolean);
  const priorityRank = { critical: 4, high: 3, medium: 2, low: 1 };
  const finalPriority = priorities.reduce((best, p) => (priorityRank[p] > priorityRank[best] ? p : best), 'medium');

  // Aggregate detected objects
  const allObjects = [...new Set(imageResults.flatMap(r => r.detectedObjects))];

  // Aggregate keywords
  const allKeywords = [...new Set([
    ...(transcriptResult?.extractedKeywords || []),
    ...(textResult ? [] : []),
  ])];

  // Confidence
  const confidences = [textResult?.confidence, transcriptResult?.confidence, ...imageResults.map(r => r.confidence)].filter(Boolean);
  const avgConfidence = confidences.length
    ? parseFloat((confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(2))
    : 0.65;

  // Criticality score (0–10)
  const criticalityScore = allEmergency ? parseFloat((8 + Math.random()).toFixed(1))
    : finalPriority === 'high' ? parseFloat((5 + Math.random() * 2).toFixed(1))
    : parseFloat((2 + Math.random() * 3).toFixed(1));

  // Auto-generate summary
  const aiGeneratedSummary = generateSummary({ finalCategory, finalPriority, allObjects, transcript, text, allEmergency });

  return {
    category:           finalCategory,
    severity:           finalPriority,
    priority:           finalPriority,
    confidence:         avgConfidence,
    criticalityScore,
    emergency:          allEmergency,
    emergencyFlag:      allEmergency,
    aiGeneratedSummary,
    detectedObjects:    allObjects,
    extractedKeywords:  allKeywords,
    department:         DEPARTMENT_MAP[finalCategory] || 'Municipal Corporation',
    recommendedAction:  RECOMMENDED_ACTIONS[finalCategory] || RECOMMENDED_ACTIONS.other,
    sentiment:          textResult?.sentiment || { score: 0, label: 'neutral' },
    analysisTimestamp:  new Date(),
  };
};

// ── Summary generator ─────────────────────────────────
const generateSummary = ({ finalCategory, finalPriority, allObjects, transcript, text, allEmergency }) => {
  const catLabel = finalCategory.replace(/_/g, ' ');
  const objectStr = allObjects.length > 0 ? allObjects.slice(0, 2).join(' and ') : catLabel + ' issue';
  const severityStr = allEmergency ? 'emergency-level' : finalPriority === 'high' ? 'severe' : finalPriority === 'medium' ? 'moderate' : 'minor';
  const baseText = text || transcript || '';
  const locHint = baseText.length > 5 ? ` reported in the area` : '';

  const templates = {
    waste:          `${objectStr.charAt(0).toUpperCase() + objectStr.slice(1)} detected${locHint}, causing sanitation concerns and public health risks. Requires immediate attention from the ${DEPARTMENT_MAP.waste}.`,
    water:          `${severityStr.charAt(0).toUpperCase() + severityStr.slice(1)} water supply or drainage issue detected${locHint}. ${objectStr} observed. Action required from ${DEPARTMENT_MAP.water}.`,
    electricity:    `${severityStr.charAt(0).toUpperCase() + severityStr.slice(1)} electrical hazard reported${locHint}. ${objectStr} identified. Urgent inspection required by ${DEPARTMENT_MAP.electricity}.`,
    roads:          `${severityStr.charAt(0).toUpperCase() + severityStr.slice(1)} road damage identified${locHint}. ${objectStr} observed causing traffic and safety concerns. ${DEPARTMENT_MAP.roads} notified.`,
    infrastructure: `Structural concern reported${locHint}. ${objectStr} detected. Assessment required by ${DEPARTMENT_MAP.infrastructure}.`,
    public_safety:  `${allEmergency ? 'EMERGENCY: ' : ''}Public safety hazard reported${locHint}. ${objectStr} identified. Immediate response required.`,
    parks:          `Parks and recreation issue detected${locHint}. ${objectStr} observed. Maintenance required.`,
    traffic:        `Traffic-related issue reported${locHint}. ${objectStr} identified causing congestion.`,
    other:          `Civic issue reported${locHint}. ${objectStr} detected. Routed to Municipal Corporation for review.`,
  };

  return templates[finalCategory] || templates.other;
};

// ── Application letter (kept from original) ───────────
const generateApplicationLetter = async (issue) => {
  const { title, description, category, priority, location, reportedBy, ticketId } = issue;
  const dept          = DEPARTMENT_MAP[category] || 'Municipal Corporation';
  const date          = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const reporterName  = reportedBy?.name || 'Concerned Citizen';
  const reporterEmail = reportedBy?.email || '';
  const locationStr   = location?.address || location?.district || 'the mentioned locality';
  const priorityLabel = priority === 'critical' ? 'URGENT — IMMEDIATE ACTION REQUIRED' : priority === 'high' ? 'HIGH PRIORITY' : 'ATTENTION REQUIRED';

  if (process.env.OPENAI_API_KEY) {
    try {
      const https = require('https');
      const body  = JSON.stringify({
        model: 'gpt-3.5-turbo',
        max_tokens: 900,
        messages: [
          { role: 'system', content: 'You are a formal civic complaint letter writer for Indian municipal corporations. Write professional complaint letters in English. Plain text only.' },
          { role: 'user',   content: `Write a formal complaint letter:\nTicket: ${ticketId}\nIssue: ${title}\nDescription: ${description}\nLocation: ${locationStr}\nCategory: ${category}\nPriority: ${priority}\nReporter: ${reporterName} (${reporterEmail})\nDepartment: ${dept}\nDate: ${date}` },
        ],
      });
      const result = await new Promise((resolve, reject) => {
        const req = https.request({ hostname: 'api.openai.com', path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Length': Buffer.byteLength(body) } }, (res) => {
          let data = '';
          res.on('data', chunk => (data += chunk));
          res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });
      if (result.choices?.[0]?.message?.content) {
        return { letter: result.choices[0].message.content, generatedBy: 'AI (OpenAI GPT-3.5)', department: dept };
      }
    } catch (err) { console.log('OpenAI unavailable:', err.message); }
  }

  const letter = `To,\nThe Head of Department,\n${dept},\nMunicipal Corporation / City Administration\n\nDate: ${date}\nReference: Complaint Ticket #${ticketId}\nPriority: [${priorityLabel}]\n\nSubject: Formal Complaint Regarding \"${title}\" at ${locationStr}\n\nRespected Sir/Madam,\n\nI, ${reporterName}${reporterEmail ? ` (Contact: ${reporterEmail})` : ''}, am writing this formal complaint to bring to your immediate attention a civic issue requiring departmental intervention.\n\nCOMPLAINT DETAILS:\n━━━━━━━━━━━━━━━━━\n- Issue Category  : ${(category || 'General').replace(/_/g, ' ').toUpperCase()}\n- Location        : ${locationStr}\n- Priority Level  : ${priority.toUpperCase()}\n- Ticket ID       : #${ticketId}\n- Date Reported   : ${date}\n\nDESCRIPTION OF ISSUE:\n━━━━━━━━━━━━━━━━━━━━\n${description || issue.aiGeneratedSummary || 'Civic issue reported via Nagar Mitra.'}\n\nREQUESTED ACTIONS:\n━━━━━━━━━━━━━━━━━\n1. Acknowledge receipt of this complaint within 24 hours\n2. Conduct an inspection of the reported site at the earliest\n3. Take corrective action within a reasonable and committed timeframe\n4. Provide a status update to the complainant upon resolution\n\nYours faithfully,\n${reporterName}\n${reporterEmail}\nSubmitted via: Nagar Mitra\nTicket Reference: #${ticketId}\n─────────────────────────────────────────────────\n[By Nagar Mitra]`;

  return { letter, generatedBy: 'Nagar Mitra (Smart Template)', department: dept };
};

// ── Sentiment analysis ────────────────────────────────
const sentimentAnalysis = async (text) => {
  const lower = (text || '').toLowerCase();
  const neg = ['terrible','worst','disgusting','horrible','outrage','angry','frustrated','pathetic','useless'].filter(w => lower.includes(w)).length;
  const pos = ['please','hope','appreciate','thank','good'].filter(w => lower.includes(w)).length;
  const score = (pos - neg) / Math.max(lower.split(' ').length / 10, 1);
  return {
    score:   parseFloat(score.toFixed(3)),
    label:   score > 0.05 ? 'positive' : score < -0.05 ? 'negative' : 'neutral',
    urgency: neg > 2 ? 'high' : neg > 0 ? 'medium' : 'low',
  };
};

// ── Garbage detection (mock) ──────────────────────────
const detectGarbage = async (imagePath) => {
  const detected = Math.random() > 0.4;
  return {
    detected,
    confidence: detected ? parseFloat((0.72 + Math.random() * 0.26).toFixed(2)) : parseFloat((Math.random() * 0.3).toFixed(2)),
    labels:  detected ? ['waste','garbage','debris'] : [],
    message: detected ? 'Waste detected in image' : 'No significant waste detected',
  };
};

module.exports = {
  classifyIssue,
  generateApplicationLetter,
  detectGarbage,
  sentimentAnalysis,
  analyzeImage,
  analyzeTranscript,
  transcribeVoice,
  multimodalAnalysis,
};
