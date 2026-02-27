import { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { analytics } from '../api/client';

const CURRENCY = '₱';
const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };

function AnimatedValue({ value, formatter = (v: number) => String(v), duration = 400 }: { value: number; formatter?: (v: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    fromRef.current = display;
  }, [display]);
  useEffect(() => {
    const start = fromRef.current;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const next = Math.round((start + (value - start) * t) * 100) / 100;
      setDisplay(next);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <span>{formatter(display)}</span>;
}

export default function AnalyticsPage() {
  const [forecast, setForecast] = useState<{
    predictedRevenue7d: number;
    predictedRevenue30d: number;
    predictedSalesGrowthPct: number;
    predictedStockOutCount: number;
    previousPeriodRevenue: number;
  } | null>(null);
  const [chartRange, setChartRange] = useState<'30' | '90' | 'custom'>('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [chartData, setChartData] = useState<Array<{ date: string; revenue: number; historical?: number; forecast?: number }>>([]);
  const [, setHistoricalCount] = useState(0);
  const [depletion, setDepletion] = useState<Array<{
    productName: string;
    currentQuantity: number;
    avgDailySales: number;
    estimatedDaysLeft: number | null;
    riskLevel: string;
  }>>([]);
  const [reorder, setReorder] = useState<Array<{
    productName: string;
    suggestedReorderQuantity: number;
    recommendedTimeframe: string;
    reason: string;
  }>>([]);
  const [slowDays, setSlowDays] = useState(30);
  const [slowMoving, setSlowMoving] = useState<Array<{ productName: string; daysSinceLastSale: number; currentQuantity: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);

  const loadForecast = () => {
    analytics.forecastSummary()
      .then((d) => { setForecast(d); setLoading(false); })
      .catch(() => { setForecast(null); setLoading(false); });
  };

  const loadChart = () => {
    setChartLoading(true);
    const params: { range: string; startDate?: string; endDate?: string } = { range: chartRange };
    if (chartRange === 'custom' && customStart) params.startDate = customStart;
    if (chartRange === 'custom' && customEnd) params.endDate = customEnd;
    analytics.salesForecast(params)
      .then((r) => {
        const histCount = r.historicalCount;
        setHistoricalCount(histCount);
        setChartData(r.data.map((d) => ({
          date: d.date,
          revenue: d.revenue,
          historical: d.forecast ? undefined : d.revenue,
          forecast: d.forecast ? d.revenue : undefined,
        })));
      })
      .catch(() => setChartData([]))
      .finally(() => setChartLoading(false));
  };

  const loadDepletion = () => {
    analytics.stockDepletion().then((r) => setDepletion(r.data)).catch(() => setDepletion([]));
  };

  const loadReorder = () => {
    analytics.reorderRecommendations().then((r) => setReorder(r.data)).catch(() => setReorder([]));
  };

  const loadSlowMoving = () => {
    analytics.slowMoving({ days: slowDays }).then((r) => setSlowMoving(r.data)).catch(() => setSlowMoving([]));
  };

  useEffect(() => { loadForecast(); loadDepletion(); loadReorder(); loadSlowMoving(); }, []);
  useEffect(() => { loadSlowMoving(); }, [slowDays]);
  useEffect(() => { loadChart(); }, [chartRange, customStart, customEnd]);

  const chartSeries = chartData.length
    ? chartData.map((d) => ({
        ...d,
        historical: d.historical ?? null,
        forecast: d.forecast ?? null,
      }))
    : [];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header: Forecast Summary */}
      <header className="rounded-2xl border p-6 card-3d" style={cardBg}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--admin-text)' }}>Forecast Summary</h1>
        <p className="text-slate-400 text-sm mt-1">Sales trends, performance insights, and demand projections.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="rounded-xl border p-5 card-3d transition-all duration-300" style={{ backgroundColor: 'var(--admin-bg)', borderColor: 'var(--admin-border)' }}>
            <p className="text-sm text-slate-400">Predicted Revenue – Next 7 Days</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--admin-text)' }}>
              {loading ? '—' : forecast != null ? <AnimatedValue value={forecast.predictedRevenue7d} formatter={(v) => `${CURRENCY}${v.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} /> : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-2">Based on recent sales trend</p>
          </div>
          <div className="rounded-xl border p-5 card-3d transition-all duration-300" style={{ backgroundColor: 'var(--admin-bg)', borderColor: 'var(--admin-border)' }}>
            <p className="text-sm text-slate-400">Predicted Revenue – Next 30 Days</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--admin-text)' }}>
              {loading ? '—' : forecast != null ? <AnimatedValue value={forecast.predictedRevenue30d} formatter={(v) => `${CURRENCY}${v.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} /> : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-2">Trend-based projection</p>
          </div>
          <div className="rounded-xl border p-5 card-3d transition-all duration-300" style={{ backgroundColor: 'var(--admin-bg)', borderColor: 'var(--admin-border)' }}>
            <p className="text-sm text-slate-400">Predicted Sales Growth %</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${forecast && forecast.predictedSalesGrowthPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {loading ? '—' : forecast != null ? <AnimatedValue value={forecast.predictedSalesGrowthPct} formatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`} /> : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-2">Vs previous 30 days</p>
          </div>
          <div className="rounded-xl border p-5 card-3d transition-all duration-300" style={{ backgroundColor: 'var(--admin-bg)', borderColor: 'var(--admin-border)' }}>
            <p className="text-sm text-slate-400">Predicted Stock-Out Products</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--admin-text)' }}>
              {loading ? '—' : forecast != null ? <AnimatedValue value={forecast.predictedStockOutCount} /> : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-2">At risk within 7 days</p>
          </div>
        </div>
      </header>

      {/* 2. Sales Forecast Chart */}
      <section className="rounded-2xl border overflow-hidden card-3d" style={cardBg}>
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--admin-border)' }}>
          <h2 className="text-lg font-medium" style={{ color: 'var(--admin-text)' }}>Sales Forecast</h2>
          <div className="flex flex-wrap gap-2">
            {(['30', '90', 'custom'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setChartRange(r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${chartRange === r ? 'bg-[#2563EB] text-white' : 'text-slate-400 hover:bg-white/5'}`}
              >
                {r === '30' ? 'Last 30 Days' : r === '90' ? 'Last 90 Days' : 'Custom Range'}
              </button>
            ))}
          </div>
          {chartRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-2 py-1.5 rounded-lg border text-sm" style={{ ...cardBg, color: 'var(--admin-text)' }} />
              <span className="text-slate-500">to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-2 py-1.5 rounded-lg border text-sm" style={{ ...cardBg, color: 'var(--admin-text)' }} />
            </div>
          )}
        </div>
        <div className="p-4 h-80">
          {chartLoading ? (
            <div className="h-full flex items-center justify-center text-slate-500">Loading chart...</div>
          ) : chartSeries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">No data for selected range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartSeries} margin={{ top: 8, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--admin-text)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--admin-text)', fontSize: 11 }} tickFormatter={(v) => `${CURRENCY}${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 8 }}
                  formatter={(value: number | undefined, name: string | undefined) => [value != null ? `${CURRENCY}${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—', name === 'historical' ? 'Historical' : 'Forecast']}
                />
                <Legend formatter={(value) => (value === 'historical' ? 'Historical Sales' : 'Forecasted Sales')} />
                <Line type="monotone" dataKey="historical" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} name="historical" connectNulls />
                <Line type="monotone" dataKey="forecast" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} name="forecast" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* 3. Stock Depletion Prediction - Predicted Inventory Risks */}
      <section className="rounded-2xl border overflow-hidden card-3d" style={cardBg}>
        <h2 className="px-5 py-4 border-b text-lg font-medium" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>Predicted Inventory Risks</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-xs font-medium uppercase tracking-wider text-slate-400" style={{ borderColor: 'var(--admin-border)' }}>
                <th className="px-5 py-3">Product Name</th>
                <th className="px-5 py-3">Current Quantity</th>
                <th className="px-5 py-3">Avg Daily Units Sold</th>
                <th className="px-5 py-3">Estimated Days Left</th>
                <th className="px-5 py-3">Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {depletion.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">No inventory data.</td></tr>
              ) : (
                depletion.map((row, idx) => {
                  const qty = row.currentQuantity;
                  const avgDaily = row.avgDailySales;
                  const daysLeft = avgDaily > 0 ? Math.floor(qty / avgDaily) : null;
                  const daysLabel =
                    qty === 0
                      ? 'Out of stock'
                      : avgDaily === 0
                        ? 'No sales data'
                        : `${daysLeft} days remaining`;
                  const riskLevel =
                    qty === 0
                      ? 'Out of Stock'
                      : avgDaily === 0
                        ? 'No Data'
                        : (daysLeft ?? 0) < 7
                          ? 'Critical'
                          : (daysLeft ?? 0) <= 14
                            ? 'Low'
                            : 'Safe';
                  const riskClass =
                    riskLevel === 'Out of Stock' || riskLevel === 'Critical'
                      ? 'bg-red-500/20 text-red-400'
                      : riskLevel === 'Low'
                        ? 'bg-amber-500/20 text-amber-400'
                        : riskLevel === 'No Data'
                          ? 'bg-slate-500/20 text-slate-400'
                          : 'bg-emerald-500/20 text-emerald-400';
                  return (
                    <tr key={idx} className="border-b hover:bg-white/5" style={{ borderColor: 'var(--admin-border)' }}>
                      <td className="px-5 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>{row.productName}</td>
                      <td className="px-5 py-3 tabular-nums text-slate-300">{qty}</td>
                      <td className="px-5 py-3 tabular-nums text-slate-300">{Math.round(avgDaily)}</td>
                      <td className="px-5 py-3 tabular-nums text-slate-300">{daysLabel}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${riskClass}`}>
                          {riskLevel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Smart Reorder Recommendations */}
      <section>
        <h2 className="text-lg font-medium text-slate-300 mb-4">Smart Reorder Recommendations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reorder.length === 0 ? (
            <div className="rounded-2xl border p-8 text-center text-slate-500 card-3d" style={cardBg}>No products at risk. No reorder needed.</div>
          ) : (
            reorder.map((r, idx) => (
              <div key={idx} className="rounded-2xl border p-5 card-3d" style={cardBg}>
                <p className="font-semibold" style={{ color: 'var(--admin-text)' }}>{r.productName}</p>
                <p className="text-sm text-slate-400 mt-1">Suggested reorder: <strong className="text-white">{r.suggestedReorderQuantity}</strong> units</p>
                <p className="text-sm text-slate-400 mt-0.5">Timeframe: <strong className="text-amber-400">{r.recommendedTimeframe}</strong></p>
                <p className="text-xs text-slate-500 mt-2">{r.reason}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 5. Slow Moving / Dead Stock */}
      <section className="rounded-2xl border overflow-hidden card-3d" style={cardBg}>
        <div className="px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--admin-border)' }}>
          <h2 className="text-lg font-medium" style={{ color: 'var(--admin-text)' }}>Slow Moving / Dead Stock</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSlowDays(30)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${slowDays === 30 ? 'bg-[#2563EB] text-white' : 'text-slate-400 hover:bg-white/5'}`}>Not sold in 30 days</button>
            <button type="button" onClick={() => setSlowDays(60)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${slowDays === 60 ? 'bg-[#2563EB] text-white' : 'text-slate-400 hover:bg-white/5'}`}>Not sold in 60 days</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-xs font-medium uppercase tracking-wider text-slate-400" style={{ borderColor: 'var(--admin-border)' }}>
                <th className="px-5 py-3">Product Name</th>
                <th className="px-5 py-3">Days Since Last Sale</th>
                <th className="px-5 py-3">Current Quantity</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {slowMoving.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">No slow-moving products in this period.</td></tr>
              ) : (
                slowMoving.map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-white/5 bg-amber-500/5" style={{ borderColor: 'var(--admin-border)' }}>
                    <td className="px-5 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>{row.productName}</td>
                    <td className="px-5 py-3 tabular-nums text-slate-300">{row.daysSinceLastSale}</td>
                    <td className="px-5 py-3 tabular-nums text-slate-300">{row.currentQuantity}</td>
                    <td className="px-5 py-3"><span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400">Overstock Risk</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
