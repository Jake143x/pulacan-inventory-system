import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { reports } from '../api/client';

const CURRENCY = '₱';
const POLL_INTERVAL_MS = 10000;

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

type ChartPoint = { hour?: string; date?: string; revenue: number; orders: number };

export default function SalesChartFullPage() {
  const [searchParams] = useSearchParams();
  const defaultRange = getDefaultDateRange();
  const startParam = searchParams.get('start') || defaultRange.startDate;
  const endParam = searchParams.get('end') || defaultRange.endDate;
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [mode, setMode] = useState<'hourly' | 'daily'>('daily');
  const [loading, setLoading] = useState(true);

  const load = () => {
    reports
      .salesChart({ startDate: startParam, endDate: endParam })
      .then((r) => {
        setChartData(r.data ?? []);
        setMode(r.mode ?? 'daily');
      })
      .catch(() => setChartData([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [startParam, endParam]);

  useEffect(() => {
    const t = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [startParam, endParam]);

  const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };
  const xKey = mode === 'hourly' ? 'hour' : 'date';

  return (
    <div className="min-h-screen flex flex-col admin-canvas" style={{ backgroundColor: 'var(--admin-bg)' }}>
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b shrink-0" style={cardBg}>
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="text-sm font-medium px-3 py-2 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: 'var(--admin-text)' }}
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--admin-text)' }}>
            Daily Sales — Full Screen
          </h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden /> LIVE
          </span>
          <span className="text-sm text-slate-400">
            {startParam} to {endParam} {mode === 'hourly' && '(by hour)'}
          </span>
          <a
            href="/fullscreen-monitor"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors"
          >
            Open TV / Wall Display (new tab)
          </a>
          <Link
            to="/monitor"
            className="text-sm font-medium px-3 py-2 rounded-lg text-slate-300 border border-slate-600 hover:bg-white/10 transition-colors"
          >
            Tabbed monitor
          </Link>
        </div>
      </header>
      <main className="flex-1 p-6 min-h-0">
        <div className="h-full min-h-[calc(100vh-120px)] rounded-2xl border overflow-hidden card-3d" style={cardBg}>
          {loading && chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">Loading chart...</div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">No data for selected range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={400}>
              <LineChart data={chartData} margin={{ top: 24, right: 56, left: 24, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" vertical={false} />
                <XAxis dataKey={xKey} tick={{ fill: 'var(--admin-text)', fontSize: 12 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: 'var(--admin-text)', fontSize: 12 }}
                  tickFormatter={(v) => `${CURRENCY}${Number(v).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`}
                />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--admin-text)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--admin-text)' }}
                  formatter={(value: number | undefined, name: string) => {
                    if (name === 'revenue') return [`${CURRENCY}${Number(value ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Revenue'];
                    return [value ?? 0, 'Orders'];
                  }}
                />
                <Line type="monotone" dataKey="revenue" yAxisId="left" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 4 }} activeDot={{ r: 6 }} name="Revenue" />
                <Line type="monotone" dataKey="orders" yAxisId="right" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} activeDot={{ r: 6 }} name="Orders" />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => (value === 'Revenue' ? `${value} (₱)` : value)} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </main>
    </div>
  );
}
