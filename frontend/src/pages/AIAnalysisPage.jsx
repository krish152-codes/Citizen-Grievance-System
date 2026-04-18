import React, { useState, useRef, useEffect } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { useAuth } from '../context/AuthContext';
import { aiAPI, analyticsAPI } from '../services/api';
import { getInitials } from '../utils/helpers';

const QUICK_PROMPTS = [
  'What are the most common issue categories?',
  'Which issues need urgent attention?',
  'Summarize this week\'s resolution performance',
  'What departments have the most open tickets?',
];

export default function AIAnalysisPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyticsContext, setAnalyticsContext] = useState(null);
  const bottomRef = useRef();
  const inputRef = useRef();

  // Load real analytics context so AI responses are grounded in real data
  useEffect(() => {
    analyticsAPI.getSummary()
      .then(({ data }) => setAnalyticsContext(data.data?.overview))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildContextualResponse = (query, result, ctx) => {
    const q = query.toLowerCase();
    const totalIssues = ctx?.totalIssues ?? 0;
    const activeIssues = ctx?.activeIssues ?? 0;
    const resolved = ctx?.resolvedIssues ?? 0;
    const rate = ctx?.resolutionRate ?? 0;

    if (totalIssues === 0) {
      return 'No issue data found in the database yet. Once citizens start submitting reports through the platform, I\'ll be able to provide meaningful analysis. Try submitting a test report first.';
    }

    if (q.includes('common') || q.includes('categor')) {
      return `Based on ${totalIssues} total complaints in the database, the AI has classified them across multiple categories. The classification engine detected this report as "${result.category}" — which helps understand the distribution. Navigate to Analytics for a full category breakdown chart.`;
    }
    if (q.includes('urgent') || q.includes('attention') || q.includes('priorit')) {
      return `Currently there are ${activeIssues} active issues in the system. ${
        activeIssues > 0
          ? `These need departmental attention. Critical and high-priority issues are highlighted in the Issue Logs page — I recommend sorting by priority to address them first.`
          : 'All issues are currently resolved or on hold. The system is in good standing.'
      }`;
    }
    if (q.includes('resolution') || q.includes('performance') || q.includes('week')) {
      return `Current resolution rate stands at ${rate}%. Out of ${totalIssues} total complaints, ${resolved} have been resolved and ${activeIssues} are still active. ${
        rate >= 70 ? 'Performance is strong.' : rate >= 40 ? 'There is room for improvement.' : 'Resolution rate needs attention — consider assigning more resources to open tickets.'
      }`;
    }
    if (q.includes('department')) {
      return `Departments are handling ${activeIssues} active issues between them. Check the Analytics page for a per-department breakdown showing issue counts and resolution rates. You can also reassign issues to departments from the Issue Detail page.`;
    }

    // Generic response grounded in real data
    return `I analyzed your query against the current database (${totalIssues} total issues, ${activeIssues} active, ${rate}% resolution rate). The AI classified your input as "${result.category}" with ${Math.round(result.confidence * 100)}% confidence. For deeper insights, check the Analytics dashboard or browse the Issue Logs directly.`;
  };

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText) return;

    const userMsg = { id: Date.now(), role: 'user', content: userText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await aiAPI.classify(userText);
      const result = data.result;
      const response = buildContextualResponse(userText, result, analyticsContext);

      const tags = [];
      if (result.category) tags.push(result.category.toUpperCase().replace(/_/g,' '));
      if (result.priority && result.priority !== 'medium') tags.push(result.priority.toUpperCase() + ' PRIORITY');

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: response,
        tags,
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'I could not process your request. Please make sure the backend server is running at http://localhost:5000.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmptyState = messages.length === 0;
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <AdminLayout>
      <div className="flex flex-col h-full">

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-8">

          {/* Empty / greeting state */}
          {isEmptyState && (
            <div className="text-center mb-10 animate-slide-up max-w-2xl mx-auto">
              <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🧠</span>
              </div>
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-2">
                Hello, {firstName}.
              </h2>
              <p className="text-slate-500 mb-2">
                Ask me anything about your city's issue data.
              </p>
              {analyticsContext ? (
                <p className="text-xs text-green-600 font-semibold bg-green-50 border border-green-200 rounded-full px-4 py-1.5 inline-block mb-6">
                  ✓ Connected to database · {analyticsContext.totalIssues} issues loaded
                </p>
              ) : (
                <p className="text-xs text-slate-400 bg-slate-100 rounded-full px-4 py-1.5 inline-block mb-6">
                  Connecting to database…
                </p>
              )}

              {/* Quick prompts */}
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map(p => (
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
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-4 animate-fade-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                  msg.role === 'user' ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'
                }`}>
                  {msg.role === 'user' ? getInitials(user?.name || 'U') : '✨'}
                </div>
                <div className={`flex-1 ${msg.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                  <div className={`rounded-2xl p-4 max-w-lg ${
                    msg.role === 'user'
                      ? 'bg-brand-600 text-white rounded-tr-sm'
                      : 'bg-white border border-slate-100 shadow-sm rounded-tl-sm'
                  }`}>
                    <p className={`text-sm leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
                      {msg.content}
                    </p>
                  </div>
                  {msg.tags?.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {msg.tags.map(tag => (
                        <span key={tag} className="badge bg-brand-50 text-brand-700 border border-brand-200 text-[10px] font-bold">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div className="flex gap-4 animate-fade-in">
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-sm">✨</div>
                <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-sm p-4">
                  <div className="flex gap-1">
                    {[0, 150, 300].map(delay => (
                      <div key={delay} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
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
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your city's issue data…"
                rows={1}
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none resize-none"
                style={{ minHeight: 24, maxHeight: 120 }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-9 h-9 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <line x1="22" y1="2" x2="11" y2="13" strokeWidth="2" strokeLinecap="round"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2" strokeWidth="2" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="flex justify-center gap-6 mt-3">
              {['Export Chat', 'Clear Thread'].map(action => (
                <button
                  key={action}
                  onClick={action === 'Clear Thread' ? () => setMessages([]) : undefined}
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
