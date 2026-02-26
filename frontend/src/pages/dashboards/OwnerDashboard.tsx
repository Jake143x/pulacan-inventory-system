import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reports, inventory, ai } from '../../api/client';

export default function OwnerDashboard() {
  const [salesSummary, setSalesSummary] = useState<{ totalRevenue: number; totalTransactions: number } | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [predictions, setPredictions] = useState<Array<{ product: { name: string }; riskOfStockout: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    Promise.all([
      reports.sales({ startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }).then((r) => r.summary),
      inventory.list().then((r) => r.lowStockCount),
      ai.predictions().then((r) => r.data.slice(0, 5)).catch(() => []),
    ])
      .then(([summary, low, preds]) => {
        setSalesSummary(summary);
        setLowStockCount(low);
        setPredictions(preds);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading dashboard...</div>;
  if (err) return <p className="text-gray-300">{err}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Owner Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Revenue (30d)</p>
          <p className="text-2xl font-bold text-slate-900">${salesSummary?.totalRevenue?.toFixed(2) ?? '0.00'}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Transactions (30d)</p>
          <p className="text-2xl font-bold text-slate-900">{salesSummary?.totalTransactions ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Low stock items</p>
          <p className="text-2xl font-bold text-gray-300">{lowStockCount}</p>
          <Link to="/inventory?lowStock=true" className="text-sm text-gray-300 hover:text-white underline">View</Link>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">AI Forecast</p>
          <p className="text-lg font-semibold text-slate-900">{predictions.length} products</p>
          <Link to="/ai" className="text-sm text-gray-300 hover:text-white underline">View</Link>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3">Quick actions</h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/pos" className="px-4 py-2 bg-white text-black rounded-lg text-sm hover:bg-gray-200">Current sale chart</Link>
            <Link to="/orders/approval" className="px-4 py-2 bg-white text-black rounded-lg text-sm hover:bg-gray-200">Pending orders</Link>
            <Link to="/reports" className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700">Reports</Link>
            <Link to="/users" className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Users</Link>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3">Demand forecast (sample)</h2>
          <ul className="space-y-1 text-sm">
            {predictions.length === 0 ? (
              <li className="text-slate-500">Run AI prediction from AI Analytics page.</li>
            ) : (
              predictions.map((p, i) => (
                <li key={i}>{p.product.name}: risk <span className={p.riskOfStockout === 'HIGH' ? 'text-gray-300' : p.riskOfStockout === 'MEDIUM' ? 'text-gray-400' : 'text-gray-500'}>{p.riskOfStockout ?? 'N/A'}</span></li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
