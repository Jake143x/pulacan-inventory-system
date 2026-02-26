import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reports } from '../../api/client';
import type { SaleTransaction } from '../../api/client';

const CURRENCY = '₱';
const POLL_INTERVAL_MS = 10000;

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

const cardClass = 'rounded-2xl border p-5 flex flex-col card-3d';
const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };

export default function CashierDashboard() {
  const [todaySales, setTodaySales] = useState<number>(0);
  const [todayOrders, setTodayOrders] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<SaleTransaction[]>([]);

  const load = () => {
    const today = getTodayDateString();
    Promise.all([
      reports.sales({ startDate: today, endDate: today }),
      reports.latestPosTransactions({ limit: 15 }),
    ])
      .then(([salesRes, liveRes]) => {
        setTodaySales(salesRes.summary?.totalRevenue ?? 0);
        setTodayOrders(salesRes.summary?.totalTransactions ?? 0);
        setRecentTransactions(liveRes.data ?? []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden /> LIVE
        </span>
      </div>

      {/* Row 1: KPI cards — same style as admin */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardClass} style={cardBg}>
          <p className="text-sm text-slate-400">Today&apos;s Sales</p>
          <p className="text-2xl font-bold mt-0.5 tabular-nums" style={{ color: 'var(--admin-text)' }}>
            {`${CURRENCY}${todaySales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Updates automatically</p>
        </div>
        <div className={cardClass} style={cardBg}>
          <p className="text-sm text-slate-400">Orders Today</p>
          <p className="text-2xl font-bold mt-0.5 tabular-nums" style={{ color: 'var(--admin-text)' }}>{todayOrders}</p>
          <p className="text-xs text-slate-500 mt-1">POS transactions</p>
        </div>
        <div className={cardClass} style={cardBg}>
          <p className="text-sm text-slate-400">Quick actions</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Link
              to="/pos"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              POS
            </Link>
            <Link
              to="/orders/approval"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border hover:bg-white/10 transition-colors"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Approve orders
            </Link>
          </div>
        </div>
      </div>

      {/* Row 2: Recent POS transactions — same card style as admin */}
      <div className="rounded-2xl border overflow-hidden card-3d" style={cardBg}>
        <h3 className="px-5 py-4 border-b font-semibold text-base flex items-center gap-2" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>
          Recent POS transactions
          <span className="text-xs font-normal text-emerald-400">LIVE</span>
        </h3>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--admin-card)' }}>
              <tr className="border-b text-xs font-medium uppercase tracking-wider text-slate-400" style={{ borderColor: 'var(--admin-border)' }}>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Cashier</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500 text-sm">No transactions yet. The cashier who processes each sale will appear in the Cashier column.</td></tr>
              ) : (
                recentTransactions.map((t) => (
                  <tr key={t.id} className="border-b" style={{ borderColor: 'var(--admin-border)' }}>
                    <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-medium text-sm" style={{ color: 'var(--admin-text)' }}>#{t.id}</td>
                    <td className="px-4 py-3 text-sm tabular-nums" style={{ color: 'var(--admin-text)' }}>{CURRENCY}{t.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-slate-300" title="Cashier on duty when this sale was completed">{t.user?.fullName ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
