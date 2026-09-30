import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Digits only, with country code and no "+" or spaces → +1 (555) 163-5058
// Override in frontend/.env with VITE_WHATSAPP_NUMBER=91XXXXXXXXXX if the number changes.
const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER || '15551635058').replace(/\D/g, '');
const WHATSAPP_GREEN = '#25D366';

const TOPICS = [
  { icon: '📝', label: 'File a new complaint',       text: 'Hi, I want to file a complaint.' },
  { icon: '🗑️', label: 'Garbage / sanitation',       text: 'Hi, I want to report a garbage / sanitation problem.' },
  { icon: '🌊', label: 'Drain / waterlogging',       text: 'Hi, I want to report a drain blockage / waterlogging problem.' },
  { icon: '🚰', label: 'Water supply',               text: 'Hi, I want to report a water supply problem.' },
  { icon: '🛣️', label: 'Road / potholes',            text: 'Hi, I want to report a road / pothole problem.' },
  { icon: '💡', label: 'Streetlight',                text: 'Hi, I want to report a streetlight problem.' },
  { icon: '🔍', label: 'Track my complaint',         text: 'Hi, I want to track my complaint.' },
];

const waLink = (text) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

const WhatsAppIcon = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
    <path d="M16.004 3C9.385 3 4 8.383 4 15c0 2.357.683 4.556 1.862 6.41L4 29l7.77-1.83A11.94 11.94 0 0 0 16.004 27C22.62 27 28 21.617 28 15S22.62 3 16.004 3Zm0 21.8c-1.84 0-3.56-.52-5.02-1.42l-.36-.21-4.61 1.09 1.12-4.49-.24-.38A9.76 9.76 0 0 1 6.2 15c0-5.42 4.39-9.8 9.8-9.8 5.42 0 9.8 4.38 9.8 9.8s-4.39 9.8-9.8 9.8Zm5.4-7.34c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
  </svg>
);

export default function WhatsAppChatWidget() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const { pathname } = useLocation();

  // Close on Escape or when clicking outside the panel
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  // Close the panel when navigating to another page
  useEffect(() => { setOpen(false); }, [pathname]);

  if (pathname === '/login') return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-[900] right-5 flex flex-col items-end gap-3"
      style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}
    >
      {open && (
        <div
          role="dialog"
          aria-label="Chat with us on WhatsApp"
          className="w-[320px] max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3.5 text-white flex items-center justify-between" style={{ background: '#075E54' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: WHATSAPP_GREEN }}>
                <WhatsAppIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">SheharSetu Helpline</p>
                <p className="text-[11px] text-white/80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Typically replies instantly
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-white/80 hover:text-white text-xl leading-none px-1">×</button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3" style={{ background: '#ECE5DD' }}>
            <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 text-sm text-slate-700 shadow-sm max-w-[90%]">
              👋 Namaste! You can file any civic complaint directly on WhatsApp — send text, a photo, a voice note or your location.
              <p className="text-[10px] text-slate-400 mt-1">Choose a topic to start:</p>
            </div>

            <div className="flex flex-col gap-1.5">
              {TOPICS.map((t) => (
                <a
                  key={t.label}
                  href={waLink(t.text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white hover:bg-green-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 font-medium flex items-center gap-2 transition-colors"
                >
                  <span>{t.icon}</span>
                  <span className="flex-1">{t.label}</span>
                  <span className="text-slate-300">›</span>
                </a>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-100 bg-white">
            <a
              href={waLink('Hi, I need help.')}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 text-white font-bold text-sm py-2.5 rounded-xl hover:opacity-90 transition-opacity"
              style={{ background: WHATSAPP_GREEN }}
            >
              <WhatsAppIcon className="w-5 h-5" /> Open WhatsApp Chat
            </a>
            <p className="text-[10px] text-slate-400 text-center mt-2">Opens WhatsApp on your phone or WhatsApp Web.</p>
          </div>
        </div>
      )}

      {/* Floating launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Chat on WhatsApp to file a complaint"
        aria-expanded={open}
        className="text-white rounded-full shadow-xl flex items-center gap-2 px-4 py-3.5 font-bold text-sm transition-transform hover:scale-105"
        style={{ background: WHATSAPP_GREEN }}
      >
        <WhatsAppIcon />
        <span className="hidden sm:inline">File a complaint</span>
      </button>
    </div>
  );
}
