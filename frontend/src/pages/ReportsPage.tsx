import { useCallback, useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Link } from 'react-router-dom';
import { reports, ai } from '../api/client';
import type { AiPrediction } from '../api/client';

const CURRENCY = '₱';

const chartTheme = {
  grid: '#737373',
  actualStroke: '#fafafa',
  predictedStroke: '#d4d4d4',
  text: '#d6d3d1',
  tooltipBg: '#262626',
  barFill: '#a3a3a3',
};

const PIE_COLORS = ['#fafafa', '#e7e5e4', '#d6d3d1', '#a8a29e', '#78716c', '#57534e', '#44403c', '#78716c', '#a8a29e', '#d6d3d1', '#e7e5e4'];

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

function getRangeForPeriod(period: Period): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case 'daily':
      start.setDate(start.getDate() - 1);
      break;
    case 'weekly':
      start.setDate(start.getDate() - 7);
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'yearly':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setMonth(start.getMonth() - 1);
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [sales, setSales] = useState<{
    data: Array<{ id: number; total: number; createdAt: string }>;
    summary: { totalRevenue: number; totalTransactions: number };
  } | null>(null);
  const [inventoryReport, setInventoryReport] = useState<{ lowStockCount: number; data: unknown[] } | null>(null);
  const [bestSelling, setBestSelling] = useState<Array<{ product: { name: string }; quantity: number }>>([]);
  const [revenueTrends, setRevenueTrends] = useState<Array<{ date: string; revenue: number }>>([]);
  const [dailyUnits, setDailyUnits] = useState<Array<{ date: string; units: number }>>([]);
  const [salesByCategory, setSalesByCategory] = useState<Array<{ category: string; revenue: number; percentage: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [predictions, setPredictions] = useState<AiPrediction[]>([]);
  const [predictLoading, setPredictLoading] = useState(false);
  const [runningPredict, setRunningPredict] = useState(false);

  const effectiveRange = useCustomRange
    ? { start: startDate, end: endDate }
    : getRangeForPeriod(period);

  const loadAnalytics = useCallback(() => {
    setErr('');
    setLoading(true);
    const start = effectiveRange.start;
    const end = effectiveRange.end;
    reports
      .analytics({ startDate: start, endDate: end })
      .then((batch) => {
        setSales(batch.sales ?? null);
        setInventoryReport(batch.inventory ?? null);
        setBestSelling(Array.isArray(batch.bestSelling?.data) ? batch.bestSelling.data : []);
        setRevenueTrends(Array.isArray(batch.revenueTrends?.data) ? batch.revenueTrends.data : []);
        setDailyUnits(Array.isArray(batch.dailyUnits?.data) ? batch.dailyUnits.data : []);
        setSalesByCategory(Array.isArray(batch.salesByCategory?.data) ? batch.salesByCategory.data : []);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [effectiveRange.start, effectiveRange.end]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const loadPredictions = useCallback(() => {
    setPredictLoading(true);
    ai.predictions()
      .then((r) => setPredictions(r.data ?? []))
      .catch(() => setPredictions([]))
      .finally(() => setPredictLoading(false));
  }, []);

  useEffect(() => {
    loadPredictions();
  }, [loadPredictions]);

  const runPredict = async () => {
    setRunningPredict(true);
    try {
      await ai.runPredict();
      loadPredictions();
    } catch {
      // ignore
    } finally {
      setRunningPredict(false);
    }
  };

  const applyPeriod = (p: Period) => {
    setUseCustomRange(false);
    setPeriod(p);
    const r = getRangeForPeriod(p);
    setStartDate(r.start);
    setEndDate(r.end);
  };

  const resetRange = () => {
    setUseCustomRange(false);
    setPeriod('monthly');
    const r = getRangeForPeriod('monthly');
    setStartDate(r.start);
    setEndDate(r.end);
  };

  const totalRevenue = sales?.summary?.totalRevenue ?? 0;
  const totalTransactions = sales?.summary?.totalTransactions ?? 0;
  const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const activeProducts = inventoryReport?.data?.length ?? 0;
  const lowStockCount = inventoryReport?.lowStockCount ?? 0;

  const formatDate = (s: string) => new Date(s).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDateShort = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

  // Build combined data for Sales Volume & Forecast: actual + 7-day predicted (simple avg of last 7 days)
  const volumeForecastData = (() => {
    const actual = dailyUnits.map((d) => ({ date: d.date, dateLabel: formatDateShort(d.date), actual: d.units, predicted: null as number | null }));
    if (actual.length === 0) return [];
    const last7 = actual.slice(-7).map((a) => a.actual);
    const avg = last7.length ? last7.reduce((s, n) => s + n, 0) / last7.length : 0;
    const lastDate = actual[actual.length - 1]?.date;
    if (!lastDate || avg === 0) return actual;
    const predicted: Array<{ date: string; dateLabel: string; actual: number | null; predicted: number }> = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      predicted.push({ date: dateStr, dateLabel: formatDateShort(dateStr), actual: null, predicted: Math.round(avg) });
    }
    return [...actual, ...predicted];
  })();

  const retryAnalytics = () => loadAnalytics();

  const isRateLimit = /too many requests/i.test(err);

  if (err) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-white">Analytics</h1>
        <div className="rounded-xl bg-neutral-900 border border-neutral-600 p-6 card-3d">
          <p className="text-neutral-200 mb-2">Analytics couldn’t load: {err}</p>
          {isRateLimit ? (
            <p className="text-neutral-400 text-sm mb-4">
              The server is temporarily limiting requests. Wait a few minutes and click Retry, or restart the backend server to reset the limit.
            </p>
          ) : (
            <p className="text-neutral-400 text-sm mb-4">
              This can be due to permissions (Admin only), network issues, or the server being unavailable. Check that you’re logged in as Admin and the backend is running.
            </p>
          )}
          <button type="button" onClick={retryAnalytics} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] font-medium btn-3d">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Analytics</h1>

      {/* Analytics Period */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-600 p-5 card-3d">
        <h2 className="text-sm font-semibold text-white mb-1">Analytics Period</h2>
        <p className="text-xs text-neutral-300 mb-4">Quick filters, specific date, or select custom date range.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${period === p && !useCustomRange ? 'bg-white text-black' : 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600'}`}
            >
              {p === 'daily' ? 'Daily' : p === 'weekly' ? 'Weekly' : p === 'monthly' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-300">Specific date:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setUseCustomRange(true); }}
              className="px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-300">Range:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setUseCustomRange(true); }}
              className="px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white text-sm w-40"
            />
            <span className="text-neutral-400">–</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setUseCustomRange(true); }}
              className="px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white text-sm w-40"
            />
            <button type="button" onClick={resetRange} className="text-neutral-300 hover:text-white text-sm">× Reset</button>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          Showing {period === 'daily' ? 'daily' : period === 'weekly' ? 'weekly' : period === 'monthly' ? 'monthly' : 'yearly'} analytics: {formatDate(effectiveRange.start)} – {formatDate(effectiveRange.end)}
        </p>
      </div>

      {/* Metric cards */}
      {loading ? (
        <div className="text-neutral-300 py-8">Loading analytics…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-neutral-900 rounded-xl border border-neutral-600 p-5 card-3d">
              <p className="text-sm text-neutral-300">Total Revenue</p>
              <p className="text-2xl font-bold text-white mt-0.5">
                {CURRENCY}{totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-neutral-400 mt-1">From {totalTransactions} transactions in period</p>
            </div>
            <div className="bg-neutral-900 rounded-xl border border-neutral-600 p-5 card-3d">
              <p className="text-sm text-neutral-300">Units Sold</p>
              <p className="text-2xl font-bold text-white mt-0.5">
                {bestSelling.reduce((sum, b) => sum + b.quantity, 0).toLocaleString()}
              </p>
              <p className="text-xs text-neutral-400 mt-1">Last period</p>
            </div>
            <div className="bg-neutral-900 rounded-xl border border-neutral-600 p-5 card-3d">
              <p className="text-sm text-neutral-300">Avg Order Value</p>
              <p className="text-2xl font-bold text-white mt-0.5">
                {CURRENCY}{avgOrderValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-neutral-400 mt-1">Per transaction</p>
            </div>
            <div className="bg-neutral-900 rounded-xl border border-neutral-600 p-5 card-3d">
              <p className="text-sm text-neutral-300">Active Products</p>
              <p className="text-2xl font-bold text-white mt-0.5">{activeProducts}</p>
              <p className="text-xs text-neutral-400 mt-1">{lowStockCount} need reordering</p>
            </div>
          </div>

          {/* Sales Volume & Forecast | Sales by Category — side by side */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: Sales Volume & Forecast — line chart */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-600 p-5 card-3d">
              <h2 className="font-semibold text-white mb-1">Sales Volume & Forecast</h2>
              <p className="text-xs text-neutral-300 mb-4">Units sold with 7-day prediction</p>
              {volumeForecastData.length === 0 ? (
                <p className="text-neutral-400 text-sm py-8">No sales in this period. Run the seed with sample sales or add POS transactions.</p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={volumeForecastData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} strokeOpacity={0.8} />
                      <XAxis dataKey="dateLabel" tick={{ fill: chartTheme.text, fontSize: 12 }} />
                      <YAxis tick={{ fill: chartTheme.text, fontSize: 12 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: chartTheme.tooltipBg, border: '1px solid #475569', borderRadius: 8 }}
                        labelStyle={{ color: '#e2e8f0' }}
                        formatter={(value: number | undefined) => (value != null ? [value, 'Units'] : [])}
                        labelFormatter={(label) => label}
                      />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        name="Actual Sales"
                        stroke={chartTheme.actualStroke}
                        strokeWidth={2.5}
                        dot={{ fill: chartTheme.actualStroke, r: 5 }}
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        name="Predicted"
                        stroke={chartTheme.predictedStroke}
                        strokeWidth={2.5}
                        strokeDasharray="5 5"
                        dot={{ fill: chartTheme.predictedStroke, r: 4, strokeWidth: 2 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="flex justify-center gap-6 mt-2 text-xs text-neutral-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-neutral-200" /> Actual Sales
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 border-t-2 border-dashed border-neutral-400" /> Predicted
                </span>
              </div>
            </div>

            {/* Right: Sales by Category — pie chart */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-600 p-5 card-3d">
              <h2 className="font-semibold text-white mb-1">Sales by Category</h2>
              <p className="text-xs text-neutral-300 mb-4">Revenue distribution across categories</p>
              {salesByCategory.length === 0 ? (
                <p className="text-neutral-400 text-sm py-8">No sales in this period.</p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={salesByCategory.map((row, i) => ({ name: `${row.category} ${row.percentage}%`, value: row.revenue, fill: PIE_COLORS[i % PIE_COLORS.length] }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={1}
                        dataKey="value"
                        label={({ name }) => name}
                        labelLine={{ stroke: chartTheme.text, strokeWidth: 1.5 }}
                      >
                        {salesByCategory.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: chartTheme.tooltipBg, border: '1px solid #475569', borderRadius: 8 }}
                        formatter={(value: number | undefined) => [CURRENCY + (value ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }), 'Revenue']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Revenue trend — line chart */}
          <div className="bg-neutral-900 rounded-xl border border-neutral-600 p-5 card-3d">
            <h2 className="font-semibold text-white mb-1">Revenue trend</h2>
            <p className="text-xs text-neutral-300 mb-4">Daily revenue for the period</p>
            {revenueTrends.length === 0 ? (
              <p className="text-neutral-400 text-sm py-4">No revenue data in this period.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueTrends.map((t) => ({ ...t, dateLabel: formatDateShort(t.date) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} strokeOpacity={0.8} />
                    <XAxis dataKey="dateLabel" tick={{ fill: chartTheme.text, fontSize: 12 }} />
                    <YAxis tick={{ fill: chartTheme.text, fontSize: 12 }} tickFormatter={(v) => `${CURRENCY}${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: chartTheme.tooltipBg, border: '1px solid #475569', borderRadius: 8 }}
                      formatter={(value: number | undefined) => [CURRENCY + (value ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }), 'Revenue']}
                      labelFormatter={(label) => label}
                    />
                    <Line type="monotone" dataKey="revenue" stroke={chartTheme.actualStroke} strokeWidth={2.5} dot={{ fill: chartTheme.actualStroke, r: 4 }} name="Revenue" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Best selling — bar chart */}
          <div className="bg-neutral-900 rounded-xl border border-neutral-600 p-5 card-3d">
            <h2 className="font-semibold text-white mb-1">Best selling items</h2>
            <p className="text-xs text-neutral-300 mb-4">By units sold in period (top 10)</p>
            {bestSelling.length === 0 ? (
              <p className="text-neutral-400 text-sm py-4">No sales in this period.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={bestSelling.slice(0, 10).map((b) => ({ name: (b.product?.name ?? 'Unknown').slice(0, 20), quantity: b.quantity }))}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 80, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} strokeOpacity={0.8} />
                    <XAxis type="number" tick={{ fill: chartTheme.text, fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: chartTheme.text, fontSize: 12 }} width={72} />
                    <Tooltip contentStyle={{ backgroundColor: chartTheme.tooltipBg, border: '1px solid #475569', borderRadius: 8 }} formatter={(value: number | undefined) => [value ?? 0, 'Units sold']} />
                    <Bar dataKey="quantity" fill={chartTheme.barFill} name="Units sold" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-neutral-900 rounded-xl border border-neutral-600 overflow-hidden card-3d">
            <h2 className="font-semibold text-white p-4 border-b border-neutral-600">Sales transactions</h2>
            {(sales?.data?.length ?? 0) === 0 ? (
              <p className="text-neutral-400 text-sm p-4">No transactions in this period.</p>
            ) : (
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-neutral-800/80">
                    <tr>
                      <th className="px-4 py-2 text-xs text-neutral-300">ID</th>
                      <th className="px-4 py-2 text-xs text-neutral-300">Total</th>
                      <th className="px-4 py-2 text-xs text-neutral-300">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-700">
                    {(sales?.data ?? []).map((s) => (
                      <tr key={s.id} className="text-neutral-200">
                        <td className="px-4 py-2">{s.id}</td>
                        <td className="px-4 py-2">{CURRENCY}{s.total.toFixed(2)}</td>
                        <td className="px-4 py-2">{new Date(s.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Demand forecasting & reorder */}
          <div className="bg-neutral-900 rounded-xl border border-neutral-600 p-5 card-3d">
            <h2 className="font-semibold text-white mb-1">Demand forecasting & reorder</h2>
            <p className="text-xs text-neutral-300 mb-4">Predictive analytics: demand forecast and suggested restock. Use the <Link to="/ai" className="text-[#2563EB] hover:underline">Assistant</Link> to ask for demand forecast or reorder suggestions.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button type="button" onClick={runPredict} disabled={runningPredict} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] disabled:opacity-50 font-medium text-sm btn-3d">
                {runningPredict ? 'Generating...' : 'Generate predictions'}
              </button>
              <button type="button" onClick={loadPredictions} disabled={predictLoading} className="px-4 py-2 bg-neutral-700 text-neutral-200 rounded-lg hover:bg-neutral-600 disabled:opacity-50 text-sm">Refresh</button>
            </div>
            {predictLoading ? (
              <p className="text-neutral-400 text-sm">Loading predictions...</p>
            ) : predictions.length === 0 ? (
              <p className="text-neutral-400 text-sm">No demand predictions yet. Click &quot;Generate predictions&quot; to run predictive analytics (uses last 30 days of sales).</p>
            ) : (
              <>
                <div className="overflow-x-auto max-h-48 overflow-y-auto mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-800/80">
                      <tr>
                        <th className="px-4 py-2 text-left text-neutral-300">Product</th>
                        <th className="px-4 py-2 text-left text-neutral-300">Predicted demand (7d)</th>
                        <th className="px-4 py-2 text-left text-neutral-300">Suggested restock</th>
                        <th className="px-4 py-2 text-left text-neutral-300">Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-700">
                      {predictions.slice(0, 15).map((p) => (
                        <tr key={p.id} className="text-neutral-200">
                          <td className="px-4 py-2">{p.product?.name ?? '-'}</td>
                          <td className="px-4 py-2">{p.predictedDemand}</td>
                          <td className="px-4 py-2">{p.suggestedRestock}</td>
                          <td className="px-4 py-2">
                            <span className={p.riskOfStockout === 'HIGH' ? 'text-amber-400' : p.riskOfStockout === 'MEDIUM' ? 'text-amber-300' : 'text-neutral-500'}>{p.riskOfStockout ?? '-'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(inventoryReport?.lowStockCount ?? 0) > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-white mb-2">Low stock — reorder suggested</h3>
                    <p className="text-neutral-400 text-xs mb-2">{inventoryReport?.lowStockCount ?? 0} item(s) below threshold. Check Inventory or ask the Assistant: &quot;What should I reorder?&quot;</p>
                    <Link to="/inventory?lowStock=true" className="text-sm text-[#2563EB] hover:underline">View low stock in Inventory →</Link>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
