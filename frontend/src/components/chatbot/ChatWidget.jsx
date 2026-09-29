import React, { useState, useRef, useEffect, useCallback } from 'react';
import { chatbotAPI } from '../../services/api';

const CONV_STORAGE_KEY = 'sheharsetu_chat_conversation_id';
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER || '';

function whatsappLink(prefillText) {
  const text = encodeURIComponent(prefillText || 'Hi SheharSetu, I want to report a civic problem.');
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

function pickAudioMimeType() {
  const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const type of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type;
  }
  return '';
}

const QUICK_ACTIONS = [
  { key: 'report', label: '💬 Type a complaint' },
  { key: 'track', label: '🔍 Track a complaint' },
  { key: 'help', label: '❓ Help' },
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState(() => localStorage.getItem(CONV_STORAGE_KEY) || null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);

  const listEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Restore a previous conversation's history, if any, when first opened.
  useEffect(() => {
    if (!open || messages.length > 0 || !conversationId) return;
    chatbotAPI.getConversation(conversationId)
      .then(({ data }) => {
        if (data.messages?.length) {
          setMessages(data.messages.map((m) => ({ direction: m.direction, text: m.text, type: m.messageType })));
          setShowQuickActions(false);
        }
      })
      .catch(() => {
        // Stale/invalid conversation id — start fresh silently.
        localStorage.removeItem(CONV_STORAGE_KEY);
        setConversationId(null);
      });
  }, [open, conversationId, messages.length]);

  const pushLocal = (direction, text, type = 'TEXT') => {
    setMessages((prev) => [...prev, { direction, text, type }]);
  };

  const handleResult = (data) => {
    if (data.conversationId && data.conversationId !== conversationId) {
      setConversationId(data.conversationId);
      localStorage.setItem(CONV_STORAGE_KEY, data.conversationId);
    }
    pushLocal('outbound', data.reply);
  };

  const send = async (apiCall, userFacingEcho) => {
    setBusy(true);
    setShowQuickActions(false);
    if (userFacingEcho) pushLocal('inbound', userFacingEcho.text, userFacingEcho.type);
    try {
      const { data } = await apiCall();
      handleResult(data);
    } catch (err) {
      pushLocal('outbound', err.response?.data?.message || "I'm having trouble responding right now — please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const sendText = (text) => {
    if (!text.trim()) return;
    setInputText('');
    send(() => chatbotAPI.sendMessage({ conversationId, text }), { text, type: 'TEXT' });
  };

  const handleQuickAction = (key) => {
    if (key === 'report') { setShowQuickActions(false); pushLocal('outbound', "Sure — what problem would you like to report?"); return; }
    if (key === 'track') { setShowQuickActions(false); pushLocal('outbound', 'Please share your complaint ID (e.g. TKT-1024), and I\'ll look up its status.'); return; }
    if (key === 'help') sendText('help');
  };

  const shareLocation = () => {
    if (!navigator.geolocation) {
      pushLocal('outbound', "This browser doesn't support location sharing. You can type an address instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        send(() => chatbotAPI.sendLocation({ conversationId, lat, lng }), { text: '📍 Shared my location', type: 'LOCATION' });
      },
      () => {
        setLocating(false);
        pushLocal('outbound', 'Location access was denied. You can type an address or nearby landmark instead.');
      },
      { timeout: 8000 }
    );
  };

  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    formData.append('conversationId', conversationId || '');
    send(() => chatbotAPI.sendImage(formData), { text: '📷 Photo sent', type: 'IMAGE' });
  };

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      pushLocal('outbound', "This browser doesn't support voice recording. Please type your complaint instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const formData = new FormData();
        formData.append('voice', blob, `voice-${Date.now()}.webm`);
        formData.append('conversationId', conversationId || '');
        send(() => chatbotAPI.sendVoice(formData), { text: '🎤 Voice message sent', type: 'AUDIO' });
      };
      recorder.start();
      setRecording(true);
    } catch {
      pushLocal('outbound', 'Microphone permission was denied. Please allow microphone access, or type your complaint instead.');
    }
  };

  // ── Collapsed launcher ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Report a Civic Problem — SheharSetu AI Assistant"
        className="fixed z-[1000] bottom-5 right-5 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-xl px-5 py-3.5 flex items-center gap-2 font-bold text-sm transition-all hover:scale-105"
        style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <span className="text-lg">🤖</span>
        <span className="hidden sm:inline">Report a Problem</span>
      </button>
    );
  }

  return (
    <div
      className="fixed z-[1000] inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[380px] sm:h-[600px] sm:max-h-[80vh] bg-white sm:rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
      role="dialog"
      aria-label="SheharSetu AI Assistant chat"
    >
      {/* Header */}
      <div className="bg-brand-600 text-white px-4 py-3.5 flex items-center justify-between flex-shrink-0" style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top, 0px))' }}>
        <div>
          <p className="font-display font-bold text-sm">SheharSetu AI Assistant</p>
          <p className="text-[11px] text-brand-100 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Online</p>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-white/80 hover:text-white text-xl leading-none px-1">×</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 text-xs py-6">
            <p className="mb-1">👋 Namaste! Send a message, voice note, photo, or location — I'll help you register the complaint.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.direction === 'inbound' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
              m.direction === 'inbound' ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1">
              {[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        )}
        <div ref={listEndRef} />
      </div>

      {/* Quick actions */}
      {showQuickActions && messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 flex-shrink-0">
          {QUICK_ACTIONS.map((qa) => (
            <button key={qa.key} onClick={() => handleQuickAction(qa.key)} className="text-xs font-semibold bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-100">
              {qa.label}
            </button>
          ))}
        </div>
      )}

      {/* WhatsApp handoff */}
      {WHATSAPP_NUMBER && (
        <div className="px-4 pb-2 flex-shrink-0">
          <a
            href={whatsappLink()}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-full py-2 hover:bg-green-100"
          >
            💬 Prefer WhatsApp? Continue there
          </a>
        </div>
      )}

      {/* Composer */}
      <div className="p-3 border-t border-slate-100 flex items-center gap-1.5 flex-shrink-0 bg-white" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          aria-label="Attach a photo"
          className="w-9 h-9 flex-shrink-0 rounded-full hover:bg-slate-100 flex items-center justify-center text-lg"
        >
          📷
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImagePick} />

        <button
          onClick={shareLocation}
          disabled={busy || locating}
          aria-label="Share location"
          className="w-9 h-9 flex-shrink-0 rounded-full hover:bg-slate-100 flex items-center justify-center text-lg"
        >
          {locating ? '⏳' : '📍'}
        </button>

        <button
          onClick={toggleRecording}
          disabled={busy}
          aria-label={recording ? 'Stop recording' : 'Record a voice message'}
          className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-lg ${recording ? 'bg-red-100 animate-pulse' : 'hover:bg-slate-100'}`}
        >
          🎤
        </button>

        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendText(inputText)}
          placeholder={recording ? 'Recording…' : 'Type your complaint…'}
          disabled={busy || recording}
          className="input-field text-sm py-2 flex-1 min-w-0"
        />
        <button
          onClick={() => sendText(inputText)}
          disabled={busy || !inputText.trim()}
          aria-label="Send"
          className="w-9 h-9 flex-shrink-0 rounded-full bg-brand-600 text-white flex items-center justify-center disabled:opacity-40"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
