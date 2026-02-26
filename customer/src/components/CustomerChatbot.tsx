import { useState, useRef, useEffect } from 'react';
import { ai } from '../api/client';

type Message = { role: 'user' | 'assistant'; text: string };

/** Basic queries for customers; last one connects to cashier (sends inquiry to staff). */
const BASIC_QUERIES = [
  'Where is my order?',
  'Price of Common Nails',
  'Do you have Hammer in stock?',
  'Shipping and delivery',
  'Payment options',
  'Help',
];

const CONNECT_TO_CASHIER_LABEL = 'Connect to cashier for inquiry';
const CONNECT_TO_CASHIER_MESSAGE = 'Connect to cashier';

export default function CustomerChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || sending) return;
    setMessages((m) => [...m, { role: 'user', text: msg }]);
    setInput('');
    setSending(true);
    try {
      const { reply } = await ai.chat(msg);
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Something went wrong. Try again.' }]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-hover)] transition-colors"
        aria-label={open ? 'Close chat' : 'Open AI assistant'}
      >
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="6" width="14" height="12" rx="3" fill="none" />
          <rect x="8" y="9" width="3" height="2.5" rx="0.5" fill="currentColor" />
          <rect x="13" y="9" width="3" height="2.5" rx="0.5" fill="currentColor" />
          <path d="M9.5 15h5" />
          <path d="M8 4l2 2" />
          <path d="M16 4l-2 2" />
          <circle cx="7" cy="3" r="1" fill="currentColor" />
          <circle cx="17" cy="3" r="1" fill="currentColor" />
          <rect x="10.5" y="2" width="3" height="2" rx="0.6" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] flex flex-col rounded-2xl border shadow-xl overflow-hidden"
          style={{ backgroundColor: 'var(--customer-card)', borderColor: 'var(--customer-border)', maxHeight: 'min(420px, 70vh)' }}
        >
          <div className="px-3 py-2 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--customer-border)' }}>
            <span className="font-semibold text-sm" style={{ color: 'var(--customer-text)' }}>AI Assistant</span>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded text-slate-400 hover:bg-slate-100" style={{ color: 'var(--customer-text-muted)' }} aria-label="Close">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2" style={{ minHeight: '120px', color: 'var(--customer-text)' }}>
            {messages.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--customer-text-muted)' }}>
                Ask about your order, product price & availability, shipping, or payment. You can also connect to a cashier for help.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm rounded-lg px-3 py-2 max-w-[90%] ${m.role === 'user' ? 'ml-auto bg-[var(--customer-primary)] text-white' : 'bg-slate-100 text-slate-800 border border-slate-200'}`}
              >
                <span className="whitespace-pre-wrap break-words">{m.text}</span>
              </div>
            ))}
            {sending && (
              <div className="text-sm rounded-lg px-3 py-2 bg-slate-100 text-slate-500">...</div>
            )}
          </div>

          <div className="p-2 border-t shrink-0" style={{ borderColor: 'var(--customer-border)' }}>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {BASIC_QUERIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={sending}
                  className="text-xs px-2.5 py-1.5 rounded-lg border hover:bg-slate-100 disabled:opacity-50 transition-colors"
                  style={{ borderColor: 'var(--customer-border)', color: 'var(--customer-text)' }}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => send(CONNECT_TO_CASHIER_MESSAGE)}
              disabled={sending}
              className="w-full mb-2 text-sm font-medium px-3 py-2 rounded-xl border-2 border-[var(--customer-primary)] text-[var(--customer-primary)] hover:bg-[var(--customer-primary-light)] disabled:opacity-50 transition-colors"
            >
              {CONNECT_TO_CASHIER_LABEL}
            </button>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask..."
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-[var(--customer-primary)]/40"
                style={{ backgroundColor: 'var(--customer-card)', borderColor: 'var(--customer-border)', color: 'var(--customer-text)' }}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="px-4 py-2 rounded-xl font-medium text-white bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-hover)] disabled:opacity-50 transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
