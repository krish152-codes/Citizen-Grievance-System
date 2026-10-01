import React, { useState, useRef, useEffect, useCallback } from 'react';
import AudioWaveform from './AudioWaveform';
import { createTapDetector } from '../../services/tapDetector';

const TARGET_TAPS = 3;
const MAX_DURATION_SEC = 3.5;
// Minimum level (0–1) that can count as a tap. Lower = more sensitive.
const SENSITIVITY = { low: 0.10, medium: 0.06, high: 0.035 };

const STEPS = [
  { title: 'Stand at the designated safe position.', detail: 'Stay clear of traffic and do not step onto the drain cover itself.' },
  { title: 'Keep your phone microphone unobstructed.', detail: 'Hold the phone a comfortable distance from the drain, mic facing down.' },
  { title: 'Tap the drain cover three times.', detail: 'Firm, evenly-spaced taps work best. You can also press the TAP button (or Space bar) each time you tap.' },
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
  const [phase, setPhase] = useState('instructions'); // instructions | testing | recording | review | error
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [manualTaps, setManualTaps] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [noisy, setNoisy] = useState(false);
  const [sensitivity, setSensitivity] = useState('medium');
  const [level, setLevel] = useState(0);        // live mic level 0–1 (for the meter)
  const [flash, setFlash] = useState(false);    // pulses whenever a tap is registered
  const [micLabel, setMicLabel] = useState('');
  const [testSeconds, setTestSeconds] = useState(0);
  const [testTaps, setTestTaps] = useState(0);
  const [, forceRender] = useState(0);          // re-render when the analyser becomes available

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const timerRef = useRef(null);
  const levelTimerRef = useRef(null);
  const flashTimerRef = useRef(null);
  const tapCountRef = useRef(0);
  const manualTapRef = useRef(0);
  const levelRef = useRef(0);
  const modeRef = useRef('idle'); // idle | test | record
  const detectorRef = useRef(createTapDetector({ minThreshold: SENSITIVITY.medium }));

  const stopMonitor = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearInterval(levelTimerRef.current);
    modeRef.current = 'idle';
  }, []);

  const cleanupStream = useCallback(() => {
    stopMonitor();
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, [stopMonitor]);

  useEffect(() => () => { cleanupStream(); clearTimeout(flashTimerRef.current); }, [cleanupStream]);

  // Keep the detector's sensitivity in sync with the selected setting
  useEffect(() => { detectorRef.current.setMinThreshold(SENSITIVITY[sensitivity]); }, [sensitivity]);

  const pulse = () => {
    setFlash(true);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(false), 150);
  };

  // A tap, from the microphone ('auto') or from the TAP button / Space bar ('manual')
  const registerTap = useCallback((source) => {
    const now = performance.now();
    if (source === 'manual') {
      // Pressing the button right as the mic hears the same tap must not count twice
      if (!detectorRef.current.canTap(now)) { pulse(); return; }
      detectorRef.current.markTap(now);
    }
    if (modeRef.current === 'test') {
      setTestTaps((n) => n + 1);
      pulse();
      return;
    }
    if (modeRef.current !== 'record') return;
    tapCountRef.current += 1;
    if (source === 'manual') manualTapRef.current += 1;
    setTapCount(tapCountRef.current);
    setManualTaps(manualTapRef.current);
    if (tapCountRef.current > TARGET_TAPS + 3) setNoisy(true);
    pulse();
    if (navigator.vibrate) navigator.vibrate(25);
  }, []);

  // Reads the mic level every animation frame; counts taps with the adaptive detector
  const startMonitor = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);

    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      levelRef.current = peak;
      const now = performance.now();
      if (detectorRef.current.process(peak, now)) registerTap('auto');
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    levelTimerRef.current = setInterval(() => setLevel(levelRef.current), 60);
  }, [registerTap]);

  // Opens the microphone. Must be called straight from a click so the browser allows audio to start.
  const openMic = async () => {
    setErrorMsg('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPhase('error');
      setErrorMsg(
        window.isSecureContext === false
          ? 'Microphones only work on a secure page. Open this site with https:// (or http://localhost), then try again.'
          : 'This browser does not support microphone recording. Try a recent Chrome, Edge, or Safari.'
      );
      return false;
    }
    if (!window.MediaRecorder) {
      setPhase('error');
      setErrorMsg('Audio recording (MediaRecorder) is not supported in this browser.');
      return false;
    }

    // Create the AudioContext inside the click handler — otherwise Safari/Chrome leave it
    // "suspended" and the waveform stays flat with nothing detected.
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();
    audioCtxRef.current = audioCtx;

    try {
      let stream;
      try {
        // Turn OFF the phone's voice filters: noise-suppression and auto-gain treat a short
        // tap as noise and erase it, which is why taps were not being detected.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
        });
      } catch (err) {
        if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw err;
        }
      }
      streamRef.current = stream;
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048; // ≈43 ms window — long enough that no tap falls between frames
      source.connect(analyser);
      analyserRef.current = analyser;

      setMicLabel(stream.getAudioTracks()[0]?.label || 'Default microphone');
      detectorRef.current.reset();
      detectorRef.current.setMinThreshold(SENSITIVITY[sensitivity]);
      forceRender((n) => n + 1);
      startMonitor();
      return true;
    } catch (err) {
      cleanupStream();
      setPhase('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone permission denied. Click the 🔒 icon in the address bar, allow Microphone, then try again.');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No microphone was found. Plug one in or check that your device input is enabled.');
      } else if (err.name === 'NotReadableError') {
        setErrorMsg('The microphone is busy or blocked. Close other apps using it (Zoom, Teams, etc.) and check Windows Settings → Privacy → Microphone.');
      } else {
        setErrorMsg('Could not start recording: ' + err.message);
      }
      return false;
    }
  };

  // ── Mic test screen ──
  const startTest = async () => {
    setTestTaps(0); setTestSeconds(0); setLevel(0);
    modeRef.current = 'test';
    const ok = await openMic();
    if (!ok) return;
    modeRef.current = 'test';
    setPhase('testing');
    const t0 = performance.now();
    timerRef.current = setInterval(() => setTestSeconds((performance.now() - t0) / 1000), 250);
  };

  // ── Recording (uses the already-open microphone) ──
  const beginRecording = () => {
    clearInterval(timerRef.current);
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    chunksRef.current = [];
    tapCountRef.current = 0;
    manualTapRef.current = 0;
    setTapCount(0); setManualTaps(0); setNoisy(false); setElapsed(0);

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
    modeRef.current = 'record';
    recorder.start();
    setPhase('recording');

    timerRef.current = setInterval(() => {
      const secs = (performance.now() - startTimeRef.current) / 1000;
      setElapsed(secs);
      if (secs >= MAX_DURATION_SEC) {
        clearInterval(timerRef.current);
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      }
    }, 50);
  };

  const startRecording = async () => {
    modeRef.current = 'record';
    const ok = await openMic();
    if (ok) beginRecording();
  };

  const stopEarly = () => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const leaveTest = () => { cleanupStream(); setPhase('instructions'); };

  const retry = () => {
    setRecordedBlob(null);
    setPhase('instructions');
  };

  const submit = () => {
    onComplete({
      blob: recordedBlob,
      durationSec: recordedDuration,
      tapCount: tapCountRef.current,
      manualTapCount: manualTapRef.current,
      clientReportedNoisy: noisy,
    });
  };

  // Space bar = TAP while recording (handy on a laptop)
  useEffect(() => {
    if (phase !== 'recording') return undefined;
    const onKey = (e) => {
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); registerTap('manual'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, registerTap]);

  const SensitivityPicker = () => (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sensitivity</span>
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {Object.keys(SENSITIVITY).map((k) => (
          <button key={k} type="button" onClick={() => setSensitivity(k)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-md capitalize ${sensitivity === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );

  const LevelMeter = () => {
    const thr = detectorRef.current.threshold;
    const pct = Math.min(100, level * 250);
    return (
      <div>
        <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-[width] duration-75 ${level > thr ? 'bg-brand-600' : 'bg-green-400'}`} style={{ width: `${pct}%` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" style={{ left: `${Math.min(100, thr * 250)}%` }} title="Tap threshold" />
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Red line = level needed to count as a tap.</p>
      </div>
    );
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
              <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                <p className="text-xs text-slate-500">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mb-4"><SensitivityPicker /></div>
        <button onClick={startTest} className="w-full text-sm font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-xl py-2.5 mb-3">
          🎤 Test microphone first
        </button>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button onClick={startRecording} className="btn-primary flex-1">Start Recording</button>
        </div>
      </div>
    );
  }

  // ── Mic test ──────────────────────────────────────────
  if (phase === 'testing') {
    const silent = testSeconds > 3 && levelRef.current < 0.004 && testTaps === 0;
    return (
      <div className="card p-6">
        <h3 className="font-display font-bold text-lg text-slate-900 mb-1">Microphone Test</h3>
        <p className="text-sm text-slate-500 mb-1">Tap the table or clap near the device. The bar should jump and the tap counter should go up.</p>
        <p className="text-[11px] text-slate-400 mb-4">Using: {micLabel}</p>

        <AudioWaveform mode="live" analyser={analyserRef.current} />
        <div className="mt-3"><LevelMeter /></div>

        <div className={`mt-4 flex items-center justify-between p-3 rounded-xl border transition-colors ${flash ? 'bg-brand-50 border-brand-300' : 'bg-slate-50 border-slate-100'}`}>
          <span className="text-sm font-semibold text-slate-700">Taps heard by mic</span>
          <span className="font-display text-xl font-bold text-brand-700">{testTaps}</span>
        </div>

        {silent && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3 mt-3">
            No sound is reaching the page. Check that the right microphone is selected in your browser/Windows sound settings,
            that Windows Settings → Privacy → Microphone is on, and that the mic isn't muted. You can still use the TAP button when recording.
          </p>
        )}
        {testSeconds > 2 && testTaps === 0 && !silent && (
          <p className="text-xs text-slate-500 mt-3">Not hearing taps? Try the <b>High</b> sensitivity setting, or tap closer to the microphone.</p>
        )}

        <div className="mt-4"><SensitivityPicker /></div>
        <div className="flex items-center gap-3 mt-5">
          <button onClick={leaveTest} className="btn-secondary flex-1">Back</button>
          <button onClick={beginRecording} className="btn-primary flex-1">Start Recording</button>
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
        <div className="mt-3"><LevelMeter /></div>

        <div className="flex items-center justify-center gap-2 mt-4 mb-1">
          {dots.map((filled, i) => (
            <span key={i} className={`w-3.5 h-3.5 rounded-full transition-colors ${filled ? 'bg-brand-600' : 'bg-slate-200'}`} />
          ))}
        </div>
        <p className="text-center text-xs text-slate-500 mb-4">
          {Math.min(tapCount, TARGET_TAPS)} / {TARGET_TAPS} taps
          {manualTaps > 0 && <span className="text-slate-400"> ({tapCount - manualTaps} heard · {manualTaps} button)</span>}
          {tapCount > TARGET_TAPS && <span className="text-amber-600"> — extra taps or noise detected</span>}
        </p>

        {/* TAP button */}
        <div className="flex flex-col items-center mb-4">
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); registerTap('manual'); }}
            aria-label="Tap"
            className={`w-28 h-28 rounded-full font-display font-bold text-white text-lg shadow-lg select-none touch-manipulation
              flex flex-col items-center justify-center transition-transform ${flash ? 'scale-95 bg-brand-700' : 'scale-100 bg-brand-600 hover:bg-brand-500'}`}
          >
            <span className="text-3xl leading-none">👆</span>
            TAP
          </button>
          <p className="text-[11px] text-slate-400 mt-2">Press each time you tap the drain cover · Space bar works too</p>
        </div>

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
        {Math.min(tapCountRef.current, TARGET_TAPS)} of {TARGET_TAPS} taps counted · {recordedDuration.toFixed(1)}s recorded
        {manualTapRef.current > 0 && ` · ${manualTapRef.current} marked with the TAP button`}
      </p>

      <AudioWaveform mode="playback" audioBlob={recordedBlob} />

      {tapCountRef.current === 0 && (
        <p className="text-xs text-amber-600 mt-3">No taps were counted. You can retry (try the mic test and a higher sensitivity), or continue if you're confident the recording captured them.</p>
      )}
      {tapCountRef.current > 0 && tapCountRef.current === manualTapRef.current && (
        <p className="text-xs text-slate-500 mt-3">The microphone didn't pick up the taps on its own — they were counted from the TAP button. Check the recording by pressing Play.</p>
      )}

      <div className="flex items-center gap-3 mt-5">
        <button onClick={retry} className="btn-secondary flex-1">Retry Recording</button>
        <button onClick={submit} className="btn-primary flex-1">Analyze Recording</button>
      </div>
    </div>
  );
}
