import { useEffect, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, LineChart, Line, Cell } from 'recharts';
import { reports, inventory } from '../../api/client';
import type { SaleTransaction } from '../../api/client';
const CURRENCY = '₱';
const POLL_INTERVAL_MS = 10000;
const LIVE_TRANSACTIONS_LIMIT = 10;

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}
function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}
function rangeIncludesToday(startDate: string, endDate: string) {
  const today = getTodayDateString();
  return startDate <= today && endDate >= today;
}
/** Previous period of same length (for comparison). */
function getPreviousPeriod(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  return { startDate: prevStart.toISOString().slice(0, 10), endDate: prevEnd.toISOString().slice(0, 10) };
}

const cardClass = 'rounded-2xl border p-5 flex flex-col card-3d';
const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };

type InventorySummary = { totalProducts: number; totalValue: number; lowStockCount: number; outOfStockCount: number; overstockedCount: number };

export default function AdminDashboard() {
  const defaultRange = getDefaultDateRange();
  const [dateRangeStart, setDateRangeStart] = useState(defaultRange.startDate);
  const [dateRangeEnd, setDateRangeEnd] = useState(defaultRange.endDate);
  const [todaySales, setTodaySales] = useState<number>(0);
  const [todayOrders, setTodayOrders] = useState<number>(0);
  const [revenueInRange, setRevenueInRange] = useState<number>(0);
  const [revenueVsPrevious, setRevenueVsPrevious] = useState<number | null>(null);
  const [liveTransactions, setLiveTransactions] = useState<SaleTransaction[]>([]);
  const [revenueTrends, setRevenueTrends] = useState<Array<{ date: string; revenue: number }>>([]);
  const [bestSelling, setBestSelling] = useState<Array<{ product: { name: string }; quantity: number }>>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const prevLiveIdsRef = useRef<Set<number>>(new Set());
  const [newTransactionIds, setNewTransactionIds] = useState<Set<number>>(new Set());

  const loadDashboardKpisAndLive = () => {
    const today = getTodayDateString();
    const prevPeriod = getPreviousPeriod(dateRangeStart, dateRangeEnd);
    Promise.all([
      reports.sales({ startDate: today, endDate: today }),
      reports.sales({ startDate: dateRangeStart, endDate: dateRangeEnd }),
      reports.sales({ startDate: prevPeriod.startDate, endDate: prevPeriod.endDate }),
      reports.latestPosTransactions({ limit: LIVE_TRANSACTIONS_LIMIT }),
      inventory.summary(),
      reports.bestSelling({ startDate: dateRangeStart, endDate: dateRangeEnd }),
      reports.revenueTrends({ startDate: dateRangeStart, endDate: dateRangeEnd }),
    ])
      .then(([todayRes, rangeRes, prevRes, liveRes, invSummary, bestRes, trendsRes]) => {
        setTodaySales(todayRes.summary?.totalRevenue ?? 0);
        setTodayOrders(todayRes.summary?.totalTransactions ?? 0);
        const current = rangeRes.summary?.totalRevenue ?? 0;
        const previous = prevRes.summary?.totalRevenue ?? 0;
        setRevenueInRange(current);
        if (previous > 0) {
          setRevenueVsPrevious(((current - previous) / previous) * 100);
        } else {
          setRevenueVsPrevious(current > 0 ? 100 : null);
        }
        setInventorySummary(invSummary ?? null);
        setBestSelling((bestRes.data ?? []).slice(0, 15).map((d) => ({ product: { name: d.product?.name ?? 'Unknown' }, quantity: d.quantity })));
        const newList = liveRes.data ?? [];
        setLiveTransactions(newList);
        const newIds = new Set(newList.map((t) => t.id));
        const prev = prevLiveIdsRef.current;
        const added = prev.size > 0 ? new Set([...newIds].filter((id) => !prev.has(id))) : new Set();
        prevLiveIdsRef.current = newIds;
        setNewTransactionIds(added);
        if (trendsRes?.data) setRevenueTrends(trendsRes.data);
      })
      .catch(() => {});
  };

  // Load all dashboard data and poll every 10s — charts always live
  useEffect(() => {
    loadDashboardKpisAndLive();
    const t = setInterval(loadDashboardKpisAndLive, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [dateRangeStart, dateRangeEnd]);

  // (removed: chart load only when range excludes today — both charts now always live)

  // Clear "new" highlight on live transactions after animation
  useEffect(() => {
    if (newTransactionIds.size === 0) return;
    const t = setTimeout(() => setNewTransactionIds(new Set()), 2500);
    return () => clearTimeout(t);
  }, [newTransactionIds]);

  const inventoryDonutData = inventorySummary
    ? (() => {
        const { totalProducts, lowStockCount, outOfStockCount, overstockedCount } = inventorySummary;
        const inStock = Math.max(0, totalProducts - lowStockCount - outOfStockCount - overstockedCount);
        return [
          { name: 'In Stock', value: inStock, color: '#10B981' },
          { name: 'Low Stock', value: lowStockCount, color: '#F59E0B' },
          { name: 'Out of Stock', value: outOfStockCount, color: '#EF4444' },
          { name: 'Overstocked', value: overstockedCount, color: '#3B82F6' },
        ].filter((d) => d.value > 0);
      })()
    : [];

  return (
    <div className="space-y-6">
      {/* LIVE indicator */}
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden /> LIVE – Connected
        </span>
      </div>

      {/* Row 1: KPIs — Today's Sales, Total Orders Today, Revenue + comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardClass} style={cardBg}>
          <p className="text-sm text-slate-400">Today&apos;s Sales</p>
          <p className="text-2xl font-bold mt-0.5 tabular-nums" style={{ color: 'var(--admin-text)' }}>
            {`${CURRENCY}${todaySales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs text-green-500 mt-1">Updates automatically</p>
        </div>
        <div className={cardClass} style={cardBg}>
          <p className="text-sm text-slate-400">Total Orders Today</p>
          <p className="text-2xl font-bold mt-0.5 tabular-nums" style={{ color: 'var(--admin-text)' }}>{todayOrders}</p>
          <p className="text-xs text-slate-500 mt-1">POS transactions</p>
        </div>
        <div className={cardClass} style={cardBg}>
          <p className="text-sm text-slate-400">Revenue</p>
          <p className="text-2xl font-bold mt-0.5 tabular-nums" style={{ color: 'var(--admin-text)' }}>
            {`${CURRENCY}${revenueInRange.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
          </p>
          {revenueVsPrevious !== null && (
            <p className={`text-xs mt-1 font-medium ${revenueVsPrevious >= 0 ? 'text-green-500' : 'text-red-400'}`}>
              {revenueVsPrevious >= 0 ? '+' : ''}{revenueVsPrevious.toFixed(1)}% vs previous period
            </p>
          )}
          {revenueVsPrevious === null && (
            <p className="text-xs text-slate-500 mt-1">Selected date range</p>
          )}
        </div>
      </div>

      {/* Row 2: Daily Sales — live line chart, custom date */}
      <div className="rounded-2xl border overflow-hidden card-3d" style={cardBg}>
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--admin-border)' }}>
          <h3 className="font-semibold text-base" style={{ color: 'var(--admin-text)' }}>Daily Sales</h3>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden /> LIVE — updates every 10s
          </span>
          <span className="text-sm text-slate-400">Revenue by day</span>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <span>From</span>
            <input
              type="date"
              value={dateRangeStart}
              onChange={(e) => setDateRangeStart(e.target.value)}
              className="px-2 py-1.5 rounded-lg border text-sm"
              style={{ ...cardBg, color: 'var(--admin-text)' }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <span>To</span>
            <input
              type="date"
              value={dateRangeEnd}
              onChange={(e) => setDateRangeEnd(e.target.value)}
              className="px-2 py-1.5 rounded-lg border text-sm"
              style={{ ...cardBg, color: 'var(--admin-text)' }}
            />
          </label>
          <a
            href={`/dashboard/sales-chart?start=${encodeURIComponent(dateRangeStart)}&end=${encodeURIComponent(dateRangeEnd)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-white/10"
            style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open in new tab
          </a>
        </div>
        <div className="p-4 h-64">
          {revenueTrends.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">No data for selected range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrends} margin={{ top: 8, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--admin-text)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--admin-text)', fontSize: 11 }} tickFormatter={(v) => `${CURRENCY}${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--admin-text)' }}
                  formatter={(value: number) => [`${CURRENCY}${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Revenue']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2b: Most Sold Items — live, same date range */}
      <div className="rounded-2xl border overflow-hidden card-3d" style={cardBg}>
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--admin-border)' }}>
          <h3 className="font-semibold text-base" style={{ color: 'var(--admin-text)' }}>Most Sold Items</h3>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden /> LIVE
          </span>
          <span className="text-sm text-slate-400">Top products by units sold</span>
          <span className="text-xs text-slate-500">{dateRangeStart} to {dateRangeEnd}</span>
        </div>
        <div className="p-4 h-80">
          {bestSelling.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">No sales data for selected range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={bestSelling.map((d) => ({ name: d.product.name.length > 28 ? d.product.name.slice(0, 25) + '…' : d.product.name, quantity: d.quantity, fullName: d.product.name }))}
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                barCategoryGap="8%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--admin-text)', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'var(--admin-text)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 8 }}
                  formatter={(value: number) => [value, 'Units sold']}
                  labelFormatter={(_, payload) => (payload?.[0]?.payload?.fullName ?? '')}
                />
                <Bar dataKey="quantity" fill="#3B82F6" radius={[0, 4, 4, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: Split — Live POS (left) | Inventory Alerts (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live POS Transactions */}
        <div className="rounded-2xl border overflow-hidden card-3d" style={cardBg}>
          <h3 className="px-5 py-4 border-b font-semibold text-base flex items-center gap-2" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>
            Live POS Transactions
            <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
            </span>
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
                {liveTransactions.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500 text-sm">No transactions yet.</td></tr>
                ) : (
                  liveTransactions.map((t) => (
                    <tr
                      key={t.id}
                      className={`border-b transition-all duration-300 ${newTransactionIds.has(t.id) ? 'animate-fade-in bg-emerald-500/10' : ''}`}
                      style={{ borderColor: 'var(--admin-border)' }}
                    >
                      <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-medium text-sm" style={{ color: 'var(--admin-text)' }}>#{t.id}</td>
                      <td className="px-4 py-3 text-sm tabular-nums" style={{ color: 'var(--admin-text)' }}>{CURRENCY}{t.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{t.user?.fullName ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Health Summary + Donut */}
        <div className="rounded-2xl border overflow-hidden card-3d" style={cardBg}>
          <h3 className="px-5 py-4 border-b font-semibold text-base" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>
            Inventory Health
          </h3>
          <div className="p-4 flex flex-col sm:flex-row gap-4 items-center">
            <div className="shrink-0 w-40 h-40">
              {inventoryDonutData.length > 0 ? (
                <PieChart width={160} height={160}>
                  <Pie
                    data={inventoryDonutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="var(--admin-card)"
                    strokeWidth={2}
                  >
                    {inventoryDonutData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{ backgroundColor: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 8 }}
                  />
                </PieChart>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">No data</div>
              )}
            </div>
            <div className="flex-1 space-y-3 min-w-0">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Low Stock</span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--admin-text)' }}>{inventorySummary?.lowStockCount ?? 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Out of Stock</span>
                <span className="font-semibold tabular-nums text-red-400">{inventorySummary?.outOfStockCount ?? 0}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: 'var(--admin-border)' }}>
                <span className="text-sm text-slate-400">Inventory Value</span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--admin-text)' }}>
                  {inventorySummary != null ? `${CURRENCY}${inventorySummary.totalValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
