import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import { timeAgo } from '../../utils/helpers';

const TYPE_LABELS = {
  WATER_WARNING: 'Water Level — Warning',
  WATER_HIGH: 'Water Level — High',
  WATER_CRITICAL: 'Water Level — Critical',
  RAPID_RISE: 'Rapid Rise Detected',
  ATMOSPHERE_CH4: 'Atmosphere — Methane (CH₄)',
  ATMOSPHERE_H2S: 'Atmosphere — Hydrogen Sulfide (H₂S)',
  ATMOSPHERE_O2: 'Atmosphere — Low Oxygen (O₂)',
  DEVICE_OFFLINE: 'Device Offline',
  SENSOR_FAULT: 'Sensor Fault',
};

export default function AlertCard({ alert, onAcknowledge, onAssign, onViewDrain, onCreateIncident, busy }) {
  const [assigning, setAssigning] = useState(false);
  const [team, setTeam] = useState('');

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge kind="severity" status={alert.severity} />
          <StatusBadge kind="alertStatus" status={alert.status} size="sm" />
          <span className="text-sm font-bold text-slate-800">{TYPE_LABELS[alert.type] || alert.type}</span>
        </div>
        <span className="text-[11px] text-slate-400 flex-shrink-0">{timeAgo(alert.createdAt)}</span>
      </div>

      <p className="text-sm text-slate-600 mb-2">{alert.message}</p>

      <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
        <span className="font-semibold text-slate-600">{alert.drain?.name || alert.deviceId}</span>
        {alert.drain?.ward && <span>· {alert.drain.ward}</span>}
        {alert.assignedTeam && <span>· Assigned: {alert.assignedTeam}</span>}
      </div>

      {assigning && (
        <div className="flex items-center gap-2 mb-3">
          <input
            className="input-field text-sm py-1.5 flex-1"
            placeholder="Team name (e.g. Zone 3 Rapid Response)"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          />
          <button
            className="btn-primary text-xs py-1.5 px-3"
            disabled={!team.trim() || busy}
            onClick={() => { onAssign(alert._id, team.trim()); setAssigning(false); setTeam(''); }}
          >
            Confirm
          </button>
          <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => setAssigning(false)}>Cancel</button>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {alert.status === 'unacknowledged' && (
          <button disabled={busy} onClick={() => onAcknowledge(alert._id)} className="btn-secondary text-xs py-1.5 px-3">
            Acknowledge
          </button>
        )}
        {!assigning && alert.status !== 'resolved' && (
          <button disabled={busy} onClick={() => setAssigning(true)} className="btn-secondary text-xs py-1.5 px-3">
            {alert.assignedTeam ? 'Reassign' : 'Assign Team'}
          </button>
        )}
        <button onClick={() => onViewDrain(alert.drain?._id || alert.drain)} className="btn-secondary text-xs py-1.5 px-3">
          View Drain
        </button>
        <button onClick={() => onCreateIncident(alert)} className="btn-primary text-xs py-1.5 px-3">
          Create Incident
        </button>
      </div>
    </div>
  );
}
