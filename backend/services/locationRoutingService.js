/**
 * Location Routing Service
 * ────────────────────────
 * No real geocoding/reverse-geocoding API key is configured in this
 * environment, so ward/zone resolution uses nearest-centroid matching
 * against a small configurable list — clearly a demo approximation, not
 * real municipal ward boundary data (see spec §34: "do not hard-code real
 * ward boundaries without actual configured data"). Swap `WARD_CENTROIDS`
 * for a real boundary/geocoding lookup when one is available; nothing else
 * in the app needs to change since callers only see `{ ward, zone }`.
 */
const Department = require('../models/Department');
const Drain = require('../models/Drain');

// Indore-area demo ward centroids — matches the wards already used by the
// Smart Drain Monitoring demo data (backend/utils/seedDrains.js) so the two
// modules tell a consistent story in a demo.
const WARD_CENTROIDS = [
  { ward: 'Ward 3',  zone: 'North Zone',    lat: 22.7460, lng: 75.8930 },
  { ward: 'Ward 4',  zone: 'Central Zone',  lat: 22.7196, lng: 75.8577 },
  { ward: 'Ward 7',  zone: 'Central Zone',  lat: 22.7180, lng: 75.8450 },
  { ward: 'Ward 12', zone: 'Central Zone',  lat: 22.7245, lng: 75.8650 },
  { ward: 'Ward 15', zone: 'South Zone',    lat: 22.6980, lng: 75.8720 },
];
const MAX_WARD_DISTANCE_DEG = 0.08; // ~9km — beyond this we report low confidence rather than guess
const MAX_DRAIN_DISTANCE_DEG = 0.01; // ~1.1km — "nearby" for drain cross-linking (spec §62–64)

const DRAIN_RELATED_CATEGORIES = ['water']; // maps to aiService's category taxonomy

function haversineApprox(lat1, lng1, lat2, lng2) {
  // Flat-earth approximation — fine at city scale for nearest-match ranking.
  return Math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2);
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {{ ward: string, zone: string, confident: boolean }}
 */
function resolveWard(lat, lng) {
  if (lat == null || lng == null) return { ward: '', zone: '', confident: false };

  let best = null;
  let bestDist = Infinity;
  for (const c of WARD_CENTROIDS) {
    const d = haversineApprox(lat, lng, c.lat, c.lng);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  if (!best || bestDist > MAX_WARD_DISTANCE_DEG) return { ward: '', zone: '', confident: false };
  return { ward: best.ward, zone: best.zone, confident: true };
}

/**
 * Resolve the municipal department for a category. Uses the existing
 * Department collection (category + city) as an enrichment lookup when a
 * matching active department exists; otherwise falls back to the same
 * category→department-name mapping the existing web report flow already
 * uses (aiService.DEPARTMENT_MAP, returned as `aiResult.department`), so
 * behavior never regresses to "no department" (spec §33: backend-controlled,
 * never invented by the LLM).
 * @param {string} category
 * @param {string} fallbackDepartmentName — aiResult.department from aiService
 */
async function resolveDepartment(category, fallbackDepartmentName) {
  try {
    const city = process.env.MUNICIPAL_CITY || 'Indore';
    const dept = await Department.findOne({ category, city, isActive: true });
    if (dept) return { name: dept.name, departmentId: dept._id, email: dept.email };
  } catch (_) { /* Department lookup is enrichment-only — never block routing on it */ }
  return { name: fallbackDepartmentName || 'Municipal Corporation', departmentId: null, email: null };
}

/**
 * If the complaint looks drainage-related and a monitored drain exists
 * close to the given coordinates, return it as supporting sensor context —
 * never as confirmation of the citizen's report (spec §62, §122).
 */
async function findNearbyDrain(category, lat, lng) {
  if (!DRAIN_RELATED_CATEGORIES.includes(category) || lat == null || lng == null) return null;
  try {
    const drains = await Drain.find({ isActive: true, 'location.lat': { $exists: true }, 'location.lng': { $exists: true } })
      .select('deviceId name ward location latest')
      .lean();
    let best = null;
    let bestDist = Infinity;
    for (const d of drains) {
      const dist = haversineApprox(lat, lng, d.location.lat, d.location.lng);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    if (best && bestDist <= MAX_DRAIN_DISTANCE_DEG) return best;
  } catch (_) { /* non-critical enrichment */ }
  return null;
}

module.exports = { resolveWard, resolveDepartment, findNearbyDrain, WARD_CENTROIDS };
