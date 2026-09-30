import React, { useState, useRef, useEffect, useCallback } from 'react';
import { drainsAPI } from '../../services/api';
import { isSerialSupported, openSerial, parseDeviceLine, toReading } from '../../services/arduinoSerial';

const POST_EVERY_MS = 5000; // Arduino prints ~1/s; we store one reading per 5 s

export default function ArduinoConnect({ drain, onPosted }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | error
  const [error, setError] = useState('');
  const [live, setLive] = useState(null);
  const [sent, setSent] = useState(0);
  const connRef = useRef(null);
  const lastPostRef = useRef(0);
  const drainRef = useRef(drain);
  drainRef.current = drain;

  const handleLine = useCallback(async (line) => {
    const data = parseDeviceLine(line);
    if (!data) return;
    setLive(data);

    const now = Date.now();
    if (now - lastPostRef.current < POST_EVERY_MS) return;
    const payload = toReading(data);
    if (!payload) return;
    lastPostRef.current = now;

    try {
      await drainsAPI.ingestReading(drainRef.current._id, payload);
      setSent((n) => n + 1);
      setError('');
      onPosted?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send reading to the server.');
    }
  }, [onPosted]);

  const connect = async () => {
    setStatus('connecting'); setError('');
    try {
      connRef.current = await openSerial({
        baudRate: 9600,
        onLine: handleLine,
        onError: (e) => { setError(e.message); setStatus('error'); },
        onClose: () => setStatus('idle'),
      });
      setStatus('connected');
    } catch (err) {
      // User closing the port picker is not an error worth showing.
      setStatus('idle');
      if (err.name !== 'NotFoundError') {
        setError(err.name === 'InvalidStateError' || /open|busy|access/i.test(err.message)
          ? 'Port is busy — close the Arduino IDE Serial Monitor and try again.'
          : err.message);
        setStatus('error');
      }
    }
  };

  const disconnect = async () => {
    await connRef.current?.close();
    connRef.current = null;
    setStatus('idle');
  };

  useEffect(() => () => { connRef.current?.close(); }, []);

  if (!isSerialSupported()) {
    return (
      <div className="card p-4 mb-6 text-sm text-slate-600">
        🔌 Live Arduino connection needs Chrome or Edge (Web Serial is not available in this browser).
      </div>
    );
  }

  const mismatch = live?.device_id && live.device_id.toUpperCase() !== drain.deviceId;
  const connected = status === 'connected';

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Hardware (USB)</p>
          <p className="text-sm text-slate-600">
            {connected ? `Streaming from Arduino · ${sent} readings saved` : 'Connect the Arduino to stream real sensor data into this drain.'}
          </p>
        </div>
        {connected
          ? <button onClick={disconnect} className="btn-secondary text-sm">Disconnect</button>
          : <button onClick={connect} disabled={status === 'connecting'} className="btn-primary text-sm">
              {status === 'connecting' ? 'Connecting…' : '🔌 Connect Arduino'}
            </button>}
      </div>

      {mismatch && (
        <p className="text-xs text-amber-700 mt-3">
          ⚠️ The Arduino reports device <b>{live.device_id}</b> but you are viewing <b>{drain.deviceId}</b>. Readings are being saved to this drain.
        </p>
      )}
      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

      {connected && live && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-4 text-xs">
          {[
            ['Depth', `${Number(live.water_depth_cm).toFixed(1)} cm`],
            ['Fill', `${Number(live.water_fill_pct).toFixed(0)}%`],
            ['Water', live.water_status],
            ['Rain', live.rain_wetness],
            ['CH₄ raw', live.ch4_signal],
            ['H₂S raw', live.h2s_signal],
          ].map(([k, v]) => (
            <div key={k} className="p-2 bg-slate-50 rounded-lg">
              <p className="text-[10px] font-bold text-slate-400 uppercase">{k}</p>
              <p className="font-bold text-slate-800">{v ?? '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
