// Adaptive tap (impulse) detector.
// A fixed threshold fails on real phones/laptops: taps on a drain cover are
// quiet, and rooms differ in background noise. This keeps a running estimate
// of the noise floor and only fires on a clear rise above it.
export function createTapDetector({
  minThreshold = 0.06,   // absolute minimum level (0–1) that can ever count as a tap
  multiplier = 3,        // tap must be this many times louder than the noise floor
  refractoryMs = 220,    // minimum gap between taps (also used to merge mic + button taps)
  floorAlpha = 0.02,     // how fast the noise floor adapts
  warmupMs = 350,        // learn the room noise first; no taps are counted during this time
} = {}) {
  let startedAt = null;
  let floor = 0.01;
  let armed = true;
  let last = -1e9;
  let min = minThreshold;

  const threshold = () => Math.max(min, floor * multiplier);

  return {
    /** level: 0–1 peak amplitude of the latest audio window. Returns true on a new tap. */
    process(level, now) {
      if (startedAt === null) startedAt = now;
      if (now - startedAt < warmupMs) {            // warm-up: calibrate the noise floor quickly
        floor += (level - floor) * 0.3;
        return false;
      }
      const thr = threshold();
      if (level > thr) {
        const fire = armed && now - last > refractoryMs;
        armed = false;
        if (fire) { last = now; return true; }
        return false;
      }
      if (level < thr * 0.6) armed = true;       // re-arm once the sound has decayed
      floor += (level - floor) * floorAlpha;      // learn background noise only between taps
      return false;
    },
    canTap: (now) => now - last > refractoryMs,
    markTap: (now) => { last = now; },
    setMinThreshold: (v) => { min = v; },
    get threshold() { return threshold(); },
    get floor() { return floor; },
    reset() { floor = 0.01; armed = true; last = -1e9; startedAt = null; },
  };
}
