import { useState } from 'react';
import { ai } from '../api/client';

export default function Assistant() {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<Array<{ role: 'user' | 'bot'; text: string }>>([]);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const msg = message.trim();
    if (!msg) return;
    setHistory((h) => [...h, { role: 'user', text: msg }]);
    setMessage('');
    setLoading(true);
    try {
      const r = await ai.chat(msg);
      setHistory((h) => [...h, { role: 'bot', text: r.reply }]);
    } catch (e: unknown) {
      setHistory((h) => [...h, { role: 'bot', text: (e instanceof Error ? e.message : 'Something went wrong.') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Help</h1>
        <p className="mt-1 text-sm text-slate-400">Ask about products, orders, or get suggestions</p>
      </div>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm card-3d">
        <div className="p-4 min-h-[260px] max-h-[400px] overflow-y-auto bg-slate-900/50">
          {history.length === 0 ? (
            <p className="text-slate-400 text-sm">Try: &quot;Suggest products&quot; or &quot;What are my orders?&quot;</p>
          ) : (
            <div className="space-y-3">
              {history.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <span className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-white text-black' : 'bg-gray-700 border border-gray-600 text-gray-200 shadow-sm'}`}>
                    {m.text}
                  </span>
                </div>
              ))}
            </div>
          )}
          {loading && <p className="mt-2 text-slate-400 text-sm">Thinking...</p>}
        </div>
        <div className="p-4 border-t border-slate-700 flex gap-2 bg-slate-800">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Type your question..."
            className="input-store flex-1"
          />
          <button type="button" onClick={send} disabled={loading} className="btn-store shrink-0 px-5 btn-3d">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
