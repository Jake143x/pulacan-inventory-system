import { useState, useEffect, useRef, useCallback } from 'react';
import { chat, type ChatSession, type ChatMessage } from '../api/client';

const POLL_INTERVAL_MS = 2000;

type CustomerOption = { id: number; fullName: string; email: string };

export default function LiveChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sessionDetail, setSessionDetail] = useState<{ customer?: { fullName: string; email: string }; messages: ChatMessage[] } | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const { data } = await chat.listSessions({ status: 'open' });
      setSessions(data || []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const { data } = await chat.listCustomers();
      setCustomers(data || []);
    } catch {
      setCustomers([]);
    }
  }, []);

  const fetchSessionDetail = useCallback(async (id: number) => {
    try {
      const s = await chat.getSession(id);
      setSessionDetail({ customer: s.customer, messages: s.messages || [] });
    } catch {
      setSessionDetail(null);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchCustomers();
  }, [fetchSessions, fetchCustomers]);

  useEffect(() => {
    if (!selectedId) {
      setSessionDetail(null);
      return;
    }
    fetchSessionDetail(selectedId);
    const t = setInterval(() => fetchSessionDetail(selectedId), POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [selectedId, fetchSessionDetail]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [sessionDetail?.messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if ((!msg && !attachedImageUrl) || !selectedId || sending) return;
    setInput('');
    const imageToSend = attachedImageUrl;
    setAttachedImageUrl(null);
    setSending(true);
    try {
      const created = await chat.sendMessage(selectedId, msg || '', 'cashier', imageToSend);
      setSessionDetail((prev) => (prev ? { ...prev, messages: [...(prev.messages || []), created] } : null));
    } catch {
      setInput(msg);
      if (imageToSend) setAttachedImageUrl(imageToSend);
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
    if (!file || !selectedId || uploadingImage) return;
    if (!file.type.startsWith('image/')) return;
    setUploadingImage(true);
    try {
      const { url } = await chat.uploadImage(selectedId, file);
      setAttachedImageUrl(url);
    } catch {
      // ignore
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCloseSession = async () => {
    if (!selectedId) return;
    try {
      await chat.closeSession(selectedId);
      setSelectedId(null);
      setSessionDetail(null);
      fetchSessions();
    } catch {
      // ignore
    }
  };

  const handleStartLiveInquiry = async () => {
    if (selectedCustomerId == null || starting) return;
    setStarting(true);
    try {
      const session = await chat.createSessionForCustomer(selectedCustomerId);
      await fetchSessions();
      setSelectedId(session.id);
      setSelectedCustomerId(null);
      fetchSessionDetail(session.id);
    } catch {
      // leave selectedCustomerId so user can retry
    } finally {
      setStarting(false);
    }
  };

  const selectedSession = sessions.find((s) => s.id === selectedId);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--admin-text)' }}>
        Live chat with customers
      </h1>
      <p className="text-sm" style={{ color: 'var(--admin-muted)' }}>
        Customers who click &quot;Connect to cashier for inquiry&quot; in the AI assistant appear here. You can also start a live inquiry with a customer below. Reply in the thread; they see messages in real time.
      </p>

      <div
        className="rounded-xl border p-4 flex flex-wrap items-end gap-3"
        style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}
      >
        <span className="font-medium text-sm" style={{ color: 'var(--admin-text)' }}>
          Start live inquiry for customer:
        </span>
        <select
          value={selectedCustomerId ?? ''}
          onChange={(e) => setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2 rounded-lg border text-sm min-w-[200px]"
          style={{ backgroundColor: 'var(--admin-bg)', borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
        >
          <option value="">Select customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName} ({c.email})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleStartLiveInquiry}
          disabled={!selectedCustomerId || starting}
          className="px-4 py-2 rounded-lg font-medium text-white shrink-0 transition-colors disabled:opacity-50"
          style={{ backgroundColor: 'var(--admin-primary)' }}
        >
          {starting ? 'Starting…' : 'Start chat'}
        </button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0" style={{ minHeight: '400px' }}>
        <div
          className="w-72 shrink-0 rounded-xl border overflow-hidden flex flex-col"
          style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}
        >
          <div className="px-3 py-2 border-b font-medium text-sm" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>
            Active sessions
          </div>
          {loading ? (
            <div className="p-4 text-sm" style={{ color: 'var(--admin-muted)' }}>
              Loading…
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: 'var(--admin-muted)' }}>
              No open chats. Waiting for customers to connect.
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full text-left px-3 py-2.5 border-b text-sm transition-colors ${selectedId === s.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
                  >
                    <span className="font-medium">#{s.id}</span>
                    {s.customer && (
                      <span className="block truncate mt-0.5" style={{ color: 'var(--admin-muted)' }}>
                        {s.customer.fullName}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="flex-1 min-w-0 rounded-xl border flex flex-col"
          style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}
        >
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--admin-muted)' }}>
              Select a session to view and reply
            </div>
          ) : (
            <>
              <div className="px-4 py-2 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--admin-border)' }}>
                <div>
                  <span className="font-medium" style={{ color: 'var(--admin-text)' }}>
                    Session #{selectedId}
                    {selectedSession?.customer && ` — ${selectedSession.customer.fullName}`}
                  </span>
                  {sessionDetail?.customer?.email && (
                    <span className="block text-xs" style={{ color: 'var(--admin-muted)' }}>
                      {sessionDetail.customer.email}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCloseSession}
                  className="text-sm px-3 py-1.5 rounded-lg border hover:bg-white/5 transition-colors"
                  style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted)' }}
                >
                  Close session
                </button>
              </div>

              <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                {sessionDetail?.messages?.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--admin-muted)' }}>
                    No messages yet. Say hello or ask how you can help.
                  </p>
                )}
                {sessionDetail?.messages?.map((m) => (
                  <div
                    key={m.id}
                    className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${m.senderType === 'cashier' ? 'ml-auto bg-[var(--admin-primary)]/20 border border-[var(--admin-primary)]/30' : 'bg-white/5 border'}`}
                    style={{ borderColor: m.senderType === 'cashier' ? undefined : 'var(--admin-border)', color: 'var(--admin-text)' }}
                  >
                    <span className="font-medium text-xs" style={{ color: 'var(--admin-muted)' }}>
                      {m.senderType === 'customer' ? 'Customer' : 'You'}:
                    </span>{' '}
                    {m.imageUrl && (
                      <a href={m.imageUrl} target="_blank" rel="noopener noreferrer" className="block mt-1">
                        <img src={m.imageUrl} alt="Chat attachment" className="max-w-full max-h-48 rounded object-contain" />
                      </a>
                    )}
                    {m.message && <span className="whitespace-pre-wrap break-words">{m.message}</span>}
                  </div>
                ))}
                {sending && (
                  <div className="text-sm rounded-lg px-3 py-2 ml-auto max-w-[85%] bg-[var(--admin-primary)]/20" style={{ color: 'var(--admin-muted)' }}>
                    Sending…
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="p-3 border-t shrink-0 flex flex-col gap-2" style={{ borderColor: 'var(--admin-border)' }}>
                {attachedImageUrl && (
                  <div className="flex items-center gap-2">
                    <img src={attachedImageUrl} alt="Attached" className="h-12 w-12 rounded object-cover" />
                    <span className="text-xs" style={{ color: 'var(--admin-muted)' }}>Image attached</span>
                    <button type="button" onClick={() => setAttachedImageUrl(null)} className="text-xs text-red-400 hover:underline">Remove</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={handleAttachImage}
                    disabled={!selectedId || sending || uploadingImage}
                    className="p-2 rounded-lg border shrink-0 transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
                    title="Add image"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </button>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-[var(--admin-primary)]/40"
                    style={{ backgroundColor: 'var(--admin-bg)', borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
                  />
                  <button
                    type="submit"
                    disabled={sending || (!input.trim() && !attachedImageUrl)}
                    className="px-4 py-2 rounded-lg font-medium text-white shrink-0 transition-colors disabled:opacity-50"
                    style={{ backgroundColor: 'var(--admin-primary)' }}
                  >
                    Send
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
