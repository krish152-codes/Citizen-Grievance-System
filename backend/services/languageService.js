/**
 * Language detection — works with zero API keys using script + keyword
 * heuristics. Structured so a real provider (e.g. a cloud language-detection
 * API) can be dropped in later behind the same `detectLanguage()` signature.
 *
 * Only 'en' and 'hi' are wired with response templates today (see
 * responseTemplates.js), but detection itself recognizes several other
 * Indian-language scripts so the architecture doesn't have to be reworked
 * to add them — just add their template sets.
 */

// Unicode script ranges for common Indian languages.
const SCRIPT_RANGES = [
  { lang: 'hi', name: 'Hindi',     re: /[\u0900-\u097F]/ },  // Devanagari (also used by Marathi)
  { lang: 'bn', name: 'Bengali',   re: /[\u0980-\u09FF]/ },
  { lang: 'ta', name: 'Tamil',     re: /[\u0B80-\u0BFF]/ },
  { lang: 'te', name: 'Telugu',    re: /[\u0C00-\u0C7F]/ },
  { lang: 'kn', name: 'Kannada',   re: /[\u0C80-\u0CFF]/ },
  { lang: 'ml', name: 'Malayalam', re: /[\u0D00-\u0D7F]/ },
  { lang: 'gu', name: 'Gujarati',  re: /[\u0A80-\u0AFF]/ },
  { lang: 'pa', name: 'Punjabi',   re: /[\u0A00-\u0A7F]/ },
  { lang: 'or', name: 'Odia',      re: /[\u0B00-\u0B7F]/ },
  { lang: 'ur', name: 'Urdu',      re: /[\u0600-\u06FF]/ },
];

// Common romanized Hindi/Hinglish words — catches "Mere ghar ke paas..."
// style messages that are in Latin script but not English.
const HINGLISH_HINTS = [
  'hai', 'hain', 'nahi', 'nahin', 'mera', 'meri', 'mere', 'humare', 'hamare',
  'kya', 'kaise', 'kab', 'kahan', 'paani', 'pani', 'sadak', 'gali', 'mohalla',
  'shikayat', 'naali', 'nali', 'kachra', 'bijli', 'raha', 'rahi', 'bahut',
  'chahiye', 'karo', 'kripya', 'dhanyavad',
];

/**
 * @param {string} text
 * @returns {{ language: string, languageName: string, confident: boolean }}
 */
function detectLanguage(text) {
  if (!text || !text.trim()) return { language: 'en', languageName: 'English', confident: false };

  for (const { lang, name, re } of SCRIPT_RANGES) {
    if (re.test(text)) return { language: lang, languageName: name, confident: true };
  }

  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const hinglishMatches = words.filter((w) => HINGLISH_HINTS.includes(w.replace(/[^\w]/g, ''))).length;

  if (hinglishMatches >= 1) {
    // Romanized Hindi — we respond in Hindi script, since that's what a
    // Hindi-speaking citizen typing in Latin script most likely reads comfortably,
    // but confidence is lower than a script match.
    return { language: 'hi', languageName: 'Hindi (romanized)', confident: hinglishMatches >= 2 };
  }

  return { language: 'en', languageName: 'English', confident: true };
}

// Languages with full response-template coverage today (see responseTemplates.js).
// Detecting a language outside this list still works — the system falls back
// to English templates and flags low confidence so the bot can ask the
// citizen which language they'd prefer, per spec §6.
const SUPPORTED_RESPONSE_LANGUAGES = ['en', 'hi'];

module.exports = { detectLanguage, SUPPORTED_RESPONSE_LANGUAGES };
