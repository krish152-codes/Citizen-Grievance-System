const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ── Ensure upload directories exist ───────────────────
const uploadsDir   = path.join(__dirname, '../uploads');
const voiceDir     = path.join(__dirname, '../uploads/voice');
const drainEchoDir = path.join(__dirname, '../uploads/drain-echo'); // ← NEW: Drain Echo audio
const proofDir     = path.join(__dirname, '../uploads/proof');      // ← NEW: resolution proof photos
const communityDir = path.join(__dirname, '../uploads/community'); // ← NEW: community work posts
[uploadsDir, voiceDir, drainEchoDir, proofDir, communityDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── Disk storage — images ──────────────────────────────
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `issue-${suffix}${path.extname(file.originalname).toLowerCase()}`);
  },
});

// ── Disk storage — voice ───────────────────────────────
const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, voiceDir),
  filename:    (req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext    = path.extname(file.originalname).toLowerCase() || '.webm';
    cb(null, `voice-${suffix}${ext}`);
  },
});

// ── File filters ───────────────────────────────────────
const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error('Only image files are allowed (jpeg, jpg, png, webp)'));
};

const voiceFilter = (req, file, cb) => {
  const allowedExt  = /webm|mp3|wav|ogg|m4a|aac/;
  const allowedMime = /audio|video\/webm/;
  if (allowedExt.test(path.extname(file.originalname).toLowerCase()) || allowedMime.test(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error('Only audio files are allowed (webm, mp3, wav, ogg)'));
};

// ── Multer instances ───────────────────────────────────
const MAX_FILE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10 MB
const MAX_VOICE = 5 * 1024 * 1024; // 5 MB

const upload = multer({ storage: imageStorage, limits: { fileSize: MAX_FILE }, fileFilter: imageFilter });

const voiceUpload = multer({ storage: voiceStorage, limits: { fileSize: MAX_VOICE }, fileFilter: voiceFilter });

// ── Combined fields uploader ───────────────────────────
// Accepts: images[] (max 8) + voice (1 optional)
const combinedStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'voice') cb(null, voiceDir);
    else                            cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext    = path.extname(file.originalname).toLowerCase() || (file.fieldname === 'voice' ? '.webm' : '.jpg');
    const prefix = file.fieldname === 'voice' ? 'voice' : 'issue';
    cb(null, `${prefix}-${suffix}${ext}`);
  },
});

const combinedFilter = (req, file, cb) => {
  if (file.fieldname === 'images') return imageFilter(req, file, cb);
  if (file.fieldname === 'voice')  return voiceFilter(req, file, cb);
  cb(new Error('Unexpected field'));
};

const combinedUpload = multer({
  storage: combinedStorage,
  limits:  { fileSize: MAX_FILE },
  fileFilter: combinedFilter,
}).fields([
  { name: 'images', maxCount: 8 },
  { name: 'voice',  maxCount: 1 },
]);

// ── Disk storage — Drain Echo diagnostic audio (NEW) ───
// Same constraints as voice notes (short recordings), kept in their own
// folder so Drain Echo evidence is easy to find/manage independently.
const drainEchoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, drainEchoDir),
  filename:    (req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext    = path.extname(file.originalname).toLowerCase() || '.webm';
    cb(null, `echo-${suffix}${ext}`);
  },
});
const MAX_DRAIN_ECHO_AUDIO = 5 * 1024 * 1024; // 5 MB — a ~3s recording is a few hundred KB
const drainEchoUpload = multer({
  storage: drainEchoStorage,
  limits:  { fileSize: MAX_DRAIN_ECHO_AUDIO },
  fileFilter: voiceFilter, // same allowed audio types as voice notes
});

// ── Resolution proof photos (NEW) ──────────────────────
// Up to 3 photos of the completed work, stored in uploads/proof/
const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, proofDir),
  filename:    (req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `proof-${suffix}${path.extname(file.originalname).toLowerCase() || '.jpg'}`);
  },
});
const proofUpload = multer({
  storage: proofStorage,
  limits:  { fileSize: MAX_FILE },
  fileFilter: imageFilter,
}).array('proof', 3);

// ── Community "I fixed this" posts (NEW) ───────────────
// Exactly 2 photos (before / after) per post, stored in uploads/community/
const communityStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, communityDir),
  filename:    (req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `community-${suffix}${path.extname(file.originalname).toLowerCase() || '.jpg'}`);
  },
});
const communityUpload = multer({
  storage: communityStorage,
  limits:  { fileSize: MAX_FILE, files: 2 },
  fileFilter: imageFilter,
}).array('images', 2);

module.exports = upload;
module.exports.communityUpload = communityUpload;
module.exports.proofUpload = proofUpload; // ← NEW
module.exports.voiceUpload     = voiceUpload;
module.exports.combinedUpload  = combinedUpload;
module.exports.drainEchoUpload = drainEchoUpload; // ← NEW
