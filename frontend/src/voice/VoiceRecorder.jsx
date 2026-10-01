import React, { useState, useRef, useEffect, useCallback } from 'react';
import { aiAPI } from '../../services/api';
import { LANGUAGES, getLanguage, getSpeechRecognition } from '../../utils/languages';

const MAX_DURATION_SEC = 120; // 2 minutes
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// Pick the best container the browser can record (Safari/iOS only does mp4).
const pickMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
};

const readSavedLang = () => {
  try { return localStorage.getItem('voiceLang') || 'en'; } catch { return 'en'; }
};

/**
 * Voice recorder with LIVE transcription.
 *
 * Why the old version never transcribed: it started the browser's speech
 * recognizer only AFTER recording had stopped, so the recognizer listened to
 * silence. Now recognition runs *while* the user speaks, in the language they
 * pick, and if the browser can't do it (Firefox, unsupported language, mic
 * conflict on some Android phones) the recorded audio is sent to the server
 * (/api/ai/transcribe, Whisper) instead.
 *
 * Props:
 *   onVoiceReady(blob|null)            – recorded/uploaded audio
 *   onTranscript(text, langCode)       – final transcript text ('' when cleared)
 *   onLanguageChange(languageObject)   – fires on mount + whenever language changes
 */
export default function VoiceRecorder({ onVoiceReady, onTranscript, onLanguageChange }) {
  const [status, setStatus]       = useState('idle'); // idle | requesting | recording | paused | done | error
  const [duration, setDuration]   = useState(0);
  const [audioURL, setAudioURL]   = useState('');
  const [audioBlob, setAudioBlob] = useState(null);
  const [errMsg, setErrMsg]       = useState('');
  const [infoMsg, setInfoMsg]     = useState('');
  const [volume, setVolume]       = useState(0);
  const [langCode, setLangCode]   = useState(readSavedLang);
  const [liveText, setLiveText]   = useState('');
  const [transcribing, setTranscribing] = useState(false);

  const lang = getLanguage(langCode);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);
  const elapsedRef       = useRef(0);
  const streamRef        = useRef(null);
  const audioCtxRef      = useRef(null);
  const analyserRef      = useRef(null);
  const animFrameRef     = useRef(null);
  const fileInputRef     = useRef(null);

  // speech-recognition bookkeeping
  const recogRef       = useRef(null);
  const wantRecogRef   = useRef(false);   // should recognition be running right now?
  const recogFailedRef = useRef(false);   // recognition unusable this session -> use server
  const finalTextRef   = useRef('');
  const recogEndedRef  = useRef(null);    // resolver for "recognition fully stopped"
  const langRef        = useRef(lang);
  langRef.current = lang;

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => { onLanguageChange?.(lang); /* eslint-disable-next-line */ }, [langCode]);

  // Cleanup on unmount
  useEffect(() => () => {
    wantRecogRef.current = false;
    try { recogRef.current?.abort(); } catch (_) {}
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close?.().catch(() => {});
  }, []);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const changeLanguage = (code) => {
    setLangCode(code);
    try { localStorage.setItem('voiceLang', code); } catch (_) {}
  };

  // ── Volume meter ─────────────────────────────────────
  const startVolumeMonitor = (stream) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      runVolumeLoop();
    } catch (_) {}
  };
  const runVolumeLoop = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      setVolume(Math.min(100, (data.reduce((a, b) => a + b, 0) / data.length) * 2));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  // ── LIVE speech recognition (runs while recording) ───
  const startRecognition = () => {
    const SR = getSpeechRecognition();
    const speechLang = langRef.current.speech;

    if (!SR) {
      recogFailedRef.current = true;
      setInfoMsg("Live transcription isn't supported in this browser — your audio will be transcribed on the server after you stop.");
      return;
    }
    if (!speechLang) {
      recogFailedRef.current = true;
      setInfoMsg(`${langRef.current.label} isn't supported for live transcription in browsers — your audio will be transcribed on the server after you stop.`);
      return;
    }

    const rec = new SR();
    rec.lang = speechLang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript || '';
        if (r.isFinal) {
          finalTextRef.current = `${finalTextRef.current} ${t}`.trim();
          onTranscriptRef.current?.(finalTextRef.current, langRef.current.code);
        } else {
          interim += t;
        }
      }
      setLiveText(`${finalTextRef.current} ${interim}`.trim());
    };

    rec.onerror = (e) => {
      // 'no-speech' / 'aborted' are normal (silence, or we stopped it)
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      recogFailedRef.current = true;
      wantRecogRef.current = false;
      const reasons = {
        'not-allowed':           'Speech recognition was blocked by the browser.',
        'service-not-allowed':   'Speech recognition is disabled on this device.',
        'audio-capture':         'Speech recognition could not share the microphone.',
        'language-not-supported':`${langRef.current.label} isn't supported for live transcription here.`,
        'network':               'Speech recognition needs an internet connection.',
      };
      setInfoMsg(`${reasons[e.error] || 'Live transcription stopped.'} Your audio will be transcribed on the server after you stop.`);
    };

    rec.onend = () => {
      // Chrome ends the session after a few seconds of silence — restart while still recording.
      if (wantRecogRef.current && !recogFailedRef.current) {
        setTimeout(() => {
          if (!wantRecogRef.current) return;
          try { rec.start(); } catch (_) {}
        }, 150);
        return;
      }
      recogEndedRef.current?.();
    };

    recogRef.current = rec;
    wantRecogRef.current = true;
    try { rec.start(); } catch (_) { recogFailedRef.current = true; }
  };

  const stopRecognition = () => {
    wantRecogRef.current = false;
    try { recogRef.current?.stop(); } catch (_) {}
  };

  // Wait (max 1.5s) for the recognizer to flush its last result
  const waitForRecognitionEnd = () => new Promise((resolve) => {
    if (!recogRef.current) return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; recogEndedRef.current = null; resolve(); } };
    recogEndedRef.current = finish;
    setTimeout(finish, 1500);
  });

  // ── Server-side transcription (Whisper) ──────────────
  const transcribeOnServer = useCallback(async (blob) => {
    setTranscribing(true);
    setErrMsg('');
    try {
      const { data } = await aiAPI.transcribe(blob, langRef.current.whisper || '');
      const text = (data.transcript || '').trim();
      if (text) {
        finalTextRef.current = text;
        setLiveText(text);
        onTranscriptRef.current?.(text, langRef.current.code);
        setInfoMsg('');
      } else {
        setInfoMsg('No speech was detected in the audio. You can type the description instead.');
      }
    } catch (err) {
      const status = err.response?.status;
      setInfoMsg(
        status === 501
          ? "Automatic transcription isn't available right now — please type the description below."
          : status === 429
          ? 'Too many transcription requests. Please wait a few minutes or type the description.'
          : 'Transcription failed. You can type the description instead.'
      );
    } finally {
      setTranscribing(false);
    }
  }, []);

  // ── Recording ────────────────────────────────────────
  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setDuration(elapsedRef.current);
      if (elapsedRef.current >= MAX_DURATION_SEC) stopRecording();
    }, 1000);
  };

  const startRecording = async () => {
    setErrMsg('');
    setInfoMsg('');
    setLiveText('');
    finalTextRef.current = '';
    recogFailedRef.current = false;
    onTranscriptRef.current?.('', langRef.current.code);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('error');
      setErrMsg('This browser cannot record audio. Please use Chrome, Edge or Safari — or upload an audio file.');
      return;
    }
    if (!window.isSecureContext) {
      setStatus('error');
      setErrMsg('Microphone needs a secure (https) connection.');
      return;
    }

    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        clearInterval(timerRef.current);
        cancelAnimationFrame(animFrameRef.current);
        stream.getTracks().forEach((t) => t.stop());
        audioCtxRef.current?.close?.().catch(() => {});
        audioCtxRef.current = null;
        analyserRef.current = null;
        setVolume(0);

        const type = mr.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
        setStatus('done');
        onVoiceReady?.(blob);

        // Flush the live recognizer, then fall back to the server if it produced nothing.
        stopRecognition();
        await waitForRecognitionEnd();
        if (!finalTextRef.current && blob.size > 1000) transcribeOnServer(blob);
      };

      mr.start(250);
      elapsedRef.current = 0;
      setDuration(0);
      setStatus('recording');
      startTimer();
      startVolumeMonitor(stream);
      startRecognition();
    } catch (err) {
      setStatus('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrMsg('Microphone access denied. Please allow the microphone in your browser settings and try again.');
      } else if (err.name === 'NotFoundError') {
        setErrMsg('No microphone found. Please connect a microphone and try again.');
      } else if (err.name === 'NotReadableError') {
        setErrMsg('The microphone is being used by another app. Close it and try again.');
      } else {
        setErrMsg('Could not start recording: ' + err.message);
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      stopRecognition();
      setStatus('paused');
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');
      startTimer();
      runVolumeLoop();
      if (!recogFailedRef.current) {
        wantRecogRef.current = true;
        try { recogRef.current?.start(); } catch (_) {}
      }
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && ['recording', 'paused'].includes(mr.state)) mr.stop();
  };

  const deleteRecording = () => {
    if (audioURL) URL.revokeObjectURL(audioURL);
    stopRecognition();
    setAudioURL('');
    setAudioBlob(null);
    setDuration(0);
    elapsedRef.current = 0;
    setVolume(0);
    setLiveText('');
    finalTextRef.current = '';
    setStatus('idle');
    setErrMsg('');
    setInfoMsg('');
    onVoiceReady?.(null);
    onTranscriptRef.current?.('', langRef.current.code);
  };

  // ── Upload an audio file → server transcription ──────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/audio/.test(file.type)) { setErrMsg('Only audio files are supported (mp3, wav, webm, ogg, m4a).'); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setErrMsg('Audio file too large. Maximum 5MB.'); return; }
    setErrMsg('');
    setInfoMsg('');
    setLiveText('');
    finalTextRef.current = '';
    setAudioURL(URL.createObjectURL(file));
    setAudioBlob(file);
    setStatus('done');
    setDuration(0);
    onVoiceReady?.(file);
    transcribeOnServer(file);
  };

  const recording = status === 'recording';
  const langLocked = ['requesting', 'recording', 'paused'].includes(status);
  const liveSupported = !!getSpeechRecognition() && !!lang.speech;

  const bars = Array.from({ length: 20 }).map((_, i) => {
    const noise = Math.sin(i * 0.8 + volume * 0.15) * 0.3 + 0.7;
    const height = recording ? Math.max(4, (volume / 100) * 28 * noise) : 4;
    return (
      <div key={i} className="w-1 rounded-full bg-brand-500 transition-all duration-75"
        style={{ height: `${height}px`, opacity: recording ? 0.7 + noise * 0.3 : 0.3 }} />
    );
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${recording ? 'bg-red-500 animate-pulse' : status === 'done' ? 'bg-green-500' : status === 'paused' ? 'bg-yellow-500' : 'bg-slate-300'}`} />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            {status === 'idle'       ? 'Voice Message (Optional)'            :
             status === 'requesting' ? 'Requesting microphone…'              :
             status === 'recording'  ? `Recording — ${formatTime(duration)}` :
             status === 'paused'     ? `Paused — ${formatTime(duration)}`    :
             status === 'done'       ? `Recorded${duration ? ` — ${formatTime(duration)}` : ''}` :
             'Microphone Error'}
          </span>
        </div>
        {recording && <span className="text-xs text-slate-400">{formatTime(MAX_DURATION_SEC - duration)} left</span>}
      </div>

      {/* Language picker */}
      <div className="flex items-center gap-2 flex-wrap">
        <label htmlFor="voice-lang" className="text-xs font-semibold text-slate-600">🌐 Speak in:</label>
        <select
          id="voice-lang"
          value={langCode}
          disabled={langLocked}
          onChange={(e) => changeLanguage(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 disabled:opacity-60"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label} — {l.native}</option>
          ))}
        </select>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${liveSupported ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {liveSupported ? 'Live transcription' : 'Transcribed after recording'}
        </span>
      </div>

      {/* Waveform */}
      {(recording || status === 'paused') && (
        <div className="flex items-center justify-center py-1"><div className="flex items-center gap-0.5 h-8">{bars}</div></div>
      )}

      {/* Progress bar */}
      {(recording || status === 'paused') && (
        <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${(duration / MAX_DURATION_SEC) * 100}%` }} />
        </div>
      )}

      {/* Live transcript preview */}
      {(recording || status === 'paused') && liveText && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-700" lang={lang.code}>{liveText}</div>
      )}

      {/* Playback */}
      {status === 'done' && audioURL && <audio src={audioURL} controls className="w-full h-10 rounded-xl" />}

      {transcribing && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin" />
          Transcribing your audio…
        </div>
      )}

      {infoMsg && !errMsg && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
          <span className="text-sm">ℹ️</span><span>{infoMsg}</span>
        </div>
      )}

      {errMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-start gap-2">
          <span className="text-sm">⚠️</span><span>{errMsg}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        {status === 'idle' && (
          <>
            <button type="button" onClick={startRecording}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold hover:bg-brand-700 transition-colors">
              🎤 Start Recording
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors">
              ⬆ Upload Audio
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

        {recording && (
          <>
            <button type="button" onClick={pauseRecording}
              className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-xl text-xs font-semibold hover:bg-yellow-200 transition-colors">⏸ Pause</button>
            <button type="button" onClick={stopRecording}
              className="px-3 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-200 transition-colors">⏹ Stop</button>
          </>
        )}

        {status === 'paused' && (
          <>
            <button type="button" onClick={resumeRecording}
              className="px-3 py-2 bg-green-100 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-200 transition-colors">▶ Resume</button>
            <button type="button" onClick={stopRecording}
              className="px-3 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-200 transition-colors">⏹ Stop</button>
          </>
        )}

        {status === 'done' && (
          <>
            <button type="button" onClick={deleteRecording}
              className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors border border-red-200">🗑 Delete</button>
            <button type="button" onClick={() => { deleteRecording(); setTimeout(startRecording, 150); }}
              className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors">🔄 Re-record</button>
            {audioBlob && !transcribing && (
              <button type="button" onClick={() => transcribeOnServer(audioBlob)}
                className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
                title="Pick the language above, then transcribe the saved audio again">
                📝 Transcribe again
              </button>
            )}
          </>
        )}

        {status === 'error' && (
          <button type="button" onClick={() => { setStatus('idle'); setErrMsg(''); }}
            className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors">Try Again</button>
        )}
      </div>

      {status === 'idle' && (
        <p className="text-xs text-slate-400">
          Choose your language, then describe the issue — it is transcribed as you speak. Max 2 minutes.
        </p>
      )}
    </div>
  );
}
