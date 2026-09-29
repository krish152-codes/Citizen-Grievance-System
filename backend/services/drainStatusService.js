/**
 * Drain Status Service
 * ────────────────────
 * Single source of truth for turning raw sensor numbers into the status
 * labels the UI shows (NORMAL/WARNING/HIGH/CRITICAL, etc). Every threshold
 * comes from the drain's own `thresholds` document — nothing here is a
 * universal physical constant. Keeping this logic in one backend module
 * (rather than duplicated in frontend components) is what keeps alerts
 * consistent across every client.
 */

// ── Water level status, precedence: CRITICAL > HIGH > WARNING > NORMAL ──
function computeWaterStatus(waterDepthCm, thresholds) {
  if (waterDepthCm == null || Number.isNaN(waterDepthCm)) return 'NORMAL';
  if (waterDepthCm >= thresholds.criticalCm) return 'CRITICAL';
  if (waterDepthCm >= thresholds.highCm) return 'HIGH';
  if (waterDepthCm >= thresholds.warningCm) return 'WARNING';
  return 'NORMAL';
}

// Rapid rise can fire even before the absolute critical threshold is reached.
function computeRapidRise(currentDepthCm, previousDepthCm, minutesElapsed, thresholds) {
  if (previousDepthCm == null || !minutesElapsed || minutesElapsed <= 0) return false;
  const rateCmPerMin = (currentDepthCm - previousDepthCm) / minutesElapsed;
  return rateCmPerMin >= thresholds.rapidRiseCmPerMin;
}

function computeGasStatus(signal, alertThreshold) {
  if (signal == null || Number.isNaN(signal)) return 'NORMAL';
  return signal >= alertThreshold ? 'ALERT' : 'NORMAL';
}

function computeO2Status(o2Percent, lowThreshold, installed) {
  if (!installed || o2Percent == null) return 'NOT_INSTALLED';
  return o2Percent <= lowThreshold ? 'LOW' : 'NORMAL';
}

function computeAtmosphereStatus({ ch4Status, h2sStatus, o2Status }) {
  if (ch4Status === 'ALERT' || h2sStatus === 'ALERT' || o2Status === 'LOW') return 'ALERT';
  return 'NORMAL';
}

function computeDeviceStatus(lastSeenAt, offlineTimeoutMin) {
  if (!lastSeenAt) return 'OFFLINE';
  const minutesSince = (Date.now() - new Date(lastSeenAt).getTime()) / 60000;
  return minutesSince <= offlineTimeoutMin ? 'ONLINE' : 'OFFLINE';
}

/**
 * Given a new raw reading + the drain's thresholds + the previous reading
 * (for rate-of-change), compute every derived status field in one place.
 */
function evaluateReading({ raw, thresholds, previousReading, o2Installed }) {
  const waterStatus = computeWaterStatus(raw.waterDepthCm, thresholds);

  let minutesElapsed = null;
  if (previousReading?.timestamp) {
    minutesElapsed = (new Date(raw.timestamp) - new Date(previousReading.timestamp)) / 60000;
  }
  const rapidRise = computeRapidRise(raw.waterDepthCm, previousReading?.waterDepthCm, minutesElapsed, thresholds);

  const ch4Status = computeGasStatus(raw.ch4Signal, thresholds.ch4AlertSignal);
  const h2sStatus = computeGasStatus(raw.h2sSignal, thresholds.h2sAlertSignal);
  const o2Status  = computeO2Status(raw.o2Percent, thresholds.o2LowPercent, o2Installed);
  const atmosphereStatus = computeAtmosphereStatus({ ch4Status, h2sStatus, o2Status });

  return {
    ...raw,
    waterStatus,
    rapidRise,
    ch4Status,
    h2sStatus,
    o2Status,
    atmosphereStatus,
    deviceStatus: 'ONLINE', // the reading itself proves the device just reported in
  };
}

/**
 * Decide which alerts (if any) a freshly-evaluated reading should raise.
 * Returns an array of { type, severity, message, currentValues } — the
 * caller (drainController) is responsible for de-duplicating against
 * already-open alerts of the same type before inserting.
 */
function deriveAlerts(drain, evaluated) {
  const alerts = [];
  const loc = drain.name ? `${drain.name} (${drain.deviceId})` : drain.deviceId;

  if (evaluated.waterStatus === 'CRITICAL') {
    alerts.push({
      type: 'WATER_CRITICAL',
      severity: 'critical',
      message: `${loc}: water depth ${evaluated.waterDepthCm} cm has crossed the critical threshold (${drain.thresholds.criticalCm} cm).`,
      currentValues: { waterDepthCm: evaluated.waterDepthCm, threshold: drain.thresholds.criticalCm },
    });
  } else if (evaluated.waterStatus === 'HIGH') {
    alerts.push({
      type: 'WATER_HIGH',
      severity: 'high',
      message: `${loc}: water depth ${evaluated.waterDepthCm} cm has crossed the high threshold (${drain.thresholds.highCm} cm).`,
      currentValues: { waterDepthCm: evaluated.waterDepthCm, threshold: drain.thresholds.highCm },
    });
  } else if (evaluated.waterStatus === 'WARNING') {
    alerts.push({
      type: 'WATER_WARNING',
      severity: 'warning',
      message: `${loc}: water depth ${evaluated.waterDepthCm} cm has crossed the warning threshold (${drain.thresholds.warningCm} cm).`,
      currentValues: { waterDepthCm: evaluated.waterDepthCm, threshold: drain.thresholds.warningCm },
    });
  }

  if (evaluated.rapidRise) {
    alerts.push({
      type: 'RAPID_RISE',
      severity: 'high',
      message: `${loc}: water level is rising faster than the configured rate (${drain.thresholds.rapidRiseCmPerMin} cm/min).`,
      currentValues: { waterDepthCm: evaluated.waterDepthCm },
    });
  }

  if (evaluated.ch4Status === 'ALERT') {
    alerts.push({
      type: 'ATMOSPHERE_CH4',
      severity: 'critical',
      message: `${loc}: methane (CH4) signal (${evaluated.ch4Signal}) has crossed the configured alert threshold.`,
      currentValues: { ch4Signal: evaluated.ch4Signal, threshold: drain.thresholds.ch4AlertSignal },
    });
  }
  if (evaluated.h2sStatus === 'ALERT') {
    alerts.push({
      type: 'ATMOSPHERE_H2S',
      severity: 'critical',
      message: `${loc}: hydrogen sulfide (H2S) signal (${evaluated.h2sSignal}) has crossed the configured alert threshold.`,
      currentValues: { h2sSignal: evaluated.h2sSignal, threshold: drain.thresholds.h2sAlertSignal },
    });
  }
  if (evaluated.o2Status === 'LOW') {
    alerts.push({
      type: 'ATMOSPHERE_O2',
      severity: 'critical',
      message: `${loc}: oxygen level (${evaluated.o2Percent}%) is below the configured safe threshold.`,
      currentValues: { o2Percent: evaluated.o2Percent, threshold: drain.thresholds.o2LowPercent },
    });
  }

  return alerts;
}

module.exports = {
  computeWaterStatus,
  computeRapidRise,
  computeGasStatus,
  computeO2Status,
  computeAtmosphereStatus,
  computeDeviceStatus,
  evaluateReading,
  deriveAlerts,
};
