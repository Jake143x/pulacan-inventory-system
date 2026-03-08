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
const LIVE_TRANSACTIONS_LIMIT = 6;
const BEST_SELLING_LIMIT = 6;

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

export default function FullscreenMonitorPage() {
  const defaultRange = getDefaultDateRange();
  const [dateRangeStart, setDateRangeStart] = useState(defaultRange.startDate);
  const [dateRangeEnd, setDateRangeEnd] = useState(defaultRange.endDate);
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
        if (chartRes?.data) {
          setSalesChartData(chartRes.data);
          setSalesChartMode(chartRes.mode ?? 'daily');
        }
        setLiveTransactions(liveRes.data ?? []);
        setBestSelling(
          (bestRes.data ?? []).slice(0, BEST_SELLING_LIMIT).map((d) => ({
            product: { name: d.product?.name ?? 'Unknown' },
            quantity: d.quantity,
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

  useEffect(() => {
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement === el) document.exitFullscreen?.();
    };
  }, []);

  return (
    <div
      className="admin-canvas overflow-hidden select-none"
      style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--admin-bg)',
        display: 'grid',
        gridTemplateRows: '60% 40%',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateAreas: `
          "sales sales sales"
          "transactions products inventory"
        `,
        gap: 8,
        padding: 8,
        boxSizing: 'border-box',
      }}
      role="application"
      aria-label="Store analytics monitor"
    >
        {/* 1. Daily Sales Chart — large top area */}
        <section
          className="rounded-xl border overflow-hidden flex flex-col min-h-0"
          style={{ ...cardBg, gridArea: 'sales' }}
        >
          <div className="shrink-0 px-4 py-2 border-b text-base font-semibold" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>
            Daily Sales
          </div>
          <div className="flex-1 min-h-0 p-3">
            {salesChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesChartData} margin={{ top: 8, right: 40, left: 8, bottom: 8 }}>
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
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--admin-text)', fontSize: 12 }} tickFormatter={(v) => String(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 6 }}
                    formatter={(value: number | undefined, name: string) => {
                      if (name === 'revenue') return [`${CURRENCY}${Number(value ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Revenue'];
                      return [value ?? 0, 'Orders'];
                    }}
                  />
                  <Line type="monotone" dataKey="revenue" yAxisId="left" stroke="#3B82F6" strokeWidth={2} dot={false} name="Revenue" />
                  <Line type="monotone" dataKey="orders" yAxisId="right" stroke="#10B981" strokeWidth={2} dot={false} name="Orders" />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === 'Revenue' ? `${v} (₱)` : v)} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 2. Live POS Transactions */}
        <section
          className="rounded-xl border overflow-hidden flex flex-col min-h-0"
          style={{ ...cardBg, gridArea: 'transactions' }}
        >
          <div className="shrink-0 px-4 py-2 border-b text-base font-semibold flex items-center gap-2" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>
            Live POS Transactions
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead style={{ backgroundColor: 'var(--admin-card)' }}>
                <tr className="border-b text-slate-400" style={{ borderColor: 'var(--admin-border)' }}>
                  <th className="px-3 py-2 font-semibold">Time</th>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Cashier</th>
                </tr>
              </thead>
              <tbody>
                {liveTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">No transactions today</td>
                  </tr>
                ) : (
                  liveTransactions.map((t, index) => {
                    const dailyInvoiceNum = liveTransactions.length - index;
                    return (
                      <tr key={t.id} className="border-b" style={{ borderColor: 'var(--admin-border)' }}>
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                          {new Date(t.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--admin-text)' }}>#{dailyInvoiceNum}</td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--admin-text)' }}>{CURRENCY}{t.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-slate-300 truncate">{t.user?.fullName ?? '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. Most Sold Items */}
        <section
          className="rounded-xl border overflow-hidden flex flex-col min-h-0"
          style={{ ...cardBg, gridArea: 'products' }}
        >
          <div className="shrink-0 px-4 py-2 border-b text-base font-semibold" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>
            Most Sold Items
          </div>
          <div className="flex-1 min-h-0 p-2 overflow-hidden">
            {bestSelling.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={bestSelling.map((d) => ({
                    name: d.product.name.length > 20 ? d.product.name.slice(0, 18) + '…' : d.product.name,
                    quantity: d.quantity,
                    fullName: d.product.name,
                  }))}
                  margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                  barCategoryGap="8%"
                >
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--admin-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'var(--admin-text)', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'var(--admin-text)', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 6, fontSize: 11 }}
                    formatter={(value: number | undefined) => [value ?? 0, 'Units']}
                    labelFormatter={(_, payload) => (payload?.[0]?.payload?.fullName ?? '')}
                  />
                  <Bar dataKey="quantity" fill="#3B82F6" radius={[0, 4, 4, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 4. Inventory Health */}
        <section
          className="rounded-xl border overflow-hidden flex flex-col min-h-0"
          style={{ ...cardBg, gridArea: 'inventory' }}
        >
          <div className="shrink-0 px-4 py-2 border-b text-base font-semibold" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>
            Inventory Health
          </div>
          <div className="flex-1 min-h-0 flex items-center gap-4 p-3 overflow-hidden">
            <div className="shrink-0 w-28 h-28">
              {inventoryDonutData.length > 0 ? (
                <PieChart width={112} height={112}>
                  <Pie
                    data={inventoryDonutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={50}
                    paddingAngle={2}
                    stroke="var(--admin-card)"
                    strokeWidth={1}
                  >
                    {inventoryDonutData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | undefined, name: string | undefined) => [value ?? 0, name ?? '']}
                    contentStyle={{ backgroundColor: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 6, fontSize: 11 }}
                  />
                </PieChart>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">No data</div>
              )}
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Low Stock</span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--admin-text)' }}>{inventorySummary?.lowStockCount ?? 0}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Out of Stock</span>
                <span className="font-semibold tabular-nums text-red-400">{inventorySummary?.outOfStockCount ?? 0}</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-2 border-t" style={{ borderColor: 'var(--admin-border)' }}>
                <span className="text-slate-400">Value</span>
                <span className="font-semibold tabular-nums truncate" style={{ color: 'var(--admin-text)' }}>
                  {inventorySummary != null ? `${CURRENCY}${inventorySummary.totalValue.toLocaleString('en-PH', { maximumFractionDigits: 0 })}` : '—'}
                </span>
              </div>
            </div>
          </div>
        </section>
    </div>
  );
}
