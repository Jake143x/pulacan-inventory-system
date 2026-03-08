import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orders } from '../api/client';
import type { OnlineOrder } from '../api/client';

const CURRENCY = '₱';

const STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: 'Pending Payment',
  APPROVED: 'Completed',
  REJECTED: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFromUrl = searchParams.get('status') || '';
  const [list, setList] = useState<OnlineOrder[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState(statusFromUrl);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setStatusFilter(statusFromUrl);
  }, [statusFromUrl]);

  useEffect(() => {
    setLoading(true);
    orders.list({ page, limit: 10, status: statusFilter || undefined })
      .then((r) => {
        setList(r.data);
        setPages(r.pagination.pages || 1);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
    if (value) setSearchParams({ status: value });
    else setSearchParams({});
  };

  const handleDeleteOrder = (id: number) => {
    if (!window.confirm('Remove this order from your list? This cannot be undone.')) return;
    orders.delete(id).then(() => {
      setList((prev) => prev.filter((o) => o.id !== id));
    }).catch(() => {});
  };

  const paymentLabel = (method: string | null | undefined) => {
    if (!method) return '—';
    if (method === 'GCASH') return 'GCash';
    if (method === 'DEBIT_CARD') return 'Debit Card';
    if (method === 'CASH_ON_DELIVERY') return 'Cash on Delivery';
    return method;
  };

  const statusDisplay = (status: string) => STATUS_LABELS[status] || status.replace('_', ' ');
  const statusStyle = (status: string) => STATUS_COLORS[status] || 'bg-slate-100 text-slate-700';

  return (
    <div className="w-full max-w-[90rem] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--customer-text)' }}>My Orders</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--customer-text-muted)' }}>View and filter your order history</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="w-full sm:w-auto sm:min-w-[200px] h-11 sm:h-12 px-4 rounded-xl border bg-white focus:ring-2 focus:ring-[var(--customer-primary)]/30 transition-colors"
          style={{ borderColor: 'var(--customer-border)', color: 'var(--customer-text)' }}
        >
          <option value="">All statuses</option>
          <option value="PENDING_APPROVAL">Pending Payment</option>
          <option value="APPROVED">Completed</option>
          <option value="REJECTED">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="py-16 sm:py-24 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--customer-border)', borderTopColor: 'var(--customer-primary)' }} />
          <span className="text-sm" style={{ color: 'var(--customer-text-muted)' }}>Loading orders...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border p-8 sm:p-12 text-center shadow-md content-card">
          <p className="font-medium" style={{ color: 'var(--customer-text)' }}>No orders yet</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--customer-text-muted)' }}>When you place an order, it will appear here.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border overflow-hidden shadow-md content-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[560px]">
                <thead>
                  <tr className="border-b bg-slate-50/80" style={{ borderColor: 'var(--customer-border)' }}>
                    <th className="px-4 sm:px-5 py-3 sm:py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--customer-text-muted)' }}>Order</th>
                    <th className="px-4 sm:px-5 py-3 sm:py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--customer-text-muted)' }}>Status</th>
                    <th className="px-4 sm:px-5 py-3 sm:py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--customer-text-muted)' }}>Payment</th>
                    <th className="px-4 sm:px-5 py-3 sm:py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--customer-text-muted)' }}>Total</th>
                    <th className="px-4 sm:px-5 py-3 sm:py-4 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: 'var(--customer-text-muted)' }}>Date</th>
                    <th className="px-4 sm:px-5 py-3 sm:py-4 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--customer-text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--customer-border)' }}>
                  {list.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 sm:px-5 py-3 sm:py-4 font-semibold" style={{ color: 'var(--customer-text)' }}>#{o.id}</td>
                      <td className="px-4 sm:px-5 py-3 sm:py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle(o.status)}`}>
                          {statusDisplay(o.status)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 sm:py-4 text-sm" style={{ color: 'var(--customer-text-muted)' }}>{paymentLabel(o.paymentMethod)}</td>
                      <td className="px-4 sm:px-5 py-3 sm:py-4 font-semibold tabular-nums" style={{ color: 'var(--customer-text)' }}>{CURRENCY}{o.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 sm:px-5 py-3 sm:py-4 text-sm hidden sm:table-cell" style={{ color: 'var(--customer-text-muted)' }}>{new Date(o.createdAt).toLocaleString()}</td>
                      <td className="px-4 sm:px-5 py-3 sm:py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(o.id)}
                          className="text-sm font-medium text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {pages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 rounded-xl text-sm font-medium border bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ borderColor: 'var(--customer-border)', color: 'var(--customer-text)' }}
              >
                « Previous
              </button>
              <span className="text-sm" style={{ color: 'var(--customer-text-muted)' }}>Page {page} of {pages}</span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-xl text-sm font-medium border bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ borderColor: 'var(--customer-border)', color: 'var(--customer-text)' }}
              >
                Next »
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
