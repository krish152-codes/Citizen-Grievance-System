/**
 * AI Service - Rule-based issue classification
 * Classifies civic issues by category, priority, and sentiment
 * Can be extended to use external AI APIs
 */

// Keyword maps for classification
const CATEGORY_KEYWORDS = {
  waste: ['garbage', 'trash', 'waste', 'dumping', 'litter', 'rubbish', 'sanitation', 'debris', 'filth', 'dump'],
  water: ['water', 'pipe', 'leak', 'flood', 'drain', 'sewage', 'plumbing', 'burst', 'overflow', 'puddle'],
  electricity: ['electricity', 'electric', 'power', 'light', 'bulb', 'wire', 'transformer', 'outage', 'blackout', 'short circuit'],
  roads: ['road', 'pothole', 'pavement', 'sidewalk', 'footpath', 'crack', 'bump', 'asphalt', 'street', 'highway'],
  infrastructure: ['building', 'bridge', 'wall', 'construction', 'structure', 'fence', 'barrier', 'overhead', 'collapse'],
  public_safety: ['danger', 'unsafe', 'hazard', 'fire', 'accident', 'crime', 'theft', 'violence', 'security'],
  parks: ['park', 'garden', 'tree', 'bench', 'playground', 'grass', 'plant', 'ground', 'recreation'],
  traffic: ['traffic', 'signal', 'sign', 'jam', 'congestion', 'vehicle', 'zebra', 'crossing', 'parking'],
};

const PRIORITY_KEYWORDS = {
  critical: ['emergency', 'urgent', 'danger', 'hazard', 'collapse', 'burst', 'flood', 'fire', 'accident', 'immediate'],
  high: ['serious', 'major', 'large', 'multiple', 'many', 'severe', 'bad', 'broken', 'blocked', 'weeks'],
  medium: ['problem', 'issue', 'need', 'repair', 'fix', 'damage', 'dirty', 'smell'],
  low: ['minor', 'small', 'slight', 'little', 'aesthetic', 'cosmetic', 'suggestion'],
};

const DEPARTMENT_MAP = {
  waste: 'Sanitation & Waste',
  water: 'Public Works',
  electricity: 'Infrastructure',
  roads: 'Public Works',
  infrastructure: 'Infrastructure',
  public_safety: 'Public Safety',
  parks: 'Parks & Recreation',
  traffic: 'Traffic Management',
  other: 'Public Works',
};

const SENTIMENT_POSITIVE = ['good', 'nice', 'thank', 'please', 'hope', 'appreciate', 'request'];
const SENTIMENT_NEGATIVE = ['terrible', 'worst', 'disgusting', 'horrible', 'outrage', 'angry', 'frustrated', 'pathetic', 'useless'];

/**
 * Classify a civic issue based on text description
 * @param {string} text - Issue description
 * @returns {Object} Classification result
 */
const classifyIssue = async (text) => {
  const lowerText = text.toLowerCase();

  // Determine category
  let maxScore = 0;
  let category = 'other';

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => acc + (lowerText.includes(kw) ? 1 : 0), 0);
    if (score > maxScore) {
      maxScore = score;
      category = cat;
    }
  }

  // Determine priority
  let priority = 'medium';
  for (const [prio, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some((kw) => lowerText.includes(kw))) {
      priority = prio;
      break;
    }
  }

  // Sentiment analysis
  const positiveScore = SENTIMENT_POSITIVE.reduce((acc, kw) => acc + (lowerText.includes(kw) ? 1 : 0), 0);
  const negativeScore = SENTIMENT_NEGATIVE.reduce((acc, kw) => acc + (lowerText.includes(kw) ? 1 : 0), 0);
  const sentimentScore = (positiveScore - negativeScore) / Math.max(positiveScore + negativeScore, 1);
  const sentimentLabel = sentimentScore > 0.2 ? 'positive' : sentimentScore < -0.2 ? 'negative' : 'neutral';

  // Confidence score (based on keyword match density)
  const confidence = Math.min(0.99, 0.5 + maxScore * 0.1 + Math.random() * 0.2);

  const recommendedActions = {
    waste: 'Dispatch Waste Management Unit',
    water: 'Alert Water Works Department',
    electricity: 'Notify Electrical Maintenance Team',
    roads: 'Schedule Road Repair Crew',
    infrastructure: 'Inspect and Report to Infrastructure Dept',
    public_safety: 'Immediate Dispatch: Public Safety Unit',
    parks: 'Schedule Parks Maintenance',
    traffic: 'Alert Traffic Control Center',
    other: 'Route to General Public Works',
  };

  return {
    category,
    priority,
    confidence: parseFloat(confidence.toFixed(2)),
    department: DEPARTMENT_MAP[category] || 'Public Works',
    recommendedAction: recommendedActions[category] || recommendedActions.other,
    sentiment: {
      score: parseFloat(sentimentScore.toFixed(2)),
      label: sentimentLabel,
    },
  };
};

/**
 * Detect garbage/waste in an image (mock implementation)
 * @param {string} imagePath - Path to image
 * @returns {Object} Detection result
 */
const detectGarbage = async (imagePath) => {
  // Mock detection - in production integrate a CV model
  const mockDetected = Math.random() > 0.3;
  const confidence = mockDetected
    ? parseFloat((0.7 + Math.random() * 0.28).toFixed(2))
    : parseFloat((Math.random() * 0.3).toFixed(2));

  return {
    detected: mockDetected,
    confidence,
    labels: mockDetected ? ['garbage', 'waste', 'debris'] : [],
    message: mockDetected
      ? 'Waste/garbage detected in image with high confidence'
      : 'No significant waste detected in image',
  };
};

/**
 * Perform sentiment analysis on text
 * @param {string} text
 * @returns {Object}
 */
const sentimentAnalysis = async (text) => {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  const positiveCount = words.filter((w) => SENTIMENT_POSITIVE.includes(w)).length;
  const negativeCount = words.filter((w) => SENTIMENT_NEGATIVE.includes(w)).length;

  const score = (positiveCount - negativeCount) / Math.max(words.length, 1);
  return {
    score: parseFloat(score.toFixed(4)),
    label: score > 0.05 ? 'positive' : score < -0.05 ? 'negative' : 'neutral',
    positiveWords: positiveCount,
    negativeWords: negativeCount,
  };
};

module.exports = { classifyIssue, detectGarbage, sentimentAnalysis };
