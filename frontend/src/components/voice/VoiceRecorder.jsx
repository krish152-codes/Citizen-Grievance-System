import React, { useState, useRef, useEffect } from 'react';

const MAX_DURATION_SEC = 120; // 2 minutes

// 22 Indian scheduled languages + English
const INDIAN_LANGUAGES = [
  { code: 'en-IN',    label: 'English (India)' },
  { code: 'hi-IN',    label: 'Hindi' },
  { code: 'mr-IN',    label: 'Marathi' },
  { code: 'ta-IN',    label: 'Tamil' },
  { code: 'te-IN',    label: 'Telugu' },
  { code: 'kn-IN',    label: 'Kannada' },
  { code: 'ml-IN',    label: 'Malayalam' },
  { code: 'gu-IN',    label: 'Gujarati' },
  { code: 'pa-IN',    label: 'Punjabi' },
  { code: 'bn-IN',    label: 'Bengali' },
  { code: 'or-IN',    label: 'Odia' },
  { code: 'as-IN',    label: 'Assamese' },
  { code: 'ur-IN',    label: 'Urdu' },
  { code: 'sd-IN',    label: 'Sindhi' },
  { code: 'sa-IN',    label: 'Sanskrit' },
  { code: 'kok-IN',   label: 'Konkani' },
  { code: 'mai-IN',   label: 'Maithili' },
  { code: 'ne-IN',    label: 'Nepali' },
  { code: 'mni-IN',   label: 'Manipuri' },
  { code: 'bo-IN',    label: 'Bodo' },
  { code: 'sat-IN',   label: 'Santali' },
  { code: 'doi-IN',   label: 'Dogri' },
  { code: 'ks-IN',    label: 'Kashmiri' },
];

