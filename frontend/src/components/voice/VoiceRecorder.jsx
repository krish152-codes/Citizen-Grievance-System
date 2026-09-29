import React, { useState, useRef, useEffect } from 'react';

const MAX_DURATION_SEC = 120; // 2 minutes

export default function VoiceRecorder({ onVoiceReady, onTranscript }) {
  const [status, setStatus]         = useState('idle'); // idle | requesting | recording | paused | done | error
  const [duration, setDuration]     = useState(0);
  const [audioURL, setAudioURL]     = useState('');
  const [audioBlob, setAudioBlob]   = useState(null);
  const [errMsg, setErrMsg]         = useState('');
  const [volume, setVolume]         = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);
  const streamRef        = useRef(null);
  const analyserRef      = useRef(null);
  const animFrameRef     = useRef(null);
  const fileInputRef     = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Volume animation
  const startVolumeMonitor = (stream) => {
    try {
      const ctx      = new (window.AudioContext || window.webkitAudioContext)();
      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const tick = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolume(Math.min(100, avg * 2));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (_) {}
  };

  const startRecording = async () => {
    setErrMsg('');
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : MediaRecorder.isTypeSupported('audio/webm')
        ? { mimeType: 'audio/webm' }
        : {};

      const mr = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: options.mimeType || 'audio/webm' });
        const url  = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioURL(url);
        setStatus('done');
        onVoiceReady?.(blob);
        clearInterval(timerRef.current);
        cancelAnimationFrame(animFrameRef.current);
        stream.getTracks().forEach(t => t.stop());

        // Browser speech recognition for transcript
        tryBrowserTranscript(blob);
      };

      mr.start(250);
      setStatus('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(d => {
          if (d + 1 >= MAX_DURATION_SEC) { stopRecording(); return MAX_DURATION_SEC; }
          return d + 1;
        });
      }, 1000);

      startVolumeMonitor(stream);
    } catch (err) {
      setStatus('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrMsg('Microphone access denied. Please allow microphone in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setErrMsg('No microphone found. Please connect a microphone and try again.');
      } else {
        setErrMsg('Could not start recording: ' + err.message);
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('paused');
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');
      timerRef.current = setInterval(() => {
        setDuration(d => {
          if (d + 1 >= MAX_DURATION_SEC) { stopRecording(); return MAX_DURATION_SEC; }
          return d + 1;
        });
      }, 1000);
      if (analyserRef.current) {
        const tick = () => {
          const data = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(data);
          setVolume(Math.min(100, data.reduce((a, b) => a + b, 0) / data.length * 2));
          animFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && ['recording','paused'].includes(mediaRecorderRef.current.state)) {
      mediaRecorderRef.current.stop();
    }
  };

  const deleteRecording = () => {
    if (audioURL) URL.revokeObjectURL(audioURL);
    setAudioURL('');
    setAudioBlob(null);
    setDuration(0);
    setVolume(0);
    setStatus('idle');
    setErrMsg('');
    onVoiceReady?.(null);
  };

  // Browser Web Speech API for transcript (best-effort)
  const tryBrowserTranscript = (blob) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recog = new SpeechRecognition();
      recog.lang = 'en-IN';
      recog.interimResults = false;
      recog.maxAlternatives = 1;
      recog.onresult = (e) => {
        const text = e.results[0]?.[0]?.transcript || '';
        if (text) onTranscript?.(text);
      };
      recog.onerror = () => {};
      recog.start();
    } catch (_) {}
  };

  // File upload fallback
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = /audio/;
    if (!allowed.test(file.type)) {
      setErrMsg('Only audio files are supported (mp3, wav, webm, ogg).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrMsg('Audio file too large. Maximum 5MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    setAudioURL(url);
    setAudioBlob(file);
    setStatus('done');
    setDuration(0);
    setErrMsg('');
    onVoiceReady?.(file);
  };

  // ── Waveform bars (volume visualization) ─────────────
  const WaveForm = () => {
    const bars = 20;
    return (
      <div className="flex items-center gap-0.5 h-8">
        {Array.from({ length: bars }).map((_, i) => {
          const noise  = Math.sin(i * 0.8 + Date.now() * 0.002) * 0.3 + 0.7;
          const height = status === 'recording' ? Math.max(4, (volume / 100) * 28 * noise) : status === 'paused' ? 4 : 4;
          return (
            <div
              key={i}
              className="w-1 rounded-full bg-brand-500 transition-all duration-75"
              style={{ height: `${height}px`, opacity: status === 'recording' ? 0.7 + noise * 0.3 : 0.3 }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === 'recording' ? 'bg-red-500 animate-pulse' : status === 'done' ? 'bg-green-500' : status === 'paused' ? 'bg-yellow-500' : 'bg-slate-300'}`} />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            {status === 'idle'       ? 'Voice Message (Optional)'     :
             status === 'requesting' ? 'Requesting microphone…'       :
             status === 'recording'  ? `Recording — ${formatTime(duration)}` :
             status === 'paused'     ? `Paused — ${formatTime(duration)}`    :
             status === 'done'       ? `Recorded — ${formatTime(duration)}`  :
             'Microphone Error'}
          </span>
        </div>
        {status === 'recording' && (
          <span className="text-xs text-slate-400">{formatTime(MAX_DURATION_SEC - duration)} left</span>
        )}
      </div>

      {/* Waveform */}
      {(status === 'recording' || status === 'paused') && (
        <div className="flex items-center justify-center py-1">
          <WaveForm />
        </div>
      )}

      {/* Progress bar */}
      {(status === 'recording' || status === 'paused') && (
        <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all"
            style={{ width: `${(duration / MAX_DURATION_SEC) * 100}%` }}
          />
        </div>
      )}

      {/* Playback */}
      {status === 'done' && audioURL && (
        <audio src={audioURL} controls className="w-full h-10 rounded-xl" />
      )}

      {/* Error */}
      {errMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-start gap-2">
          <span className="text-sm">⚠️</span>
          <span>{errMsg}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        {status === 'idle' && (
          <>
            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold hover:bg-brand-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Start Recording
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth="2" strokeLinecap="round"/>
                <polyline points="17 8 12 3 7 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Upload Audio
            </button>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
          </>
        )}

        {status === 'requesting' && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin" />
            Allow microphone access in your browser…
          </div>
        )}

        {status === 'recording' && (
          <>
            <button type="button" onClick={pauseRecording}
              className="flex items-center gap-1.5 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-xl text-xs font-semibold hover:bg-yellow-200 transition-colors">
              ⏸ Pause
            </button>
            <button type="button" onClick={stopRecording}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-200 transition-colors">
              ⏹ Stop
            </button>
          </>
        )}

        {status === 'paused' && (
          <>
            <button type="button" onClick={resumeRecording}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-100 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-200 transition-colors">
              ▶ Resume
            </button>
            <button type="button" onClick={stopRecording}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-200 transition-colors">
              ⏹ Stop
            </button>
          </>
        )}

        {status === 'done' && (
          <>
            <button type="button" onClick={deleteRecording}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors border border-red-200">
              🗑 Delete
            </button>
            <button type="button" onClick={() => { deleteRecording(); setTimeout(startRecording, 100); }}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors">
              🔄 Re-record
            </button>
          </>
        )}

        {status === 'error' && (
          <button type="button" onClick={() => { setStatus('idle'); setErrMsg(''); }}
            className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors">
            Try Again
          </button>
        )}
      </div>

      {status === 'idle' && (
        <p className="text-xs text-slate-400">
          Verbally describe the issue — AI will transcribe and analyze your voice message. Max 2 minutes.
        </p>
      )}
    </div>
  );
}
