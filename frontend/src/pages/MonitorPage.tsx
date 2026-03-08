import { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  LineChart,
  Line,
  Cell,
  Legend,
} from 'recharts';
import { reports, inventory } from '../api/client';
import type { SaleTransaction } from '../api/client';

const CURRENCY = '₱';
const POLL_INTERVAL_MS = 10000;
const LIVE_TRANSACTIONS_LIMIT = 10;

const VIEW_ORDER = ['sales', 'transactions', 'products', 'inventory'] as const;
type ViewKey = (typeof VIEW_ORDER)[number];

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}
function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };
type InventorySummary = {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  overstockedCount: number;
};

export default function MonitorPage() {
  const defaultRange = getDefaultDateRange();
  const [dateRangeStart, setDateRangeStart] = useState(defaultRange.startDate);
  const [dateRangeEnd, setDateRangeEnd] = useState(defaultRange.endDate);
  const [activeViewIndex, setActiveViewIndex] = useState(0);
  const [salesChartData, setSalesChartData] = useState<
    Array<{ hour?: string; date?: string; revenue: number; orders: number }>
  >([]);
  const [salesChartMode, setSalesChartMode] = useState<'hourly' | 'daily'>('daily');
  const [liveTransactions, setLiveTransactions] = useState<SaleTransaction[]>([]);
  const [bestSelling, setBestSelling] = useState<Array<{ product: { name: string }; quantity: number }>>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);

  const loadData = useCallback(() => {
    Promise.all([
      reports.salesChart({ startDate: dateRangeStart, endDate: dateRangeEnd }),
      reports.latestPosTransactions({ limit: LIVE_TRANSACTIONS_LIMIT }),
      reports.bestSelling({ startDate: dateRangeStart, endDate: dateRangeEnd }),
      inventory.summary(),
    ])
      .then(([chartRes, liveRes, bestRes, invSummary]) => {
        setSalesChartData(Array.isArray(chartRes?.data) ? chartRes.data : []);
        setSalesChartMode(chartRes?.mode === 'hourly' ? 'hourly' : 'daily');
        setLiveTransactions(Array.isArray(liveRes?.data) ? liveRes.data : []);
        const best = Array.isArray(bestRes?.data) ? bestRes.data : [];
        setBestSelling(
          best.slice(0, 15).map((d: { product?: { name?: string }; quantity: number }) => ({
            product: { name: d.product?.name ?? 'Unknown' },
            quantity: Number(d.quantity) || 0,
          }))
        );
        setInventorySummary(invSummary ?? null);
      })
      .catch(() => {});
  }, [dateRangeStart, dateRangeEnd]);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [loadData]);

  useEffect(() => {
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement === el) document.exitFullscreen?.();
    };
  }, []);

  const inventoryDonutData =
    inventorySummary != null
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

  const currentView: ViewKey = VIEW_ORDER[activeViewIndex];

  return (
    <div className="min-h-screen flex flex-col admin-canvas" style={{ backgroundColor: 'var(--admin-bg)' }}>
      <header
        className="shrink-0 px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap"
        style={{ ...cardBg, borderColor: 'var(--admin-border)' }}
      >
        <h1 className="text-xl font-semibold" style={{ color: 'var(--admin-text)' }}>
          Store Analytics Monitor
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {VIEW_ORDER.map((view, index) => (
            <button
              key={view}
              type="button"
              onClick={() => setActiveViewIndex(index)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                activeViewIndex === index
                  ? 'bg-blue-500/30 border-blue-500/60 text-blue-200'
                  : 'border-slate-500/50 text-slate-300 hover:bg-white/5 hover:border-slate-400'
              }`}
            >
              {view === 'sales' ? 'Daily Sales' : view === 'transactions' ? 'POS Transactions' : view === 'products' ? 'Most Sold Items' : 'Inventory Health'}
            </button>
          ))}
          <span className="inline-flex items-center gap-2 text-sm text-emerald-400 font-medium ml-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
            LIVE • updating every 10s
          </span>
        </div>
      </header>

      <main className="flex-1 min-h-0 p-6 flex flex-col min-h-[50vh]">
        <div className="flex-1 min-h-[400px] rounded-2xl border overflow-hidden card-3d flex flex-col" style={cardBg}>
          {currentView === 'sales' && (
            <div className="flex flex-col flex-1 min-h-0 p-4">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--admin-text)' }}>
                Daily Sales
              </h2>
              <div className="flex-1 min-h-[280px]">
                {!salesChartData.length ? (
                  <div className="h-full flex items-center justify-center text-slate-500">No data for selected range. Sales will appear here when available.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesChartData} margin={{ top: 16, right: 56, left: 16, bottom: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" vertical={false} />
                      <XAxis
                        dataKey={salesChartMode === 'hourly' ? 'hour' : 'date'}
                        tick={{ fill: 'var(--admin-text)', fontSize: 12 }}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fill: 'var(--admin-text)', fontSize: 12 }}
                        tickFormatter={(v) => `${CURRENCY}${Number(v).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: 'var(--admin-text)', fontSize: 12 }}
                        tickFormatter={(v) => String(v)}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 8 }}
                        formatter={(value: number | undefined, name: string) => {
                          if (name === 'revenue') return [`${CURRENCY}${Number(value ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Revenue'];
                          return [value ?? 0, 'Orders'];
                        }}
                      />
                      <Line type="monotone" dataKey="revenue" yAxisId="left" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 4 }} name="Revenue" />
                      <Line type="monotone" dataKey="orders" yAxisId="right" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} name="Orders" />
                      <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => (value === 'Revenue' ? `${value} (₱)` : value)} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {currentView === 'transactions' && (
            <div className="flex flex-col flex-1 min-h-0 p-4">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--admin-text)' }}>
                Live POS Transactions (today)
              </h2>
              <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--admin-card)' }}>
                    <tr className="border-b text-sm font-medium uppercase tracking-wider text-slate-400" style={{ borderColor: 'var(--admin-border)' }}>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Cashier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!liveTransactions.length ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          No transactions today yet. Resets daily. New transactions will appear here.
                        </td>
                      </tr>
                    ) : (
                      liveTransactions.map((t, index) => {
                        const dailyInvoiceNum = liveTransactions.length - index;
                        return (
                          <tr key={t.id} className="border-b" style={{ borderColor: 'var(--admin-border)' }}>
                            <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                              {new Date(t.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>#{dailyInvoiceNum}</td>
                            <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--admin-text)' }}>
                              {CURRENCY}{t.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-slate-300">{t.user?.fullName ?? '—'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentView === 'products' && (
            <div className="flex flex-col flex-1 min-h-0 p-4">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--admin-text)' }}>
                Most Sold Items
              </h2>
              <p className="text-sm text-slate-400 mb-2">{dateRangeStart} to {dateRangeEnd}</p>
              <div className="flex-1 min-h-[280px]">
                {!bestSelling.length ? (
                  <div className="h-full flex items-center justify-center text-slate-500">No sales data for selected range. Items will appear here when sales exist.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={bestSelling.map((d) => ({
                        name: (d.product?.name ?? 'Unknown').length > 28 ? (d.product?.name ?? 'Unknown').slice(0, 25) + '…' : (d.product?.name ?? 'Unknown'),
                        quantity: d.quantity,
                        fullName: d.product?.name ?? 'Unknown',
                      }))}
                      margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                      barCategoryGap="8%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'var(--admin-text)', fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" width={200} tick={{ fill: 'var(--admin-text)', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 8 }}
                        formatter={(value: number | undefined) => [value ?? 0, 'Units sold']}
                        labelFormatter={(_, payload) => (payload?.[0]?.payload?.fullName ?? '')}
                      />
                      <Bar dataKey="quantity" fill="#3B82F6" radius={[0, 4, 4, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {currentView === 'inventory' && (
            <div className="flex flex-col flex-1 min-h-0 p-4">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--admin-text)' }}>
                Inventory Health
              </h2>
              <div className="flex-1 flex flex-col sm:flex-row gap-8 items-center justify-center min-h-[280px]">
                <div className="shrink-0 w-48 h-48">
                  {inventoryDonutData.length > 0 ? (
                    <PieChart width={192} height={192}>
                      <Pie
                        data={inventoryDonutData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={88}
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
                    <div className="w-full h-full flex items-center justify-center text-slate-500">No data</div>
                  )}
                </div>
                <div className="space-y-4 min-w-[200px]">
                  <div className="flex justify-between items-center text-lg">
                    <span className="text-slate-400">Low Stock</span>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--admin-text)' }}>
                      {inventorySummary?.lowStockCount ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-lg">
                    <span className="text-slate-400">Out of Stock</span>
                    <span className="font-semibold tabular-nums text-red-400">{inventorySummary?.outOfStockCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg pt-4 border-t" style={{ borderColor: 'var(--admin-border)' }}>
                    <span className="text-slate-400">Inventory Value</span>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--admin-text)' }}>
                      {inventorySummary != null ? `${CURRENCY}${inventorySummary.totalValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
