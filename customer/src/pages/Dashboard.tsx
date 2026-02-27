import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { notifications, orders, products } from '../api/client';
import type { Notification as NotificationType, Product } from '../api/client';
import { resolveImageUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import ProductImagePlaceholder from '../components/ProductImagePlaceholder';

const CURRENCY = '₱';

const CARD_CLASS = 'rounded-2xl border-0 bg-white shadow-md hover:shadow-lg transition-shadow overflow-hidden flex flex-col';
const CARD_RADIUS = { borderRadius: 16 };

const ORDER_CARDS = [
  { key: 'PENDING_APPROVAL', label: 'Pending Payment', ordersLabel: 'Orders', borderTop: '4px solid #EAB308', icon: '🟡' },
  { key: 'processing', label: 'Processing', ordersLabel: 'Order', borderTop: '4px solid var(--customer-primary)', icon: '🔵' },
  { key: 'APPROVED', label: 'Completed', ordersLabel: 'Orders', borderTop: '4px solid #16A34A', icon: '🟢' },
  { key: 'REJECTED', label: 'Cancelled', ordersLabel: 'Orders', borderTop: '4px solid #DC2626', icon: '🔴' },
] as const;

export default function Dashboard() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const [orderCounts, setOrderCounts] = useState({ PENDING_APPROVAL: 0, processing: 0, APPROVED: 0, REJECTED: 0 });
  const [featured, setFeatured] = useState<Product[]>([]);
  const [notificationList, setNotificationList] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([
      orders.list({ limit: 500 }).then((r) => {
        const data = r.data;
        return {
          PENDING_APPROVAL: data.filter((o) => o.status === 'PENDING_APPROVAL').length,
          processing: 0,
          APPROVED: data.filter((o) => o.status === 'APPROVED').length,
          REJECTED: data.filter((o) => o.status === 'REJECTED').length,
        };
      }),
      products.list({ limit: 6 }).then((r) => r.data).catch(() => []),
      notifications.list({ limit: 10 }).then((r) => r.data).catch(() => []),
    ])
      .then(([counts, list, notifs]) => {
        setOrderCounts((prev) => ({ ...prev, ...counts }));
        setFeatured(list);
        setNotificationList(notifs);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  const handleMarkAsRead = (id: number) => {
    notifications.markAsRead(id).then(() => {
      setNotificationList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }).catch(() => {});
  };

  const firstName = user?.fullName?.split(/\s+/)[0] || 'there';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[280px]">
        <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-[var(--customer-primary)] animate-spin" />
      </div>
    );
  }
  if (err) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-6 text-slate-600 text-sm shadow-md">
        {err}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[90rem] mx-auto">
      <div className="glass-panel p-6 sm:p-8 space-y-8">
      {/* SECTION 1 — Welcome Banner (Hero) */}
      <section
        className="rounded-2xl px-6 py-10 text-center shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #BFDBFE 100%)',
          border: '1px solid rgba(37, 99, 235, 0.15)',
          ...CARD_RADIUS,
        }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Welcome back, {firstName} 👋
        </h1>
        <p className="mt-2 text-slate-600 text-sm sm:text-base">
          Manage your orders and activity easily.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Link
            to="/browse"
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white rounded-xl bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-hover)] transition-colors shadow-md hover:shadow-lg"
          >
            Browse Products
          </Link>
          <Link
            to="/orders"
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-slate-700 rounded-xl border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-colors"
          >
            View My Orders
          </Link>
        </div>
      </section>

      {/* SECTION 2 — Order Overview Cards (4 equal horizontal) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ORDER_CARDS.map((card) => {
          const count = orderCounts[card.key as keyof typeof orderCounts] ?? 0;
          const ordersLink = card.key === 'processing' ? '/orders' : `/orders?status=${card.key}`;
          return (
            <Link
              key={card.key}
              to={ordersLink}
              className={`${CARD_CLASS} p-5`}
              style={{ ...CARD_RADIUS, borderTop: card.borderTop }}
            >
              <p className="text-sm font-medium text-slate-600">{card.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{count}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {count === 1 ? '1 Order' : `${count} Orders`}
              </p>
            </Link>
          );
        })}
      </section>

      {/* SECTION 3 — Two Column: Notifications (40%) | Featured Products (60%) */}
      <section className="grid md:grid-cols-5 gap-6">
        {/* Left — Notifications (2/5 ≈ 40%) */}
        <div className="md:col-span-2">
          <div className={`${CARD_CLASS} p-5`} style={CARD_RADIUS}>
            <h2 className="text-base font-semibold text-slate-900">Notifications</h2>
            <div className="mt-3 min-h-[120px]">
              {notificationList.length === 0 ? (
                <p className="text-sm text-slate-500">You have no new notifications.</p>
              ) : (
                <ul className="space-y-2">
                  {notificationList.slice(0, 5).map((n) => (
                    <li key={n.id} className="flex gap-2 text-sm">
                      <span className="text-slate-400">•</span>
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(n.id)}
                        className="text-left text-slate-700 hover:text-slate-900 line-clamp-2"
                      >
                        {n.title || n.message}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right — Featured Products (3/5 ≈ 60%), only 3 products */}
        <div className="md:col-span-3">
          <div className={`${CARD_CLASS} p-5`} style={CARD_RADIUS}>
            <h2 className="text-base font-semibold text-slate-900">Featured Products</h2>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {featured.length === 0 ? (
                <p className="col-span-full text-sm text-slate-500 py-4">No featured products yet.</p>
              ) : (
                featured.map((p) => {
                  const stock = p.inventory?.quantity ?? 0;
                  const lowThreshold = p.inventory?.lowStockThreshold ?? 10;
                  const stockLabel = stock === 0 ? 'Out of Stock' : stock <= lowThreshold ? 'Low Stock' : 'In Stock';
                  const stockColor = stock === 0 ? 'text-red-600' : stock <= lowThreshold ? 'text-amber-600' : 'text-emerald-600';
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50 flex flex-col"
                    >
                      <Link
                        to={`/product/${p.id}`}
                        className="aspect-square flex items-center justify-center p-3 bg-white"
                      >
                        {p.imageUrl ? (
                          <img src={resolveImageUrl(p.imageUrl) ?? ''} alt={p.name} className="w-full h-full object-contain" />
                        ) : (
                          <ProductImagePlaceholder className="w-full h-full max-w-[100px] max-h-[100px]" />
                        )}
                      </Link>
                      <div className="p-3 flex flex-col flex-1 min-w-0">
                        <Link to={`/product/${p.id}`} className="group">
                          <h3 className="font-semibold text-sm text-slate-900 line-clamp-2 leading-tight group-hover:text-[var(--customer-primary)]">
                            {p.name}
                          </h3>
                        </Link>
                        <p className="mt-1 text-sm font-bold text-slate-900 tabular-nums">
                          {CURRENCY}{p.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                        <p className={`text-xs font-medium ${stockColor}`}>{stockLabel}</p>
                        <button
                          type="button"
                          onClick={() => addItem(p.id, { maxQuantity: stock })}
                          disabled={stock === 0}
                          className="mt-2 w-full py-2 rounded-xl text-sm font-semibold text-white bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
