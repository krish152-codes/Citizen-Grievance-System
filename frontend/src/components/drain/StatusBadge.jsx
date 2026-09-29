import React from 'react';
import {
  WATER_STATUS_CONFIG,
  ATMOSPHERE_STATUS_CONFIG,
  DEVICE_STATUS_CONFIG,
  ALERT_SEVERITY_CONFIG,
  ALERT_STATUS_CONFIG,
  INCIDENT_STATUS_CONFIG,
  DRAIN_ECHO_CLASS_CONFIG,
  AUDIO_QUALITY_CONFIG,
} from '../../utils/helpers';

const CONFIG_MAP = {
  water: WATER_STATUS_CONFIG,
  atmosphere: ATMOSPHERE_STATUS_CONFIG,
  device: DEVICE_STATUS_CONFIG,
  severity: ALERT_SEVERITY_CONFIG,
  alertStatus: ALERT_STATUS_CONFIG,
  incident: INCIDENT_STATUS_CONFIG,
  drainEchoClass: DRAIN_ECHO_CLASS_CONFIG,
  audioQuality: AUDIO_QUALITY_CONFIG,
};

/**
 * <StatusBadge kind="water" status="CRITICAL" />
 * Status is always communicated as text + color + a dot — never color alone,
 * so the UI stays legible without relying on color perception.
 */
export default function StatusBadge({ kind, status, className = '', size = 'md' }) {
  const config = CONFIG_MAP[kind]?.[status] || { label: status || 'Unknown', color: 'bg-slate-100 text-slate-500' };
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`badge inline-flex items-center gap-1.5 font-bold ${sizeClasses} ${config.color} ${className}`}>
      {config.dot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
      {config.icon && <span>{config.icon}</span>}
      {config.label}
    </span>
  );
}
