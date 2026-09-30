// Web Serial helper for the Smart Drain prototype (Arduino → browser).
// Works in Chrome / Edge on https:// or http://localhost only.

export const isSerialSupported = () =>
  typeof navigator !== 'undefined' && 'serial' in navigator;

// The sketch prints one JSON object per line, e.g.
// {"device_id":"DR-001","water_depth_cm":149.1,...,"ch4_signal":627,...}
export function parseDeviceLine(line) {
  const start = line.indexOf('{');
  const end = line.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(line.slice(start, end + 1));
  } catch {
    return null; // partial / garbled line — ignore
  }
}

const num = (v) => (v == null || Number.isNaN(Number(v)) ? undefined : Number(v));
// MQ sensors give a raw 10-bit ADC value (0–1023). The backend thresholds are
// normalised 0–1, so convert here.
const adcToUnit = (v) => {
  const n = num(v);
  return n === undefined ? undefined : Math.min(1, Math.max(0, n / 1023));
};

// Arduino snake_case JSON → payload for POST /api/drains/:id/readings
export function toReading(d) {
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

export async function openSerial({ baudRate = 9600, onLine, onError, onClose }) {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate });

  const decoder = new TextDecoderStream();
  const piped = port.readable.pipeTo(decoder.writable).catch(() => {});
  const reader = decoder.readable.getReader();
  let stopped = false;

  (async () => {
    let buf = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split(/\r?\n/);
        buf = lines.pop();
        if (buf.length > 4096) buf = '';
        lines.forEach((l) => l.trim() && onLine(l.trim()));
      }
    } catch (err) {
      if (!stopped) onError?.(err);
    } finally {
      try { reader.releaseLock(); } catch { /* already released */ }
      if (!stopped) onClose?.();
    }
  })();

  return {
    close: async () => {
      stopped = true;
      await reader.cancel().catch(() => {});
      await piped;
      await port.close().catch(() => {});
    },
  };
}
