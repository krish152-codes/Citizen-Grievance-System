/**
 * AI Service — Issue classification, letter generation, sentiment analysis
 * Works 100% without any API keys using rule-based logic.
 * Set OPENAI_API_KEY in .env for AI-generated letters.
 */

const CATEGORY_KEYWORDS = {
  waste:          ['garbage','trash','waste','dumping','litter','rubbish','sanitation','debris','filth','dump','stench','smell','odor','rats','rodents','flies','sweeper'],
  water:          ['water','pipe','leak','flood','drain','sewage','plumbing','burst','overflow','puddle','stagnant','waterlogging','tap','supply','shortage','contamination'],
  electricity:    ['electricity','electric','power','light','streetlight','bulb','wire','transformer','outage','blackout','sparking','shock','short circuit','pole','cable'],
  roads:          ['road','pothole','pavement','sidewalk','footpath','crack','bump','asphalt','street','highway','divider','speed breaker','broken road','damaged road'],
  infrastructure: ['building','bridge','wall','construction','structure','fence','barrier','overhead','collapse','boundary','compound','public toilet','school building'],
  public_safety:  ['danger','unsafe','hazard','fire','accident','crime','theft','violence','security','dark','no light','open drain','uncovered','exposed wire'],
  parks:          ['park','garden','tree','bench','playground','grass','plant','ground','recreation','fallen tree','broken bench'],
  traffic:        ['traffic','signal','sign','jam','congestion','vehicle','zebra crossing','parking','no signal','broken signal','road marking'],
};

const PRIORITY_KEYWORDS = {
  critical: ['emergency','urgent','immediate','collapse','burst','flood','fire','accident','danger','hazard','critical','life threatening'],
  high:     ['major','large','multiple','severe','bad','broken','blocked','weeks','months','affecting many','no water','no power','overflowing'],
  medium:   ['problem','issue','need','repair','fix','damage','dirty','smell','inconvenient'],
  low:      ['minor','small','slight','little','suggestion','aesthetic','cosmetic','improvement'],
};

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

// ── Classify issue from text ──────────────────────────
const classifyIssue = async (text) => {
  const lower = text.toLowerCase();

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

// ── Generate formal application letter ───────────────
const generateApplicationLetter = async (issue) => {
  const { title, description, category, priority, location, reportedBy, ticketId } = issue;
  const dept = DEPARTMENT_MAP[category] || 'Municipal Corporation';
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const reporterName = reportedBy?.name || 'Concerned Citizen';
  const reporterEmail = reportedBy?.email || '';
  const locationStr = location?.address || location?.district || 'the mentioned locality';
  const priorityLabel = priority === 'critical'
    ? 'URGENT — IMMEDIATE ACTION REQUIRED'
    : priority === 'high' ? 'HIGH PRIORITY' : 'ATTENTION REQUIRED';

  // Try OpenAI if key is set
  if (process.env.OPENAI_API_KEY) {
    try {
      const https = require('https');
      const body = JSON.stringify({
        model: 'gpt-3.5-turbo',
        max_tokens: 900,
        messages: [
          {
            role: 'system',
            content: 'You are a formal civic complaint letter writer for Indian municipal corporations. Write professional complaint letters in English. Include salutation, subject line, detailed body, polite but firm tone, clear resolution request, and proper closing. Plain text only.',
          },
          {
            role: 'user',
            content: `Write a formal complaint letter:\nTicket: ${ticketId}\nIssue: ${title}\nDescription: ${description}\nLocation: ${locationStr}\nCategory: ${category}\nPriority: ${priority}\nReporter: ${reporterName} (${reporterEmail})\nDepartment: ${dept}\nDate: ${date}`,
          },
        ],
      });

      const result = await new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: 'api.openai.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Length': Buffer.byteLength(body),
            },
          },
          (res) => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
              try { resolve(JSON.parse(data)); }
              catch (e) { reject(e); }
            });
          }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      if (result.choices?.[0]?.message?.content) {
        return {
          letter: result.choices[0].message.content,
          generatedBy: 'AI (OpenAI GPT-3.5)',
          department: dept,
        };
      }
    } catch (err) {
      console.log('OpenAI unavailable, using template:', err.message);
    }
  }

  // Smart template (works without any API key)
  const letter = `To,
The Head of Department,
${dept},
Municipal Corporation / City Administration

Date: ${date}
Reference: Complaint Ticket #${ticketId}
Priority: [${priorityLabel}]

Subject: Formal Complaint Regarding "${title}" at ${locationStr}

Respected Sir/Madam,

I, ${reporterName}${reporterEmail ? ` (Contact: ${reporterEmail})` : ''}, am writing this formal complaint to bring to your immediate attention a civic issue requiring departmental intervention.

COMPLAINT DETAILS:
━━━━━━━━━━━━━━━━━
- Issue Category  : ${(category || 'General').replace(/_/g, ' ').toUpperCase()}
- Location        : ${locationStr}
- Priority Level  : ${priority.toUpperCase()}
- Ticket ID       : #${ticketId}
- Date Reported   : ${date}

DESCRIPTION OF ISSUE:
━━━━━━━━━━━━━━━━━━━━
${description}

IMPACT ON CITIZENS:
━━━━━━━━━━━━━━━━━━
${priority === 'critical'
    ? 'This situation poses an IMMEDIATE threat to public safety and health. Emergency intervention is required at the earliest.'
    : priority === 'high'
    ? 'This issue is causing significant inconvenience and potential safety risks to residents and needs urgent attention.'
    : 'This issue is adversely affecting the quality of life in the area and requires timely resolution.'}

REQUESTED ACTIONS:
━━━━━━━━━━━━━━━━━
1. Acknowledge receipt of this complaint within 24 hours
2. Conduct an inspection of the reported site at the earliest
3. Take corrective action within a reasonable and committed timeframe
4. Provide a status update to the complainant upon resolution

I trust your department will treat this matter with the urgency it deserves.

Yours faithfully,

${reporterName}
${reporterEmail}
Submitted via: CityPulse AI Civic Platform
Ticket Reference: #${ticketId}

─────────────────────────────────────────────────
[Auto-generated by CityPulse AI — Print or email to the department]`;

  return {
    letter,
    generatedBy: 'CityPulse AI (Smart Template)',
    department: dept,
  };
};

// ── Garbage detection (mock) ──────────────────────────
const detectGarbage = async (imagePath) => {
  const detected = Math.random() > 0.4;
  return {
    detected,
    confidence: detected
      ? parseFloat((0.72 + Math.random() * 0.26).toFixed(2))
      : parseFloat((Math.random() * 0.3).toFixed(2)),
    labels: detected ? ['waste', 'garbage', 'debris'] : [],
    message: detected ? 'Waste detected in image' : 'No significant waste detected',
  };
};

// ── Sentiment analysis ────────────────────────────────
const sentimentAnalysis = async (text) => {
  const lower = text.toLowerCase();
  const neg = ['terrible','worst','disgusting','horrible','outrage','angry','frustrated','pathetic','useless'].filter(w => lower.includes(w)).length;
  const pos = ['please','hope','appreciate','thank','good'].filter(w => lower.includes(w)).length;
  const score = (pos - neg) / Math.max(lower.split(' ').length / 10, 1);
  return {
    score: parseFloat(score.toFixed(3)),
    label: score > 0.05 ? 'positive' : score < -0.05 ? 'negative' : 'neutral',
    urgency: neg > 2 ? 'high' : neg > 0 ? 'medium' : 'low',
  };
};

module.exports = { classifyIssue, generateApplicationLetter, detectGarbage, sentimentAnalysis };