import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ai } from '../api/client';
import type { BusinessReport } from '../api/client';

const CURRENCY = '₱';

const cardStyle = 'rounded-xl border p-5 bg-slate-900/80 border-slate-700/80';
const BORDER_GLOW = 'border-cyan-500/30';

function ImpactBadge({ impact }: { impact: 'High' | 'Medium' | 'Low' }) {
  const c = impact === 'High' ? 'bg-red-500/20 text-red-400' : impact === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400';
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${c}`}>{impact} Impact</span>;
}

export default function AIPage() {
  const { user } = useAuth();
  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const [report, setReport] = useState<BusinessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const loadReport = () => {
    if (!isOwnerOrAdmin) return;
    setLoading(true);
    setErr('');
    ai.businessReport({ startDate, endDate })
      .then(setReport)
      .catch((e: unknown) => {
        setReport(null);
        setErr(e instanceof Error ? e.message : 'Failed to load report');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOwnerOrAdmin) loadReport();
  }, [isOwnerOrAdmin]);

  if (!isOwnerOrAdmin) {
    return (
      <div className={`rounded-xl border p-6 max-w-md ${cardStyle}`}>
        <h1 className="text-xl font-semibold mb-2 text-cyan-400/90">AI Business Intelligence</h1>
        <p className="text-sm text-slate-400">Available for Administrator and Owner only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* AI Analysis Period */}
      <section className={`rounded-xl border-2 ${BORDER_GLOW} p-5 bg-slate-900/80`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400/90 mb-2">AI Analysis Period</h2>
        <p className="text-sm text-slate-400 mb-4">Select a date range for AI predictions and insights</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <span>From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-lg border bg-slate-800/80 text-slate-200"
              style={{ borderColor: 'var(--admin-border)' }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <span>To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-lg border bg-slate-800/80 text-slate-200"
              style={{ borderColor: 'var(--admin-border)' }}
            />
          </label>
          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-medium text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Generate report'}
          </button>
        </div>
      </section>

      {err && <p className="text-red-400 text-sm">{err}</p>}

      {loading && !report && (
        <div className={`${cardStyle} p-12 text-center`}>
          <p className="text-slate-400">Loading report...</p>
        </div>
      )}

      {!loading && !report && !err && (
        <div className={`${cardStyle} p-12 text-center`}>
          <p className="text-slate-400">Select dates and click &quot;Generate report&quot; to run the AI analysis.</p>
        </div>
      )}

      {report && (
        <>
          {/* AI-Powered Business Intelligence header */}
          <section className={`rounded-xl border-2 ${BORDER_GLOW} p-6 bg-gradient-to-br from-slate-900/95 to-cyan-950/20`}>
            <h1 className="text-2xl font-bold text-white">AI-Powered Business Intelligence</h1>
            <p className="text-cyan-400/90 font-medium mt-1">Machine Learning</p>
            <p className="text-sm text-slate-400 mt-2">Predictive analytics and actionable insights for strategic decision-making</p>
          </section>

          {/* 4 stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={cardStyle}>
              <p className="text-sm text-slate-400 mb-1">Inventory Health</p>
              <p className="text-2xl font-bold text-white tabular-nums">{report.stats.daysOfInventory}</p>
              <p className="text-xs text-slate-500">Days of inventory</p>
            </div>
            <div className={cardStyle}>
              <p className="text-sm text-slate-400 mb-1">Avg Daily Demand</p>
              <p className="text-2xl font-bold text-white tabular-nums">{report.stats.avgDailyDemand}</p>
              <p className="text-xs text-slate-500">Units per day</p>
            </div>
            <div className={cardStyle}>
              <p className="text-sm text-slate-400 mb-1">Stock Value</p>
              <p className="text-2xl font-bold text-white tabular-nums">
                {report.stats.stockValue >= 1000 ? `${CURRENCY}${(report.stats.stockValue / 1000).toFixed(1)}K` : `${CURRENCY}${report.stats.stockValue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`}
              </p>
              <p className="text-xs text-slate-500">Total inventory</p>
            </div>
            <div className={cardStyle}>
              <p className="text-sm text-slate-400 mb-1">AI Insights</p>
              <p className="text-2xl font-bold text-white tabular-nums">{report.stats.activeRecommendations}</p>
              <p className="text-xs text-slate-500">Active recommendations</p>
            </div>
          </div>

          {/* AI-Generated Insights */}
          <section className={`rounded-xl border-2 ${BORDER_GLOW} p-6 bg-slate-900/80`}>
            <h2 className="text-lg font-bold text-white">AI-Generated Insights</h2>
            <p className="text-sm text-slate-400 mt-1 mb-6">Machine learning predictions and strategic recommendations</p>
            <div className="space-y-5">
              {report.insights.map((insight, i) => (
                <div key={i} className="rounded-xl border p-4 bg-slate-800/60 border-slate-700/60">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="font-semibold text-white">{insight.title}</h3>
                    <ImpactBadge impact={insight.impact} />
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{insight.text}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    <span className="text-cyan-400/90 font-medium">Confidence:</span> {insight.confidence}%
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 30-Day Forecast */}
          <section className={`rounded-xl border-2 ${BORDER_GLOW} p-6 bg-slate-900/80`}>
            <h2 className="text-lg font-bold text-white mb-1">30-Day Forecast</h2>
            <p className="text-sm text-slate-400 mb-6">AI predictions for the next month</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border p-4 bg-slate-800/60 border-slate-700/60">
                <p className="text-sm text-slate-400 mb-1">Expected Sales Volume</p>
                <p className="text-xl font-bold text-white tabular-nums">{report.forecast.expectedSalesVolume}</p>
                <p className="text-xs text-slate-500">Total units</p>
                <p className={`text-xs font-medium mt-1 ${report.forecast.salesVolumeChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {report.forecast.salesVolumeChangePercent >= 0 ? '+' : ''}{report.forecast.salesVolumeChangePercent}%
                </p>
              </div>
              <div className="rounded-xl border p-4 bg-slate-800/60 border-slate-700/60">
                <p className="text-sm text-slate-400 mb-1">Projected Revenue</p>
                <p className="text-xl font-bold text-white tabular-nums">{CURRENCY}{report.forecast.projectedRevenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}</p>
                <p className="text-xs text-slate-500">Next 30 days</p>
                <p className={`text-xs font-medium mt-1 ${report.forecast.revenueChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {report.forecast.revenueChangePercent >= 0 ? '+' : ''}{report.forecast.revenueChangePercent}%
                </p>
              </div>
              <div className="rounded-xl border p-4 bg-slate-800/60 border-slate-700/60">
                <p className="text-sm text-slate-400 mb-1">Reorder Requirements</p>
                <p className="text-xl font-bold text-white tabular-nums">{report.forecast.reorderRequirementsCount}</p>
                <p className="text-xs text-slate-500">Products needing stock</p>
              </div>
            </div>
          </section>

          {/* AI Recommendations */}
          <section className={`rounded-xl border-2 ${BORDER_GLOW} p-6 bg-slate-900/80`}>
            <h2 className="text-lg font-bold text-white mb-1">AI Recommendations</h2>
            <p className="text-sm text-slate-400 mb-6">Strategic actions for growth</p>
            <ul className="space-y-4">
              {report.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-4 rounded-xl border p-4 bg-slate-800/60 border-slate-700/60">
                  <span className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{rec.title}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{rec.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
