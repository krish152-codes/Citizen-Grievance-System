import React, { useState, useRef, useEffect, useCallback } from 'react';
import AudioWaveform from './AudioWaveform';

const TARGET_TAPS = 3;
const MAX_DURATION_SEC = 3.5;
const TAP_THRESHOLD = 45;      // deviation from the 128 baseline that counts as a "hit"
const TAP_REFRACTORY_MS = 180; // minimum gap between counted taps

const STEPS = [
  { title: 'Stand at the designated safe position.', detail: 'Stay clear of traffic and do not step onto the drain cover itself.' },
  { title: 'Keep your phone microphone unobstructed.', detail: "Hold the phone a comfortable distance from the drain, mic facing down." },
  { title: 'Tap the drain cover three times.', detail: 'Firm, evenly-spaced taps work best.' },
  { title: 'Remain still while recording completes.', detail: 'The recording lasts about 3 seconds.' },
];

function pickMimeType() {
  const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const type of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type;
  }
  return '';
}

export default function DrainEchoRecorder({ onComplete, onCancel }) {
  const [phase, setPhase] = useState('instructions'); // instructions | recording | review | error
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [noisy, setNoisy] = useState(false);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const tapCountRef = useRef(0);
  const timerRef = useRef(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close();
    audioCtxRef.current = null;
    cancelAnimationFrame(rafRef.current);
    clearInterval(timerRef.current);
  }, []);

  useEffect(() => () => cleanupStream(), [cleanupStream]);

  const monitorTaps = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);

    const check = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        peak = Math.max(peak, Math.abs(data[i] - 128));
      }
      const now = performance.now();
      if (peak > TAP_THRESHOLD && now - lastTapAtRef.current > TAP_REFRACTORY_MS) {
        lastTapAtRef.current = now;
        tapCountRef.current += 1;
        setTapCount(tapCountRef.current);
        if (tapCountRef.current > TARGET_TAPS + 3) setNoisy(true);
      }
      rafRef.current = requestAnimationFrame(check);
    };
    check();
  };

  const startRecording = async () => {
    setErrorMsg('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('error');
      setErrorMsg('This browser does not support microphone recording. Try a recent Chrome, Safari, or Edge.');
      return;
    }
    if (!window.MediaRecorder) {
      setPhase('error');
      setErrorMsg('Audio recording (MediaRecorder) is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      tapCountRef.current = 0;
      lastTapAtRef.current = 0;
      setTapCount(0);
      setNoisy(false);
      setElapsed(0);

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const duration = (performance.now() - startTimeRef.current) / 1000;
        setRecordedBlob(blob);
        setRecordedDuration(parseFloat(duration.toFixed(2)));
        setPhase('review');
        cleanupStream();
      };

      startTimeRef.current = performance.now();
      recorder.start();
      setPhase('recording');
      monitorTaps();

      timerRef.current = setInterval(() => {
        const secs = (performance.now() - startTimeRef.current) / 1000;
        setElapsed(secs);
        if (secs >= MAX_DURATION_SEC) {
          clearInterval(timerRef.current);
          if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
        }
      }, 50);
    } catch (err) {
      setPhase('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone permission denied. Please allow microphone access and try again.');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No microphone was found on this device.');
      } else {
        setErrorMsg('Could not start recording: ' + err.message);
      }
      cleanupStream();
    }
  };

  const stopEarly = () => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const retry = () => {
    setRecordedBlob(null);
    setPhase('instructions');
  };

  const submit = () => {
    onComplete({ blob: recordedBlob, durationSec: recordedDuration, tapCount: tapCountRef.current, clientReportedNoisy: noisy });
  };

  // ── Instructions ──────────────────────────────────────
  if (phase === 'instructions') {
    return (
      <div className="card p-6">
        <h3 className="font-display font-bold text-lg text-slate-900 mb-1">Recording Instructions</h3>
        <p className="text-sm text-slate-500 mb-5">Do not open or enter the drain. Follow municipal safety procedures at all times.</p>
        <div className="space-y-3 mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                <p className="text-xs text-slate-500">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button onClick={startRecording} className="btn-primary flex-1">Start Recording</button>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="card p-6 text-center">
        <span className="text-3xl block mb-2">🎙️</span>
        <h3 className="font-display font-bold text-lg text-slate-900 mb-1">Recording Unavailable</h3>
        <p className="text-sm text-slate-500 mb-5">{errorMsg}</p>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => setPhase('instructions')} className="btn-primary flex-1">Try Again</button>
        </div>
      </div>
    );
  }

  // ── Recording ─────────────────────────────────────────
  if (phase === 'recording') {
    const dots = Array.from({ length: TARGET_TAPS }, (_, i) => i < Math.min(tapCount, TARGET_TAPS));
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Recording</span>
        </div>
        <p className="text-center font-display text-2xl font-bold text-slate-900 mb-4">
          00:{elapsed.toFixed(1).padStart(4, '0')} / 00:{MAX_DURATION_SEC.toFixed(1)}
        </p>

        <AudioWaveform mode="live" analyser={analyserRef.current} />

        <div className="flex items-center justify-center gap-2 mt-4 mb-1">
          {dots.map((filled, i) => (
            <span key={i} className={`w-3 h-3 rounded-full ${filled ? 'bg-brand-600' : 'bg-slate-200'}`} />
          ))}
        </div>
        <p className="text-center text-xs text-slate-500 mb-5">
          {Math.min(tapCount, TARGET_TAPS)} / {TARGET_TAPS} taps detected
          {tapCount > TARGET_TAPS && <span className="text-amber-600"> — extra taps or noise detected</span>}
        </p>

        <button onClick={stopEarly} className="btn-secondary w-full text-sm">
          I've tapped 3 times — stop now
        </button>
      </div>
    );
  }

  // ── Review ────────────────────────────────────────────
  return (
    <div className="card p-6">
      <h3 className="font-display font-bold text-lg text-slate-900 mb-1">Review Recording</h3>
      <p className="text-sm text-slate-500 mb-4">
        {Math.min(tapCountRef.current, TARGET_TAPS)} of {TARGET_TAPS} taps detected · {recordedDuration.toFixed(1)}s recorded
      </p>

      <AudioWaveform mode="playback" audioBlob={recordedBlob} />

      {tapCountRef.current === 0 && (
        <p className="text-xs text-amber-600 mt-3">We didn't detect any taps. You can retry, or continue if you're confident the recording captured them.</p>
      )}

      <div className="flex items-center gap-3 mt-5">
        <button onClick={retry} className="btn-secondary flex-1">Retry Recording</button>
        <button onClick={submit} className="btn-primary flex-1">Analyze Recording</button>
      </div>
    </div>
  );
}
