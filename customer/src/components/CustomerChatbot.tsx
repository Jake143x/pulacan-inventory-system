import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ai, chat, resolveImageUrl, type ChatMessage as ChatMessageType } from '../api/client';

type Message = { role: 'user' | 'assistant'; text: string };

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

const AI_INTRO = 'Ask anything — the AI reads our live database and can answer product prices, stock, order status, shipping, and payment. Or connect to a cashier for personal help.';

const POLL_INTERVAL_MS = 2000;

export default function CustomerChatbot() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'ai' | 'live'>('ai');
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveSessionId, setLiveSessionId] = useState<number | null>(null);
  const [liveMessages, setLiveMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [connectErrorAuth, setConnectErrorAuth] = useState(false);
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLiveMessages = useCallback(async () => {
    if (!liveSessionId) return;
    try {
      const session = await chat.getSession(liveSessionId);
      setLiveMessages(session.messages || []);
    } catch {
      // ignore
    }
  }, [liveSessionId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, liveMessages]);

  useEffect(() => {
    if (mode !== 'live' || !liveSessionId) return;
    fetchLiveMessages();
    const t = setInterval(fetchLiveMessages, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [mode, liveSessionId, fetchLiveMessages]);

  // When customer opens the panel, check for an existing open session (e.g. started by cashier) and auto-switch to live
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await chat.listSessions({ status: 'open' });
        if (cancelled || !data?.length) return;
        const first = data[0];
        if (first && first.status === 'open') {
          setLiveSessionId(first.id);
          setMode('live');
          setLiveMessages([]);
          setMessages([]);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const sendAi = async (text: string) => {
    const msg = text.trim();
    if (!msg || sending) return;
    setConnectErrorAuth(false);
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

  const connectToCashier = async () => {
    if (sending) return;
    setSending(true);
    try {
      const session = await chat.createSession();
      setLiveSessionId(session.id);
      setMode('live');
      setMessages([]);
      setLiveMessages([]);
      setInput('');
      fetchLiveMessages();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isAuthError =
        /authentication required|invalid or expired token|user not found or inactive|unauthorized/i.test(msg);
      if (isAuthError) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: 'Please log in again to connect to a cashier. Your session may have expired.',
          },
        ]);
        setConnectErrorAuth(true);
      } else {
        setMessages((m) => [
          ...m,
          { role: 'assistant', text: msg || 'Could not start live chat. Please try again.' },
        ]);
      }
    } finally {
      setSending(false);
    }
  };

  const sendLive = async (text: string, imageUrl?: string | null) => {
    const msg = text.trim();
    const imgToSend = imageUrl ?? attachedImageUrl;
    if ((!msg && !imgToSend) || !liveSessionId || sending) return;
    setSendError(null);
    setInput('');
    setAttachedImageUrl(null);
    setSending(true);
    // Show message immediately (optimistic)
    const tempId = Date.now();
    const optimistic: ChatMessageType = {
      id: tempId,
      sessionId: liveSessionId,
      senderType: 'customer',
      message: msg || '(image)',
      imageUrl: imgToSend || undefined,
      createdAt: new Date().toISOString(),
    };
    setLiveMessages((prev) => [...prev, optimistic]);
    try {
      const created = await chat.sendMessage(liveSessionId, msg, 'customer', imgToSend);
      setLiveMessages((prev) => prev.map((m) => (m.id === tempId ? created : m)));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Send failed';
      setSendError(errMsg);
      setLiveMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, message: (msg || 'Image') + ' (failed to send)' } : m)));
      if (msg) setInput(msg);
      if (imgToSend) setAttachedImageUrl(imgToSend);
    } finally {
      setSending(false);
    }
  };

  const handleAttachImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setUploadError(null);
    if (!file || !liveSessionId || uploadingImage) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image (JPEG, PNG, GIF or WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5MB.');
      return;
    }
    setUploadingImage(true);
    try {
      const { url } = await chat.uploadImage(liveSessionId, file);
      setAttachedImageUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Image upload failed. Try again.';
      setUploadError(msg);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    const hasContent = !!msg || !!attachedImageUrl;
    if (!hasContent) return;
    if (mode === 'live') {
      if (!liveSessionId) {
        setSendError('Not connected. Please wait or reconnect.');
        return;
      }
      sendLive(msg, attachedImageUrl);
      return;
    }
    if (msg.toLowerCase().includes('connect to cashier') || msg.toLowerCase() === 'connect to cashier') {
      connectToCashier();
      return;
    }
    sendAi(msg);
  };

  const handleQuickAction = (s: string) => {
    if (s === CONNECT_TO_CASHIER_MESSAGE || s.toLowerCase().includes('connect to cashier')) {
      connectToCashier();
      return;
    }
    sendAi(s);
  };

  const closePanel = () => {
    setOpen(false);
    setConnectErrorAuth(false);
    setUploadError(null);
    setSendError(null);
    if (mode === 'live') {
      setMode('ai');
      setLiveSessionId(null);
      setLiveMessages([]);
    }
    setMessages([]);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-hover)] transition-colors"
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] flex flex-col rounded-2xl border shadow-xl overflow-hidden"
          style={{ backgroundColor: 'var(--customer-card)', borderColor: 'var(--customer-border)', maxHeight: 'min(420px, 70vh)' }}
        >
          <div className="px-3 py-2 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--customer-border)' }}>
            <span className="font-semibold text-sm" style={{ color: 'var(--customer-text)' }}>
              {mode === 'live' ? 'Live chat with cashier' : 'AI Assistant'}
            </span>
            <button type="button" onClick={closePanel} className="p-1 rounded text-slate-400 hover:bg-slate-100" style={{ color: 'var(--customer-text-muted)' }} aria-label="Close">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2" style={{ minHeight: '120px', color: 'var(--customer-text)' }}>
            {mode === 'ai' && (
              <>
                {messages.length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--customer-text-muted)' }}>
                    {AI_INTRO}
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
                {connectErrorAuth && (
                  <button
                    type="button"
                    onClick={() => { setConnectErrorAuth(false); navigate('/login'); }}
                    className="text-sm font-medium px-3 py-2 rounded-xl border-2 border-[var(--customer-primary)] text-[var(--customer-primary)] hover:bg-[var(--customer-primary-light)] transition-colors"
                  >
                    Go to login
                  </button>
                )}
                {sending && mode === 'ai' && (
                  <div className="text-sm rounded-lg px-3 py-2 bg-slate-100 text-slate-500">...</div>
                )}
              </>
            )}

            {mode === 'live' && (
              <>
                {liveMessages.length === 0 && !sending && (
                  <p className="text-xs" style={{ color: 'var(--customer-text-muted)' }}>
                    You are connected. A cashier will reply shortly. Type your question below.
                  </p>
                )}
                {liveMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`text-sm rounded-lg px-3 py-2 max-w-[90%] ${m.senderType === 'customer' ? 'ml-auto bg-[var(--customer-primary)] text-white' : 'bg-slate-100 text-slate-800 border border-slate-200'}`}
                  >
                    <span className="font-medium text-xs opacity-80">{m.senderType === 'customer' ? 'You' : 'Cashier'}: </span>
                    {m.imageUrl && (
                      <a href={resolveImageUrl(m.imageUrl) ?? m.imageUrl} target="_blank" rel="noopener noreferrer" className="block mt-1">
                        <img src={resolveImageUrl(m.imageUrl) ?? m.imageUrl} alt="Chat attachment" className="max-w-full max-h-40 rounded object-contain" />
                      </a>
                    )}
                    {m.message && <span className="whitespace-pre-wrap break-words">{m.message}</span>}
                  </div>
                ))}
                {sending && mode === 'live' && (
                  <div className="text-sm rounded-lg px-3 py-2 ml-auto max-w-[90%] bg-[var(--customer-primary)] text-white opacity-80">Sending...</div>
                )}
                {mode === 'live' && uploadError && (
                  <p className="text-xs text-red-500 px-1">{uploadError}</p>
                )}
                {mode === 'live' && sendError && (
                  <p className="text-xs text-red-500 px-1">{sendError}</p>
                )}
              </>
            )}
          </div>

          <div className="p-2 border-t shrink-0" style={{ borderColor: 'var(--customer-border)' }}>
            {mode === 'ai' && (
              <>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {BASIC_QUERIES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleQuickAction(s)}
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
                  onClick={connectToCashier}
                  disabled={sending}
                  className="w-full mb-2 text-sm font-medium px-3 py-2 rounded-xl border-2 border-[var(--customer-primary)] text-[var(--customer-primary)] hover:bg-[var(--customer-primary-light)] disabled:opacity-50 transition-colors"
                >
                  {CONNECT_TO_CASHIER_LABEL}
                </button>
                <p className="text-xs mb-1" style={{ color: 'var(--customer-text-muted)' }}>
                  Or type any product name (e.g. cement, lumber) for instant price and stock from our database.
                </p>
              </>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {mode === 'live' && (
                <button
                  type="button"
                  onClick={handleAttachImage}
                  disabled={sending || uploadingImage}
                  className="p-2 rounded-xl border shrink-0 transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--customer-border)', color: 'var(--customer-text)' }}
                  title="Add image"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>
              )}
              {mode === 'live' && attachedImageUrl && (
                <div className="flex items-center gap-1 shrink-0">
                  <img src={attachedImageUrl} alt="Attached" className="h-8 w-8 rounded object-cover" />
                  <button type="button" onClick={() => { setAttachedImageUrl(null); setUploadError(null); }} className="text-xs text-slate-500 hover:underline">×</button>
                </div>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={mode === 'live' ? 'Type your message...' : 'Ask...'}
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-[var(--customer-primary)]/40"
                style={{ backgroundColor: 'var(--customer-card)', borderColor: 'var(--customer-border)', color: 'var(--customer-text)' }}
              />
              <button
                type="submit"
                disabled={sending || (mode === 'live' ? !input.trim() && !attachedImageUrl : !input.trim())}
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
