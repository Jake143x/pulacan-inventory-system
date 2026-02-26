import { useEffect, useState } from 'react';
import { notifications as notificationsApi } from '../api/client';
import type { Notification } from '../api/client';

const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };
const inputStyle = { ...cardBg, color: 'var(--admin-text)' };

const RISK_OPTIONS = ['', 'Critical', 'Low', 'Safe', 'Out of Stock', 'Overstock', 'No Data'];

function riskBadgeClass(riskLevel: string | null | undefined): string {
  if (!riskLevel) return 'bg-slate-500/20 text-slate-400';
  if (riskLevel === 'Critical' || riskLevel === 'Out of Stock') return 'bg-red-500/20 text-red-400';
  if (riskLevel === 'Low') return 'bg-amber-500/20 text-amber-400';
  if (riskLevel === 'Overstock') return 'bg-blue-500/20 text-blue-400';
  if (riskLevel === 'No Data') return 'bg-slate-500/20 text-slate-400';
  if (riskLevel === 'Safe') return 'bg-emerald-500/20 text-emerald-400';
  return 'bg-slate-500/20 text-slate-400';
}

export default function NotificationsPage() {
  const [list, setList] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [riskLevel, setRiskLevel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread'>('all');
  const [success, setSuccess] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    notificationsApi
      .list({
        page: pagination.page,
        limit: pagination.limit,
        riskLevel: riskLevel || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        unread: statusFilter === 'unread',
      })
      .then((r) => {
        setList(r.data);
        setPagination(r.pagination);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [pagination.page, riskLevel, startDate, endDate, statusFilter]);

  const markRead = (id: number) => {
    setErr('');
    notificationsApi
      .markRead(id)
      .then(() => {
        setList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        setSuccess('Marked as read.');
      })
      .catch((e) => setErr(e.message));
  };

  const markAllRead = () => {
    setErr('');
    notificationsApi
      .markAllRead()
      .then(() => {
        setList((prev) => prev.map((n) => ({ ...n, read: true })));
        setSuccess('All marked as read.');
      })
      .catch((e) => setErr(e.message));
  };

  const deleteOld = () => {
    if (!window.confirm('Delete all notifications older than 30 days?')) return;
    setErr('');
    notificationsApi
      .deleteOld()
      .then((r) => {
        setSuccess(`Deleted ${r.deleted} old notification(s).`);
        load();
      })
      .catch((e) => setErr(e.message));
  };

  return (
    <div>
      {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
      {success && <p className="text-green-400 text-sm mb-2">{success}</p>}

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select
          value={riskLevel}
          onChange={(e) => setRiskLevel(e.target.value)}
          className="px-3 py-2 border rounded-lg"
          style={inputStyle}
        >
          {RISK_OPTIONS.map((o) => (
            <option key={o || 'all'} value={o}>{o || 'All risk levels'}</option>
          ))}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 border rounded-lg"
          style={inputStyle}
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 border rounded-lg"
          style={inputStyle}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'unread')}
          className="px-3 py-2 border rounded-lg"
          style={inputStyle}
        >
          <option value="all">All</option>
          <option value="unread">Unread</option>
        </select>
        <button type="button" onClick={markAllRead} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] btn-3d">Mark all read</button>
        <button type="button" onClick={deleteOld} className="px-4 py-2 border rounded-lg" style={inputStyle}>Delete old (30+ days)</button>
      </div>

      <div className="rounded-xl border overflow-hidden card-3d overflow-x-auto" style={cardBg}>
        {loading ? (
          <p className="p-4 text-slate-400">Loading...</p>
        ) : (
          <table className="w-full text-left min-w-[700px]">
            <thead className="border-b" style={{ borderColor: 'var(--admin-border)' }}>
              <tr>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Type</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Product Name</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Message</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Risk Level</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Created At</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Status</th>
                <th className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--admin-border)' }}>
              {list.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No notifications.</td></tr>
              ) : (
                list.map((n) => (
                  <tr key={n.id}>
                    <td className="px-4 py-3 text-slate-300">{n.type}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--admin-text)' }}>{n.productName || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-sm max-w-xs truncate">{n.message}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${riskBadgeClass(n.riskLevel)}`}>{n.riskLevel || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">{new Date(n.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">{n.read ? <span className="text-slate-500">Read</span> : <span className="text-amber-400">Unread</span>}</td>
                    <td className="px-4 py-3">
                      {!n.read && (
                        <button type="button" onClick={() => markRead(n.id)} className="text-[#2563EB] hover:underline">Mark read</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        <div className="px-4 py-2 border-t flex justify-between items-center" style={{ borderColor: 'var(--admin-border)' }}>
          <span className="text-sm text-slate-400">Page {pagination.page} of {pagination.pages || 1} ({pagination.total} total)</span>
          <div className="gap-2 flex">
            <button type="button" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))} className="px-2 py-1 border rounded disabled:opacity-50" style={inputStyle}>Prev</button>
            <button type="button" disabled={pagination.page >= pagination.pages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} className="px-2 py-1 border rounded disabled:opacity-50" style={inputStyle}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
