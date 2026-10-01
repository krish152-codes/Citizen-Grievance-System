// Core logic for the Arduino → SheharSetu bridge (kept separate from the serial
// port so it can be tested without hardware).

const num = (v) => (v == null || Number.isNaN(Number(v)) ? undefined : Number(v));
const adcToUnit = (v) => {
  const n = num(v);
  return n === undefined ? undefined : Math.min(1, Math.max(0, n / 1023));
};

// One JSON object per line, e.g. {"device_id":"DR-001","water_depth_cm":149.1,...}
function parseLine(line) {
  const start = line.indexOf('{');
  const end = line.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(line.slice(start, end + 1)); } catch { return null; }
}

// Arduino snake_case → payload for POST /api/drains/:id/readings.
// MQ gas sensors send raw 0–1023 ADC values; the backend expects 0–1.
function toReading(d) {
  const waterDepthCm = num(d.water_depth_cm);
  if (waterDepthCm === undefined) return null;
  return {
    waterDistanceCm: num(d.water_distance_cm),
    waterDepthCm,
    waterFillPct: num(d.water_fill_pct),
    rainWetness: d.rain_wetness === 'DETECTED' ? 'DETECTED' : 'NOT_DETECTED',
    ch4Signal: adcToUnit(d.ch4_signal),
    h2sSignal: adcToUnit(d.h2s_signal),
  };
}

function createProcessor({ apiBase, deviceKey = '', drainId = '', postEveryMs = 2000, fetchImpl = fetch, log = console.log, now = Date.now }) {
  const base = apiBase.replace(/\/+$/, '');
  const drainCache = new Map(); // DEVICE_ID → drain _id
  let lastPostAt = -Infinity;
  let inFlight = false;
  const stats = { lines: 0, parsed: 0, saved: 0, failed: 0 };

  const headers = { 'Content-Type': 'application/json', ...(deviceKey ? { 'x-device-key': deviceKey } : {}) };

  async function resolveDrainId(deviceId) {
    if (drainId) return drainId;
    const key = String(deviceId || '').toUpperCase();
    if (drainCache.has(key)) return drainCache.get(key);
    const res = await fetchImpl(`${base}/drains`, { headers });
    if (!res.ok) throw new Error(`Could not list drains (HTTP ${res.status})`);
    const { drains = [] } = await res.json();
    const found = drains.find((d) => String(d.deviceId).toUpperCase() === key);
    if (!found) {
      throw new Error(`No drain with Device ID "${key}" exists in the app. Add it under Drains → Add Drain (or set DRAIN_ID).`);
    }
    drainCache.set(key, found._id);
    return found._id;
  }

  async function handleLine(rawLine) {
    const line = rawLine.trim();
    if (!line) return;
    stats.lines += 1;

    const data = parseLine(line);
    if (!data) return; // boot messages / partial line
    stats.parsed += 1;

    const payload = toReading(data);
    if (!payload) { log(`⚠ Ignored a line without water_depth_cm: ${line.slice(0, 80)}`); return; }

    if (inFlight || now() - lastPostAt < postEveryMs) return; // throttle
    inFlight = true; lastPostAt = now();
    try {
      const id = await resolveDrainId(data.device_id);
      const res = await fetchImpl(`${base}/drains/${id}/readings`, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 404) drainCache.clear();
        throw new Error(`HTTP ${res.status} ${body.message || ''}`.trim());
      }
      stats.saved += 1;
      log(`✔ ${String(data.device_id || 'device')} saved · depth ${payload.waterDepthCm.toFixed(1)} cm · fill ${Math.round(payload.waterFillPct ?? 0)}% · CH4 ${(payload.ch4Signal ?? 0).toFixed(2)} · H2S ${(payload.h2sSignal ?? 0).toFixed(2)} · rain ${payload.rainWetness}`);
    } catch (err) {
      stats.failed += 1;
      lastPostAt = now() - postEveryMs + 5000; // wait ~5 s before retrying after a failure
      log(`✖ Could not send reading: ${err.message}`);
    } finally {
      inFlight = false;
    }
  }

  return { handleLine, stats, parseLine, toReading };
}

module.exports = { parseLine, toReading, createProcessor };
