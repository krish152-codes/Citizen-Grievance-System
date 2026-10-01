import React, { useEffect, useRef, useState } from 'react';

/**
 * Two ways to use this component:
 *  1. Live recording:  <AudioWaveform mode="live" analyser={analyserNode} />
 *     Animates a live time-domain waveform from an active AnalyserNode.
 *  2. Recorded clip:   <AudioWaveform mode="playback" audioBlob={blob} />
 *     Shows a static downsampled waveform immediately, and — on Play — an
 *     animated waveform + frequency spectrum driven by real playback audio.
 */
export default function AudioWaveform({ mode = 'live', analyser, audioBlob, height = 96 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const audioElRef = useRef(null);
  const [playbackAnalyser, setPlaybackAnalyser] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [view, setView] = useState('waveform'); // 'waveform' | 'spectrum'
  const [staticPeaks, setStaticPeaks] = useState(null);
  const gainRef = useRef(1);

  // Stable object URL for the audio element — created once per blob, revoked on change/unmount.
  const audioUrlRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);
  useEffect(() => {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    audioUrlRef.current = url;
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  // ── Static downsampled waveform from the recorded blob (shown immediately) ──
  useEffect(() => {
    if (mode !== 'playback' || !audioBlob) return;
    let cancelled = false;
    (async () => {
      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
        const channel = decoded.getChannelData(0);
        const buckets = 90;
        const bucketSize = Math.floor(channel.length / buckets) || 1;
        const peaks = [];
        for (let i = 0; i < buckets; i++) {
          let max = 0;
          for (let j = i * bucketSize; j < (i + 1) * bucketSize && j < channel.length; j++) {
            max = Math.max(max, Math.abs(channel[j]));
          }
          peaks.push(max);
        }
        if (!cancelled) setStaticPeaks(peaks);
        ctx.close();
      } catch {
        if (!cancelled) setStaticPeaks(null); // decode failed — fall back to "no preview"
      }
    })();
    return () => { cancelled = true; };
  }, [mode, audioBlob]);

  // ── Live time-domain animation (recording, or playback-in-progress) ──
  useEffect(() => {
    const activeAnalyser = mode === 'live' ? analyser : playbackAnalyser;
    if (!activeAnalyser) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    const bufferLength = activeAnalyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const w = canvas.width, h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      if (view === 'spectrum') {
        activeAnalyser.getByteFrequencyData(freqData);
        const barCount = 48;
        const step = Math.floor(bufferLength / barCount);
        const barWidth = w / barCount;
        for (let i = 0; i < barCount; i++) {
          const v = freqData[i * step] / 255;
          const barHeight = v * h;
          ctx2d.fillStyle = '#7c3aed';
          ctx2d.fillRect(i * barWidth + 1, h - barHeight, barWidth - 2, barHeight);
        }
      } else {
        activeAnalyser.getByteTimeDomainData(timeData);
        // Visual auto-gain: quiet sounds (like drain taps) would otherwise look like a flat line
        let peak = 0;
        for (let i = 0; i < bufferLength; i++) peak = Math.max(peak, Math.abs(timeData[i] - 128) / 128);
        const targetGain = Math.min(12, Math.max(1, 0.6 / Math.max(peak, 0.02)));
        gainRef.current += (targetGain - gainRef.current) * (targetGain < gainRef.current ? 0.3 : 0.05);
        const gain = gainRef.current;

        ctx2d.strokeStyle = 'rgba(148,163,184,0.25)';
        ctx2d.lineWidth = 1;
        ctx2d.beginPath(); ctx2d.moveTo(0, h / 2); ctx2d.lineTo(w, h / 2); ctx2d.stroke();

        ctx2d.lineWidth = 2;
        ctx2d.strokeStyle = '#60a5fa';
        ctx2d.beginPath();
        const sliceWidth = w / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = ((timeData[i] - 128) / 128) * gain;
          const y = h / 2 + Math.max(-1, Math.min(1, v)) * (h / 2 - 2);
          if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
          x += sliceWidth;
        }
        ctx2d.stroke();
      }
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [mode, analyser, playbackAnalyser, view]);

  // ── Static waveform render (no live analyser yet) ──
  useEffect(() => {
    if (mode !== 'playback' || isPlaying || !staticPeaks) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height, mid = h / 2;
    ctx2d.clearRect(0, 0, w, h);
    const barWidth = w / staticPeaks.length;
    ctx2d.fillStyle = '#93c5fd';
    staticPeaks.forEach((peak, i) => {
      const barHeight = Math.max(2, peak * h);
      ctx2d.fillRect(i * barWidth + 1, mid - barHeight / 2, barWidth - 2, barHeight);
    });
  }, [mode, staticPeaks, isPlaying]);

  const togglePlayback = async () => {
    if (!audioElRef.current) return;
    if (isPlaying) {
      audioElRef.current.pause();
      setIsPlaying(false);
      return;
    }
    if (!playbackAnalyser) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaElementSource(audioElRef.current);
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      source.connect(node);
      node.connect(ctx.destination);
      setPlaybackAnalyser(node);
    }
    audioElRef.current.play();
    setIsPlaying(true);
  };

  return (
    <div className="bg-slate-900 rounded-xl p-3">
      <canvas ref={canvasRef} width={600} height={height} className="w-full" style={{ height }} />
      {mode === 'playback' && (
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView('waveform')}
              className={`text-[10px] font-bold px-2 py-1 rounded-md ${view === 'waveform' ? 'bg-white text-slate-900' : 'text-slate-400'}`}
            >
              Waveform
            </button>
            <button
              onClick={() => setView('spectrum')}
              className={`text-[10px] font-bold px-2 py-1 rounded-md ${view === 'spectrum' ? 'bg-white text-slate-900' : 'text-slate-400'}`}
            >
              Spectrum
            </button>
          </div>
          {audioBlob && (
            <button onClick={togglePlayback} className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-brand-600 text-white">
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
          )}
        </div>
      )}
      {mode === 'playback' && audioBlob && (
        <audio
          ref={audioElRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
}
