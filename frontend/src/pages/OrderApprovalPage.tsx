import { useEffect, useState } from 'react';
import { orders } from '../api/client';
import type { OnlineOrder } from '../api/client';

const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };

export default function OrderApprovalPage() {
  const [pending, setPending] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [processing, setProcessing] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    orders.pending()
      .then((r) => setPending(r.data))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    setProcessing(id);
    setErr('');
    try {
      await orders.approve(id, action);
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--admin-text)' }}>Approve orders</h1>
      {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : pending.length === 0 ? (
        <p className="text-slate-500">No pending orders.</p>
      ) : (
        <div className="space-y-4">
          {pending.map((o) => (
            <div key={o.id} className="rounded-2xl border p-5 card-3d" style={cardBg}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium" style={{ color: 'var(--admin-text)' }}>Order #{o.id}</p>
                  <p className="text-sm text-slate-400">{o.user?.fullName} · {o.user?.email}</p>
                  <p className="text-sm text-slate-500">{new Date(o.createdAt).toLocaleString()}</p>
                  {o.paymentMethod && (
                    <p className="text-sm text-slate-500 mt-0.5">
                      Payment: {o.paymentMethod === 'GCASH' ? 'GCash' : o.paymentMethod === 'DEBIT_CARD' ? 'Debit Card' : o.paymentMethod === 'CASH_ON_DELIVERY' ? 'Cash on Delivery' : o.paymentMethod}
                    </p>
                  )}
                </div>
                <p className="font-semibold tabular-nums" style={{ color: 'var(--admin-text)' }}>₱{o.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
              </div>
              <ul className="text-sm text-slate-400 mb-3">
                {o.items?.map((i, idx) => (
                  <li key={idx}>{i.product?.name ?? 'Product'} × {i.quantity} = ₱{i.subtotal?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) ?? '0.00'}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAction(o.id, 'approve')}
                  disabled={processing === o.id}
                  className="px-4 py-2 bg-[#2563EB] text-white rounded-xl hover:bg-[#1D4ED8] disabled:opacity-50 btn-3d"
                >
                  {processing === o.id ? '...' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(o.id, 'reject')}
                  disabled={processing === o.id}
                  className="px-4 py-2 rounded-xl border hover:bg-white/10 disabled:opacity-50 transition-colors"
                  style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
                >
                  Reject
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">Approve: inventory will be deducted. Reject: no deduction.</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
