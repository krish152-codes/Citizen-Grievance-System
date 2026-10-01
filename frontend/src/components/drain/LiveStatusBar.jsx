import React, { useState, useEffect } from 'react';

function ago(sec) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

// Shows whether data is actually flowing in, and how fresh it is.
export default function LiveStatusBar({ latest }) {
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(id); }, []);

  const ts = latest?.timestamp ? new Date(latest.timestamp).getTime() : null;

  if (!ts) {
    return (
      <div className="mb-4 flex items-center gap-2 text-sm p-3 rounded-xl bg-slate-100 text-slate-600">
        <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
        Waiting for the first reading — click <b>Connect Arduino</b> below, or start the Arduino bridge on the PC it's plugged into.
      </div>
    );
  }

  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  const state = sec <= 15 ? 'live' : sec <= 120 ? 'delayed' : 'idle';
  const styles = {
    live:    { box: 'bg-green-50 text-green-700',  dot: 'bg-green-500 animate-pulse', text: `LIVE — last reading ${ago(sec)} ago` },
    delayed: { box: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-500',               text: `Data is delayed — last reading ${ago(sec)} ago` },
    idle:    { box: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400',               text: `No new data for ${ago(sec)} — is the Arduino connected / bridge running?` },
  }[state];

  return (
    <div className={`mb-4 flex items-center gap-2 text-sm font-semibold p-3 rounded-xl ${styles.box}`}>
      <span className={`w-2.5 h-2.5 rounded-full ${styles.dot}`} />
      {styles.text}
    </div>
  );
}
