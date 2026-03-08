import { useEffect, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, LineChart, Line, Cell, Legend } from 'recharts';
import { reports, inventory, inventoryAi, ai } from '../../api/client';
import type { SaleTransaction } from '../../api/client';
import type { InventoryAiAlertRow, AiForecastRow } from '../../api/client';
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
function getTodayRange() {
  const t = getTodayDateString();
  return { startDate: t, endDate: t };
}
function getLast7Range() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}
function getLast30Range() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}
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
function hourTo12hLabel(hourStr: string): string {
  const match = hourStr.match(/^(\d{1,2}):00$/);
  if (!match) return hourStr;
  const h = parseInt(match[1], 10);
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}
function getPeakHourFromHourlyData(data: Array<{ hour?: string; revenue: number; orders: number }>): { hour: string; revenue: number; orders: number } | null {
  const hourly = data.filter((d) => d.hour != null) as Array<{ hour: string; revenue: number; orders: number }>;
  if (!hourly.length) return null;
  return hourly.reduce((max, cur) => (cur.revenue > max.revenue ? cur : max), hourly[0]);
}

function unitLabel(unitType: string): string {
  return unitType === 'piece' ? 'pcs' : unitType === 'kg' ? 'kg' : 'meters';
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
  const [salesChartData, setSalesChartData] = useState<Array<{ hour?: string; date?: string; revenue: number; orders: number }>>([]);
  const [salesChartMode, setSalesChartMode] = useState<'hourly' | 'daily'>('daily');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [bestSelling, setBestSelling] = useState<Array<{ product: { name: string }; quantity: number }>>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [aiAlerts, setAiAlerts] = useState<InventoryAiAlertRow[]>([]);
  const [aiAlertsLoading, setAiAlertsLoading] = useState(false);
  const [aiRunLoading, setAiRunLoading] = useState(false);
  const [poGenerated, setPoGenerated] = useState<{ alertId: number; emailBody: string; subject: string } | null>(null);
  const prevLiveIdsRef = useRef<Set<number>>(new Set());
  const [newTransactionIds, setNewTransactionIds] = useState<Set<number>>(new Set());
  const [forecastRangeDays, setForecastRangeDays] = useState(7);
  const [forecastResults, setForecastResults] = useState<AiForecastRow[] | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

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
      reports.salesChart({ startDate: dateRangeStart, endDate: dateRangeEnd }),
    ])
      .then(([todayRes, rangeRes, prevRes, liveRes, invSummary, bestRes, chartRes]) => {
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
        const added = prev.size > 0 ? new Set<number>([...newIds].filter((id) => !prev.has(id))) : new Set<number>();
        prevLiveIdsRef.current = newIds;
        setNewTransactionIds(added);
        if (chartRes?.data) {
          setSalesChartData(chartRes.data);
          setSalesChartMode(chartRes.mode ?? 'daily');
        }
      })
      .catch(() => {});
  };

  // Load all dashboard data and poll every 10s — charts always live
  useEffect(() => {
    loadDashboardKpisAndLive();
    const t = setInterval(loadDashboardKpisAndLive, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [dateRangeStart, dateRangeEnd]);

  const loadAiAlerts = () => {
    setAiAlertsLoading(true);
    inventoryAi.alerts()
      .then((r) => setAiAlerts(r.data ?? []))
      .catch(() => setAiAlerts([]))
      .finally(() => setAiAlertsLoading(false));
  };

  useEffect(() => {
    loadAiAlerts();
    const t = setInterval(loadAiAlerts, POLL_INTERVAL_MS * 2);
    return () => clearInterval(t);
  }, []);

  const runForecast = async () => {
    const days = Math.max(1, Math.min(365, Math.round(forecastRangeDays) || 7));
    setForecastLoading(true);
    setForecastResults(null);
    try {
      const res = await ai.forecast(days);
      setForecastResults(res.data ?? []);
      setForecastRangeDays(res.forecastRangeDays ?? days);
    } catch {
      setForecastResults([]);
    } finally {
      setForecastLoading(false);
    }
  };

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

      {/* Row 2: Daily Sales — live dual-line chart (revenue + orders), hourly for single day / daily for range */}
      <div className="rounded-2xl border overflow-hidden card-3d" style={cardBg}>
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--admin-border)' }}>
          <h3 className="font-semibold text-base" style={{ color: 'var(--admin-text)' }}>Daily Sales</h3>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden /> LIVE — updates every 10s
          </span>
          <span className="text-sm text-slate-400">
            {salesChartMode === 'hourly' ? 'By hour (selected day)' : 'By day'}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const { startDate, endDate } = getTodayRange();
                setDateRangeStart(startDate);
                setDateRangeEnd(endDate);
                setShowCustomRange(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${dateRangeStart === getTodayDateString() && dateRangeEnd === dateRangeStart ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : ''}`}
              style={dateRangeStart !== getTodayDateString() || dateRangeEnd !== dateRangeStart ? { borderColor: 'var(--admin-border)', color: 'var(--admin-text)' } : undefined}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const { startDate, endDate } = getLast7Range();
                setDateRangeStart(startDate);
                setDateRangeEnd(endDate);
                setShowCustomRange(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${dateRangeStart === getLast7Range().startDate && dateRangeEnd === getLast7Range().endDate ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : ''}`}
              style={!(dateRangeStart === getLast7Range().startDate && dateRangeEnd === getLast7Range().endDate) ? { borderColor: 'var(--admin-border)', color: 'var(--admin-text)' } : undefined}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => {
                const { startDate, endDate } = getLast30Range();
                setDateRangeStart(startDate);
                setDateRangeEnd(endDate);
                setShowCustomRange(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${dateRangeStart === getLast30Range().startDate && dateRangeEnd === getLast30Range().endDate ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : ''}`}
              style={!(dateRangeStart === getLast30Range().startDate && dateRangeEnd === getLast30Range().endDate) ? { borderColor: 'var(--admin-border)', color: 'var(--admin-text)' } : undefined}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setShowCustomRange(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${showCustomRange ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : ''}`}
              style={!showCustomRange ? { borderColor: 'var(--admin-border)', color: 'var(--admin-text)' } : undefined}
            >
              Custom
            </button>
          </div>
          {showCustomRange && (
            <>
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
            </>
          )}
          <a
            href="/fullscreen-monitor"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border bg-emerald-500/15 text-emerald-400 border-emerald-500/40 transition-colors hover:bg-emerald-500/25"
          >
            TV / Wall Display (new tab)
          </a>
          <a
            href={`/dashboard/sales-chart?start=${encodeURIComponent(dateRangeStart)}&end=${encodeURIComponent(dateRangeEnd)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-white/10"
            style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Sales chart (new tab)
          </a>
        </div>
        {salesChartMode === 'hourly' && salesChartData.length > 0 && (() => {
          const peak = getPeakHourFromHourlyData(salesChartData);
          return peak ? (
            <div className="px-5 py-2 border-b flex items-center gap-4" style={{ borderColor: 'var(--admin-border)' }}>
              <div className="rounded-lg px-4 py-2" style={{ backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Peak Sales Hour</span>
                <p className="text-base font-semibold mt-0.5" style={{ color: 'var(--admin-text)' }}>{hourTo12hLabel(peak.hour)}</p>
                <p className="text-sm text-emerald-400 font-medium">{CURRENCY}{peak.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          ) : null;
        })()}
        <div className="p-4 h-64">
          {salesChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">No data for selected range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={salesChartData}
                margin={{ top: 8, right: 48, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" vertical={false} />
                <XAxis
                  dataKey={salesChartMode === 'hourly' ? 'hour' : 'date'}
                  tick={{ fill: 'var(--admin-text)', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: 'var(--admin-text)', fontSize: 11 }}
                  tickFormatter={(v) => `${CURRENCY}${Number(v).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: 'var(--admin-text)', fontSize: 11 }}
                  tickFormatter={(v) => String(v)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--admin-text)' }}
                  formatter={(value: number | undefined, name: string) => {
                    if (name === 'revenue') return [`${CURRENCY}${Number(value ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Revenue'];
                    return [value ?? 0, 'Orders'];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  yAxisId="left"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  yAxisId="right"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Orders"
                />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => (value === 'Revenue' ? `${value} (₱)` : value)} />
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
                  formatter={(value: number | undefined) => [value ?? 0, 'Units sold']}
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
            Live POS Transactions (today)
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
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500 text-sm">No transactions today yet. Resets daily.</td></tr>
                ) : (
                  liveTransactions.map((t, index) => {
                    const dailyInvoiceNum = liveTransactions.length - index;
                    return (
                      <tr
                        key={t.id}
                        className={`border-b transition-all duration-300 ${newTransactionIds.has(t.id) ? 'animate-fade-in bg-emerald-500/10' : ''}`}
                        style={{ borderColor: 'var(--admin-border)' }}
                      >
                        <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                          {new Date(t.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-medium text-sm" style={{ color: 'var(--admin-text)' }}>#{dailyInvoiceNum}</td>
                        <td className="px-4 py-3 text-sm tabular-nums" style={{ color: 'var(--admin-text)' }}>{CURRENCY}{t.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{t.user?.fullName ?? '—'}</td>
                      </tr>
                    );
                  })
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
                    formatter={(value: number | undefined, name: string | undefined) => [value ?? 0, name ?? '']}
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

      {/* AI Forecast Range — Admin/Owner: custom days forecast */}
      <div className="rounded-2xl border overflow-hidden card-3d" style={cardBg}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--admin-border)' }}>
          <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--admin-text)' }}>
            AI Forecast Range
          </h3>
          <p className="text-sm text-slate-400 mb-4">Enter number of days to predict demand and see reorder recommendations.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="admin-forecast-days" className="block text-xs text-slate-500 mb-1">Enter number of days:</label>
              <input
                id="admin-forecast-days"
                type="number"
                min={1}
                max={365}
                value={forecastRangeDays}
                onChange={(e) => setForecastRangeDays(Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 7)))}
                className="w-24 px-3 py-2 rounded-lg border text-sm bg-slate-800/50 border-slate-600 text-white"
              />
            </div>
            <button
              type="button"
              disabled={forecastLoading}
              onClick={runForecast}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50 btn-3d"
            >
              {forecastLoading ? 'Running…' : 'Run Forecast'}
            </button>
          </div>
        </div>
        <div className="p-4">
          {forecastLoading ? (
            <div className="py-6 text-center text-slate-500 text-sm">Running forecast…</div>
          ) : forecastResults !== null && forecastResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">Forecast range: <strong className="text-white">{forecastRangeDays}</strong> days</p>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/60">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-400">Product</th>
                      <th className="px-3 py-2 text-left text-slate-400">Predicted demand</th>
                      <th className="px-3 py-2 text-left text-slate-400">Current stock</th>
                      <th className="px-3 py-2 text-left text-slate-400">Reorder recommendation</th>
                      <th className="px-3 py-2 text-left text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {forecastResults.slice(0, 20).map((p) => {
                      const currentStock = p.product?.inventory?.quantity ?? 0;
                      const sufficient = currentStock >= p.predictedDemand;
                      const u = unitLabel(p.product?.unitType ?? 'piece');
                      return (
                        <tr key={p.id}>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--admin-text)' }}>{p.product?.name ?? '-'}</td>
                          <td className="px-3 py-2 tabular-nums">{p.predictedDemand} {u}</td>
                          <td className="px-3 py-2 tabular-nums">{currentStock} {u}</td>
                          <td className="px-3 py-2">{p.suggestedRestock > 0 ? `${p.suggestedRestock} ${u}` : '—'}</td>
                          <td className="px-3 py-2">
                            {sufficient ? <span className="text-emerald-400">Stock is sufficient</span> : <span className="text-amber-400 font-medium">LOW STOCK ALERT</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {forecastResults.length > 20 && <p className="text-xs text-slate-500">Showing first 20. See Reports for full list.</p>}
            </div>
          ) : forecastResults !== null ? (
            <div className="py-6 text-center text-slate-500 text-sm">No products to forecast.</div>
          ) : (
            <div className="py-6 text-center text-slate-500 text-sm">Enter days and click &quot;Run Forecast&quot; to see predictions.</div>
          )}
        </div>
      </div>

      {/* Row 4: AI Inventory Alerts — Admin/Owner only */}
      <div className="rounded-2xl border overflow-hidden card-3d" style={cardBg}>
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--admin-border)' }}>
          <h3 className="font-semibold text-base" style={{ color: 'var(--admin-text)' }}>
            AI Inventory Alerts
          </h3>
          <span className="text-sm text-slate-400">Low stock detection from last 30 days sales · Reorder suggestions</span>
          <button
            type="button"
            disabled={aiRunLoading}
            onClick={() => {
              setAiRunLoading(true);
              inventoryAi.run()
                .then(() => { loadAiAlerts(); })
                .catch(() => {})
                .finally(() => setAiRunLoading(false));
            }}
            className="ml-auto px-3 py-1.5 rounded-lg text-sm font-medium border bg-amber-500/15 text-amber-400 border-amber-500/40 hover:bg-amber-500/25 disabled:opacity-50"
          >
            {aiRunLoading ? 'Running…' : 'Run AI check now'}
          </button>
        </div>
        <div className="p-4">
          {aiAlertsLoading ? (
            <div className="py-8 text-center text-slate-500 text-sm">Loading alerts…</div>
          ) : aiAlerts.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No low stock alerts. AI runs every hour automatically.</div>
          ) : (
            <div className="space-y-4">
              {aiAlerts.map((alert) => {
                const u = unitLabel(alert.product?.unitType ?? 'piece');
                return (
                  <div
                    key={alert.id}
                    className="rounded-xl border p-4"
                    style={{ backgroundColor: 'rgba(254, 202, 202, 0.08)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">LOW STOCK ALERT</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-slate-400">Product</span>
                        <p className="font-medium" style={{ color: 'var(--admin-text)' }}>{alert.productName}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Current Stock</span>
                        <p className="font-semibold tabular-nums" style={{ color: 'var(--admin-text)' }}>{alert.currentStock} {u}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Predicted Demand (7 days)</span>
                        <p className="font-semibold tabular-nums" style={{ color: 'var(--admin-text)' }}>{alert.predictedDemand} {u}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Suggested Reorder</span>
                        <p className="font-semibold tabular-nums text-amber-400">{alert.suggestedReorder} {u}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--admin-border)' }}>
                      <span className="text-slate-400 text-sm">Supplier:</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--admin-text)' }}>{alert.supplier?.name ?? 'Not assigned'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          inventoryAi.generatePo(alert.id)
                            .then((res) => {
                              setPoGenerated({
                                alertId: alert.id,
                                subject: res.emailTemplate.subject,
                                emailBody: res.emailTemplate.body,
                              });
                            })
                            .catch((err: Error) => alert(err.message || 'Failed to generate PO'));
                        }}
                        className="ml-auto px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] btn-3d"
                      >
                        Generate Purchase Order
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {poGenerated && (
          <div className="mx-4 mb-4 p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/30">
            <p className="text-sm font-semibold text-emerald-400 mb-2">Purchase order created. Email template:</p>
            <p className="text-xs text-slate-400 mb-1">Subject: {poGenerated.subject}</p>
            <pre className="text-xs p-3 rounded-lg overflow-auto max-h-32 whitespace-pre-wrap" style={{ backgroundColor: 'var(--admin-bg)', color: 'var(--admin-text)' }}>
              {poGenerated.emailBody}
            </pre>
            <button
              type="button"
              onClick={() => setPoGenerated(null)}
              className="mt-2 text-sm text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
