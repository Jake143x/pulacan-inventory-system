import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { orders, products } from '../api/client';
import type { OnlineOrder, Product } from '../api/client';

export default function OrdersPage() {
  const { user } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';
  const [orderList, setOrderList] = useState<OnlineOrder[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showPlaceOrder, setShowPlaceOrder] = useState(false);
  const [productList, setProductList] = useState<Product[]>([]);
  const [cart, setCart] = useState<Array<{ product: Product; quantity: number }>>([]);
  const [placing, setPlacing] = useState(false);

  const load = () => {
    setLoading(true);
    orders.list({ page: pagination.page, limit: pagination.limit, status: statusFilter || undefined })
      .then((r) => {
        setOrderList(r.data);
        setPagination(r.pagination);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [pagination.page, statusFilter]);

  const openPlaceOrder = () => {
    setShowPlaceOrder(true);
    setCart([]);
    products.list({ limit: 50 }).then((r) => setProductList(r.data)).catch(() => {});
  };

  const addToCart = (p: Product, qty: number = 1) => {
    const inv = (p as Product & { inventory?: { quantity: number } }).inventory;
    const max = inv?.quantity ?? 0;
    const minQ = (p as Product).minOrderQuantity ?? 0;
    const step = (p as Product).quantityStep ?? 1;
    if ((p as Product).allowCustomQuantity && step > 0) {
      const remainder = Math.abs((qty / step) - Math.round(qty / step));
      if (remainder > 0.001) return;
    }
    if (qty < minQ) return;
    if (max < qty) return;
    setCart((c) => {
      const existing = c.find((x) => x.product.id === p.id);
      const newQty = (existing ? existing.quantity + qty : qty);
      if (existing) return c.map((x) => x.product.id === p.id ? { ...x, quantity: Math.min(newQty, max) } : x);
      return [...c, { product: p, quantity: Math.min(qty, max) }];
    });
  };

  const placeOrder = async () => {
    if (cart.length === 0) { setErr('Add at least one item'); return; }
    setPlacing(true);
    setErr('');
    try {
      await orders.create(cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })));
      setShowPlaceOrder(false);
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-4">{isCustomer ? 'My Orders' : 'Orders'}</h1>
      {err && <p className="text-neutral-300 text-sm mb-2">{err}</p>}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-black text-white border border-neutral-600 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
        >
          <option value="">All</option>
          <option value="PENDING_APPROVAL">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        {isCustomer && (
          <button type="button" onClick={openPlaceOrder} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] btn-3d">Place order</button>
        )}
      </div>
      <div className="bg-black rounded-xl border border-neutral-800 overflow-hidden card-3d">
        {loading ? (
          <p className="p-4 text-neutral-400">Loading...</p>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-neutral-900 border-b border-neutral-700">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">ID</th>
                {!isCustomer && <th className="px-4 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Customer</th>}
                <th className="px-4 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {orderList.map((o) => (
                <tr key={o.id} className="hover:bg-neutral-900/50">
                  <td className="px-4 py-3 font-medium text-white">#{o.id}</td>
                  {!isCustomer && <td className="px-4 py-3 text-neutral-300">{o.user?.fullName ?? '-'}</td>}
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-sm ${
                      o.status === 'APPROVED' ? 'bg-neutral-700 text-neutral-200' :
                      o.status === 'REJECTED' ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-700/80 text-neutral-300'
                    }`}>{o.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-200">₱{o.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-neutral-400 text-sm">{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-4 py-3 border-t border-neutral-800 flex justify-between items-center bg-black">
          <span className="text-sm text-neutral-400">Page {pagination.page} of {pagination.pages || 1}</span>
          <div className="gap-2 flex">
            <button type="button" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))} className="px-3 py-1.5 text-sm font-medium text-neutral-300 bg-neutral-800 border border-neutral-600 rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed">Prev</button>
            <button type="button" disabled={pagination.page >= pagination.pages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} className="px-3 py-1.5 text-sm font-medium text-neutral-300 bg-neutral-800 border border-neutral-600 rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      </div>

      {showPlaceOrder && isCustomer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-neutral-700 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-auto shadow-xl card-3d">
            <h2 className="font-semibold text-lg text-white mb-4">Place order (Pending Approval)</h2>
            <div className="grid grid-cols-2 gap-2 mb-4 max-h-48 overflow-auto">
              {productList.map((p) => {
                const inv = (p as Product & { inventory?: { quantity: number } }).inventory;
                const stock = inv?.quantity ?? 0;
                const allowCustom = (p as Product).allowCustomQuantity;
                const unit = (p as Product).saleUnit || 'piece';
                const minQ = (p as Product).minOrderQuantity ?? 0;
                const step = (p as Product).quantityStep ?? 0.5;
                if (allowCustom) {
                  return (
                    <div key={p.id} className="p-2 bg-neutral-800 border border-neutral-600 rounded-lg flex flex-col gap-1">
                      <span className="text-sm text-neutral-200">{p.name} · ₱{p.unitPrice.toFixed(2)}/{unit} ({stock})</span>
                      <div className="flex gap-1 items-center">
                        <input type="number" min={minQ} step={step} defaultValue={minQ || step} className="w-16 py-1 px-2 rounded border border-neutral-600 bg-neutral-900 text-neutral-200 text-sm" id={`qty-${p.id}`} />
                        <span className="text-xs text-neutral-500">{unit}</span>
                        <button type="button" onClick={() => { const el = document.getElementById(`qty-${p.id}`) as HTMLInputElement; const n = Number(el?.value); if (Number.isFinite(n) && n > 0) addToCart(p, n); }} disabled={stock === 0} className="py-1 px-2 text-sm bg-[#2563EB] text-white rounded hover:bg-[#1D4ED8] disabled:opacity-50">Add</button>
                      </div>
                    </div>
                  );
                }
                return (
                  <button key={p.id} type="button" onClick={() => addToCart(p)} disabled={stock === 0} className="p-2 bg-neutral-800 border border-neutral-600 rounded-lg text-left text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-50">
                    {p.name} · ₱{p.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })} ({stock})
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-neutral-400 mb-2">Cart: {cart.map((i) => `${i.product.name}×${i.quantity % 1 === 0 ? i.quantity : i.quantity.toFixed(2)}`).join(', ') || 'Empty'}</p>
            <p className="text-sm text-neutral-400 mb-4">Order will be Pending until staff approves. Stock is not deducted until approval.</p>
            <div className="flex gap-2">
              <button type="button" onClick={placeOrder} disabled={cart.length === 0 || placing} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] disabled:opacity-50 btn-3d">Place order</button>
              <button type="button" onClick={() => setShowPlaceOrder(false)} className="px-4 py-2 bg-neutral-800 text-neutral-200 border border-neutral-600 rounded-lg hover:bg-neutral-700">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
