import React, { useState, useRef, useEffect } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { useAuth } from '../context/AuthContext';
import { aiAPI } from '../services/api';
import { getInitials } from '../utils/helpers';

const QUICK_PROMPTS = [
  'Analyze waste patterns in Central District',
  'Show me high priority issues this week',
  'Which department has the most backlog?',
  'Predict issues for next weekend',
];

const INITIAL_MESSAGES = [
  {
    id: 1,
    role: 'assistant',
    content: "I've analyzed the recent traffic patterns in the North Sector. There's a 14% increase in congestion near the 5th Avenue intersection over the last 72 hours. Would you like me to cross-reference this with recent infrastructure permits or public transport delays?",
    tags: ['ANOMALIES DETECTED', 'NORTH SECTOR'],
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
  },
];

export default function AIAnalysisPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText) return;

    const userMsg = { id: Date.now(), role: 'user', content: userText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Use AI classify endpoint for demo
      const { data } = await aiAPI.classify(userText);
      const result = data.result;

      const response = generateAIResponse(userText, result);
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response,
        tags: [result.category?.toUpperCase(), result.priority?.toUpperCase()].filter(Boolean),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errorMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'I encountered an issue processing your request. Please check that the backend service is running and try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const generateAIResponse = (query, result) => {
    const responses = [
      `Based on my analysis, this appears to be a **${result.category}** issue with **${result.priority}** priority. I recommend routing this to ${result.department} for immediate attention. Confidence score: ${Math.round(result.confidence * 100)}%.`,
      `I've cross-referenced your query with current urban data. The ${result.category} category shows elevated activity in the Central District this week. Would you like me to generate a detailed incident report?`,
      `Analysis complete. Sentiment analysis indicates a ${result.sentiment?.label || 'neutral'} tone in citizen reports. I suggest dispatching the ${result.department} team and scheduling a follow-up inspection within 48 hours.`,
      `Urban intelligence scan complete. Based on historical patterns and current data, I predict a ${result.priority === 'high' ? '23%' : '12%'} increase in similar ${result.category} reports over the next 72 hours. Should I prepare a resource allocation strategy?`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const firstNameOrDirector = user?.name?.split(' ')[0] || 'Director';

  return (
    <AdminLayout>
      <div className="flex flex-col h-full">
        {/* Chat area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-8">
          {/* Greeting */}
          {messages.length === 1 && (
            <div className="text-center mb-10 animate-slide-up">
              <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🧠</span>
              </div>
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-2">
                Hello, Director {firstNameOrDirector}.
              </h2>
              <p className="text-slate-500">How can I assist with your urban data analysis today?</p>

              {/* Quick prompts */}
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 animate-fade-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-brand-600 text-white text-sm font-bold' : 'bg-brand-100'
                }`}>
                  {msg.role === 'user' ? getInitials(user?.name || 'U') : '✨'}
                </div>

                <div className={`flex-1 ${msg.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                  {/* Bubble */}
                  <div className={`rounded-2xl p-4 max-w-lg ${
                    msg.role === 'user'
                      ? 'bg-brand-600 text-white rounded-tr-sm'
                      : 'bg-white border border-slate-100 shadow-sm rounded-tl-sm'
                  }`}>
                    <p className={`text-sm leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
                      {msg.content}
                    </p>
                  </div>

                  {/* Tags */}
                  {msg.tags?.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {msg.tags.map((tag) => (
                        <span key={tag} className="badge bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold">
                          {tag.includes('ANOMAL') ? '⚡' : ''} {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  {msg.role === 'user' && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      SENT {msg.timestamp?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} AGO
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex gap-4 animate-fade-in">
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">✨</div>
                <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-sm p-4">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <div
                        key={delay}
                        className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="border-t border-slate-100 bg-white p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3">
              <button className="p-2 text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about urban data..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none resize-none"
                style={{ minHeight: 24, maxHeight: 120 }}
              />
              <button className="p-2 text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeWidth="2"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="12" y1="19" x2="12" y2="23" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-9 h-9 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <line x1="22" y1="2" x2="11" y2="13" strokeWidth="2" strokeLinecap="round"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2" strokeWidth="2" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Bottom actions */}
            <div className="flex justify-center gap-6 mt-3">
              {['DRAFT REPORT', 'EXPORT DATASET', 'CLEAR THREAD'].map((action) => (
                <button
                  key={action}
                  onClick={action === 'CLEAR THREAD' ? () => setMessages([]) : undefined}
                  className="text-xs text-slate-400 hover:text-slate-700 font-semibold tracking-wide transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
