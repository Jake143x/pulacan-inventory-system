import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orders, products } from '../../api/client';
import type { Product } from '../../api/client';

export default function CustomerDashboard() {
  const [orderCounts, setOrderCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([
      orders.list().then((r) => {
        const data = r.data;
        return {
          pending: data.filter((o) => o.status === 'PENDING_APPROVAL').length,
          approved: data.filter((o) => o.status === 'APPROVED').length,
          rejected: data.filter((o) => o.status === 'REJECTED').length,
        };
      }),
      products.list({ limit: 5 }).then((r) => r.data).catch(() => []),
    ])
      .then(([counts, list]) => {
        setOrderCounts(counts);
        setSuggestions(list);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading dashboard...</div>;
  if (err) return <p className="text-gray-300">{err}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Customer Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pending orders</p>
          <p className="text-2xl font-bold text-gray-300">{orderCounts.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Approved</p>
          <p className="text-2xl font-bold text-gray-300">{orderCounts.approved}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Rejected</p>
          <p className="text-2xl font-bold text-gray-300">{orderCounts.rejected}</p>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3">My orders</h2>
          <Link to="/orders" className="text-gray-300 hover:text-white underline">View order history →</Link>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3">Product suggestions</h2>
          <ul className="space-y-2">
            {suggestions.length === 0 ? (
              <li className="text-slate-500">No products yet.</li>
            ) : (
              suggestions.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="text-slate-600">${p.unitPrice.toFixed(2)}</span>
                </li>
              ))
            )}
          </ul>
          <p className="mt-2 text-sm text-slate-500">Browse all products from Orders / place order flow.</p>
        </div>
      </div>
    </div>
  );
}