export default function VoiceRecorder({ onVoiceReady, onTranscript }) {
  const [status, setStatus]       = useState('idle');
  const [duration, setDuration]   = useState(0);
  const [audioURL, setAudioURL]   = useState('');
  const [audioBlob, setAudioBlob] = useState(null);
  const [errMsg, setErrMsg]       = useState('');
  const [volume, setVolume]       = useState(0);
  const [transcript, setTranscript]             = useState('');
  const [translating, setTranslating]           = useState(false);
  const [selectedLang, setSelectedLang]         = useState('hi-IN');
  const [showLangPicker, setShowLangPicker]     = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);
  const streamRef        = useRef(null);
  const analyserRef      = useRef(null);
  const animFrameRef     = useRef(null);
  const fileInputRef     = useRef(null);
  const recognitionRef   = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      recognitionRef.current?.stop();
    };
  }, []);

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

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
        setVolume(Math.min(100, (data.reduce((a, b) => a + b, 0) / data.length) * 2));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (_) {}
  };

  // ── Web Speech API live recognition ──────────────────────────────────────
  const startSpeechRecognition = (lang) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    try {
      const recog = new SR();
      recog.lang             = lang;
      recog.continuous       = true;
      recog.interimResults   = true;
      recog.maxAlternatives  = 1;
      recognitionRef.current = recog;

      let finalText = '';
      recog.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const text = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += text + ' ';
          else interim = text;
        }
        const combined = (finalText + interim).trim();
        setTranscript(combined);
      };
      recog.onerror = () => {};
      recog.start();
    } catch (_) {}
  };

  const stopSpeechRecognition = () => {
    try { recognitionRef.current?.stop(); } catch (_) {}
  };

  // ── Google Translate (free web endpoint) — translates to English ─────────
  const translateToEnglish = async (text, srcLang) => {
    if (!text || srcLang === 'en-IN') return text;
    setTranslating(true);
    try {
      const src = srcLang.split('-')[0]; // e.g. 'hi'
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src}&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const res  = await fetch(url);
      const json = await res.json();
      // Response structure: [[["translated","original",null,null,1],...],...]
      const translated = json?.[0]?.map(segment => segment?.[0]).filter(Boolean).join('') || text;
      setTranslating(false);
      return translated;
    } catch {
      setTranslating(false);
      return text; // fallback to original
    }
  };

  const startRecording = async () => {
    setErrMsg('');
    setTranscript('');
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

      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: options.mimeType || 'audio/webm' });
        const url  = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioURL(url);
        setStatus('done');
        onVoiceReady?.(blob);
        clearInterval(timerRef.current);
        cancelAnimationFrame(animFrameRef.current);
        stream.getTracks().forEach(t => t.stop());
        stopSpeechRecognition();

        // Translate the captured transcript to English for AI
        if (transcript) {
          setTranslating(true);
          const english = await translateToEnglish(transcript, selectedLang);
          setTranslating(false);
          onTranscript?.(english);
        }
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
      startSpeechRecognition(selectedLang);
    } catch (err) {
      setStatus('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrMsg('Microphone access denied. Allow microphone in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setErrMsg('No microphone found. Please connect one and try again.');
      } else {
        setErrMsg('Could not start recording: ' + err.message);
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      recognitionRef.current?.stop();
      setStatus('paused');
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');
      startSpeechRecognition(selectedLang);
      timerRef.current = setInterval(() => {
        setDuration(d => {
          if (d + 1 >= MAX_DURATION_SEC) { stopRecording(); return MAX_DURATION_SEC; }
          return d + 1;
        });
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && ['recording', 'paused'].includes(mediaRecorderRef.current.state)) {
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
    setTranscript('');
    onVoiceReady?.(null);
    onTranscript?.('');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) { setErrMsg('Only audio files are supported.'); return; }
    if (file.size > 5 * 1024 * 1024)    { setErrMsg('Audio file too large (max 5MB).'); return; }
    const url = URL.createObjectURL(file);
    setAudioURL(url);
    setAudioBlob(file);
    setStatus('done');
    setErrMsg('');
    onVoiceReady?.(file);
  };

  const selectedLangLabel = INDIAN_LANGUAGES.find(l => l.code === selectedLang)?.label || 'Hindi';

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === 'recording' ? 'bg-red-500 animate-pulse' :
            status === 'done'      ? 'bg-green-500' :
            status === 'paused'    ? 'bg-yellow-500' : 'bg-slate-300'
          }`} />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            {status === 'idle'       ? 'Voice Message (Optional)' :
             status === 'requesting' ? 'Requesting microphone…' :
             status === 'recording'  ? `Recording — ${formatTime(duration)}` :
             status === 'paused'     ? `Paused — ${formatTime(duration)}` :
             status === 'done'       ? `Recorded — ${formatTime(duration)}` :
             'Microphone Error'}
          </span>
        </div>
        {status === 'recording' && (
          <span className="text-xs text-slate-400">{formatTime(MAX_DURATION_SEC - duration)} left</span>
        )}
      </div>

      {/* Language picker */}
      {(status === 'idle' || status === 'error') && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLangPicker(!showLangPicker)}
            className="flex items-center gap-2 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-xl hover:bg-brand-100 transition-colors"
          >
            🌐 Speak in: {selectedLangLabel}
            <svg className={`w-3 h-3 transition-transform ${showLangPicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polyline points="6 9 12 15 18 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <p className="text-[10px] text-slate-400 mt-1">
            Your voice will be transcribed and auto-translated to English for AI analysis.
          </p>
          {showLangPicker && (
            <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 max-h-48 overflow-y-auto w-56">
              {INDIAN_LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => { setSelectedLang(code); setShowLangPicker(false); }}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    selectedLang === code ? 'bg-brand-50 text-brand-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Waveform when recording */}
      {(status === 'recording' || status === 'paused') && (
        <div className="flex items-center gap-0.5 h-8 justify-center">
          {Array.from({ length: 24 }).map((_, i) => {
            const noise  = Math.sin(i * 0.8 + Date.now() * 0.002) * 0.3 + 0.7;
            const height = status === 'recording' ? Math.max(3, (volume / 100) * 28 * noise) : 3;
            return (
              <div
                key={i}
                className="w-1 rounded-full bg-brand-500 transition-all duration-75"
                style={{ height: `${height}px`, opacity: status === 'recording' ? 0.6 + noise * 0.4 : 0.2 }}
              />
            );
          })}
        </div>
      )}

      {/* Progress bar */}
      {(status === 'recording' || status === 'paused') && (
        <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${(duration / MAX_DURATION_SEC) * 100}%` }} />
        </div>
      )}

      {/* Live transcript */}
      {(status === 'recording' || status === 'paused') && transcript && (
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-600 italic leading-relaxed max-h-16 overflow-y-auto">
          🎙 "{transcript}"
        </div>
      )}

      {/* Playback */}
      {status === 'done' && audioURL && (
        <audio src={audioURL} controls className="w-full h-10 rounded-xl" />
      )}

      {/* Final transcript + translation status */}
      {status === 'done' && transcript && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1">
          <p className="text-xs font-bold text-blue-700">
            🌐 {selectedLangLabel} → English (for AI)
          </p>
          {translating ? (
            <div className="flex items-center gap-2 text-xs text-blue-500">
              <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
              Translating to English…
            </div>
          ) : (
            <p className="text-xs text-blue-600 italic">"{transcript}"</p>
          )}
        </div>
      )}

      {/* Error */}
      {errMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-start gap-2">
          <span>⚠️</span>
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
              📁 Upload Audio
            </button>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
          </>
        )}

        {status === 'requesting' && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin" />
            Allow microphone in your browser…
          </div>
        )}

        {status === 'recording' && (
          <>
            <button type="button" onClick={pauseRecording}
              className="flex items-center gap-1.5 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-xl text-xs font-semibold hover:bg-yellow-200">
              ⏸ Pause
            </button>
            <button type="button" onClick={stopRecording}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-200">
              ⏹ Stop
            </button>
          </>
        )}

        {status === 'paused' && (
          <>
            <button type="button" onClick={resumeRecording}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-100 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-200">
              ▶ Resume
            </button>
            <button type="button" onClick={stopRecording}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-200">
              ⏹ Stop
            </button>
          </>
        )}

        {status === 'done' && (
          <>
            <button type="button" onClick={deleteRecording}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold hover:bg-red-100">
              🗑 Delete
            </button>
            <button type="button" onClick={() => { deleteRecording(); setTimeout(startRecording, 100); }}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100">
              🔄 Re-record
            </button>
          </>
        )}

        {status === 'error' && (
          <button type="button" onClick={() => { setStatus('idle'); setErrMsg(''); }}
            className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100">
            Try Again
          </button>
        )}
      </div>

      {status === 'idle' && (
        <p className="text-xs text-slate-400">
          Choose your language → Record your complaint verbally → AI transcribes and translates to English automatically.
        </p>
      )}
    </div>
  );
}
