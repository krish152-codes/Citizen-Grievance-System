// English + all 22 languages of the Eighth Schedule of the Indian Constitution.
//
// speech  : BCP-47 tag for the browser Web Speech API (null = browsers don't offer it)
// whisper : ISO-639-1 hint for server-side Whisper (null = let Whisper auto-detect)
//
// Browser support varies: Chrome/Edge/Safari reliably do en, hi, bn, ta, te, mr, gu, kn,
// ml, pa, ur, ne. For the rest we fall back to the server (needs OPENAI_API_KEY).
export const LANGUAGES = [
  { code: 'en',  label: 'English',            native: 'English',     speech: 'en-IN',       whisper: 'en' },
  { code: 'hi',  label: 'Hindi',              native: 'हिन्दी',        speech: 'hi-IN',       whisper: 'hi' },
  { code: 'as',  label: 'Assamese',           native: 'অসমীয়া',       speech: 'as-IN',       whisper: 'as' },
  { code: 'bn',  label: 'Bengali',            native: 'বাংলা',         speech: 'bn-IN',       whisper: 'bn' },
  { code: 'brx', label: 'Bodo',               native: 'बड़ो',          speech: null,          whisper: null },
  { code: 'doi', label: 'Dogri',              native: 'डोगरी',         speech: null,          whisper: null },
  { code: 'gu',  label: 'Gujarati',           native: 'ગુજરાતી',       speech: 'gu-IN',       whisper: 'gu' },
  { code: 'kn',  label: 'Kannada',            native: 'ಕನ್ನಡ',         speech: 'kn-IN',       whisper: 'kn' },
  { code: 'ks',  label: 'Kashmiri',           native: 'کٲشُر',         speech: null,          whisper: null },
  { code: 'kok', label: 'Konkani',            native: 'कोंकणी',        speech: null,          whisper: null },
  { code: 'mai', label: 'Maithili',           native: 'मैथिली',        speech: null,          whisper: null },
  { code: 'ml',  label: 'Malayalam',          native: 'മലയാളം',        speech: 'ml-IN',       whisper: 'ml' },
  { code: 'mni', label: 'Manipuri (Meitei)',  native: 'মৈতৈলোন্',      speech: null,          whisper: null },
  { code: 'mr',  label: 'Marathi',            native: 'मराठी',         speech: 'mr-IN',       whisper: 'mr' },
  { code: 'ne',  label: 'Nepali',             native: 'नेपाली',        speech: 'ne-NP',       whisper: 'ne' },
  { code: 'or',  label: 'Odia',               native: 'ଓଡ଼ିଆ',         speech: 'or-IN',       whisper: null },
  { code: 'pa',  label: 'Punjabi',            native: 'ਪੰਜਾਬੀ',        speech: 'pa-Guru-IN',  whisper: 'pa' },
  { code: 'sa',  label: 'Sanskrit',           native: 'संस्कृतम्',     speech: 'sa-IN',       whisper: 'sa' },
  { code: 'sat', label: 'Santali',            native: 'ᱥᱟᱱᱛᱟᱲᱤ',       speech: null,          whisper: null },
  { code: 'sd',  label: 'Sindhi',             native: 'سنڌي',          speech: null,          whisper: 'sd' },
  { code: 'ta',  label: 'Tamil',              native: 'தமிழ்',         speech: 'ta-IN',       whisper: 'ta' },
  { code: 'te',  label: 'Telugu',             native: 'తెలుగు',        speech: 'te-IN',       whisper: 'te' },
  { code: 'ur',  label: 'Urdu',               native: 'اردو',          speech: 'ur-IN',       whisper: 'ur' },
];

export const getLanguage = (code) => LANGUAGES.find(l => l.code === code) || LANGUAGES[0];

export const getSpeechRecognition = () =>
  typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;
