import React, { useState, useRef, useEffect, useCallback } from 'react';
import { drainsAPI } from '../../services/api';
import { isSerialSupported, openSerial, getGrantedPorts, parseDeviceLine, toReading } from '../../services/arduinoSerial';

const POST_EVERY_MS = 2000; // Arduino prints ~1/s; save one reading every 2 s

export default function ArduinoConnect({ drain, onPosted }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | error
  const [error, setError] = useState('');
  const [live, setLive] = useState(null);
  const [counts, setCounts] = useState({ heard: 0, valid: 0, saved: 0, failed: 0 });
  const [lastRaw, setLastRaw] = useState('');
  const [silentWarn, setSilentWarn] = useState(false);
  const connRef = useRef(null);
  const lastPostRef = useRef(0);
  const drainRef = useRef(drain);
  const heardRef = useRef(0);
  const autoTriedRef = useRef(false);
  drainRef.current = drain;

  const bump = (key) => setCounts((c) => ({ ...c, [key]: c[key] + 1 }));

  const handleLine = useCallback(async (line) => {
    heardRef.current += 1;
    bump('heard');
    setLastRaw(line.slice(0, 140));

    const data = parseDeviceLine(line);
    if (!data) return;
    bump('valid');
    setLive(data);

    const payload = toReading(data);
    if (!payload) return;
    const now = Date.now();
    if (now - lastPostRef.current < POST_EVERY_MS) return;
    lastPostRef.current = now;

    try {
      await drainsAPI.ingestReading(drainRef.current._id, payload);
      bump('saved');
      setError('');
      onPosted?.();
    } catch (err) {
      bump('failed');
      const code = err.response?.status;
      setError(
        code === 401 ? 'Server rejected the reading (401). Log in again, or check DEVICE_INGEST_KEY on the backend.'
        : code === 404 ? 'This drain no longer exists on the server (404).'
        : err.response?.data?.message || 'Could not reach the server — is the backend running and VITE_API_BASE_URL correct?'
      );
    }
  }, [onPosted]);

  const connect = useCallback(async (existingPort) => {
    setStatus('connecting'); setError(''); setSilentWarn(false);
    setCounts({ heard: 0, valid: 0, saved: 0, failed: 0 });
    heardRef.current = 0;
    try {
      connRef.current = await openSerial({
        baudRate: 9600,
        port: existingPort,
        onLine: handleLine,
        onError: (e) => { setError(e.message); setStatus('error'); },
        onClose: () => { setStatus('idle'); setError('Connection closed — was the Arduino unplugged?'); },
      });
      setStatus('connected');
    } catch (err) {
      setStatus('idle');
      if (err.name === 'NotFoundError') return; // user closed the port picker
      setError(
        /open|busy|access|InvalidState|locked/i.test(`${err.name} ${err.message}`)
          ? 'Port is busy — close the Arduino IDE Serial Monitor (and any other program using COM8), then click Connect again.'
          : err.message
      );
      setStatus('error');
    }
  }, [handleLine]);

  const disconnect = async () => {
    await connRef.current?.close();
    connRef.current = null;
    setStatus('idle');
  };

  // If this site was already allowed to use the Arduino's port, reconnect automatically (no picker)
  useEffect(() => {
    if (!isSerialSupported() || autoTriedRef.current) return;
    autoTriedRef.current = true;
    getGrantedPorts().then((ports) => { if (ports.length === 1) connect(ports[0]); });
  }, [connect]);

  // Connected but nothing heard for 6 s → tell the user what to check
  useEffect(() => {
    if (status !== 'connected') return undefined;
    const id = setTimeout(() => { if (heardRef.current === 0) setSilentWarn(true); }, 6000);
    return () => clearTimeout(id);
  }, [status]);

  useEffect(() => () => { connRef.current?.close(); }, []);

  if (!isSerialSupported()) {
    return (
      <div className="card p-4 mb-6 text-sm text-slate-600">
        🔌 Live Arduino connection from this page needs Chrome or Edge (Web Serial isn't available in this browser).
        You can still stream data with the Arduino bridge program — see <code>arduino-bridge/README.md</code>.
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
            {connected ? 'Connected — streaming from the Arduino' : 'Plug in the Arduino, close the Serial Monitor, then connect.'}
          </p>
        </div>
        {connected
          ? <button onClick={disconnect} className="btn-secondary text-sm">Disconnect</button>
          : <button onClick={() => connect()} disabled={status === 'connecting'} className="btn-primary text-sm">
              {status === 'connecting' ? 'Connecting…' : '🔌 Connect Arduino'}
            </button>}
      </div>

      {connected && (
        <div className="grid grid-cols-4 gap-2 mt-4 text-center text-xs">
          {[['Lines heard', counts.heard], ['Valid data', counts.valid], ['Saved', counts.saved], ['Failed', counts.failed]].map(([k, v]) => (
            <div key={k} className={`p-2 rounded-lg ${k === 'Failed' && v > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{k}</p>
              <p className={`font-bold ${k === 'Failed' && v > 0 ? 'text-red-600' : 'text-slate-800'}`}>{v}</p>
            </div>
          ))}
        </div>
      )}

      {silentWarn && counts.heard === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3 mt-3">
          Connected, but nothing has arrived yet. Check that the Arduino sketch is running and its baud rate is <b>9600</b>,
          press the board's reset button, and make sure it's printing the JSON lines you see in the Serial Monitor.
        </p>
      )}
      {connected && counts.heard > 3 && counts.valid === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3 mt-3">
          Data is arriving but isn't in the expected JSON format. Last line received: <code className="break-all">{lastRaw}</code>
        </p>
      )}
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
