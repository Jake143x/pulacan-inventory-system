import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CURRENCY = '₱';

type ChartPoint = { hour?: string; date?: string; revenue: number; orders: number };

type Props = {
  data: ChartPoint[];
  mode: 'hourly' | 'daily';
};

/** Convert "08:00" / "13:00" to 12-hour Philippine label: "8 AM", "1 PM", "12 PM", "12 AM". */
function hourTo12hLabel(hourStr: string): string {
  const match = hourStr.match(/^(\d{1,2}):00$/);
  if (!match) return hourStr;
  const h = parseInt(match[1], 10);
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

/** Peak hour from hourly data: max revenue, earliest hour if tie. */
function getPeakHour(data: ChartPoint[]): ChartPoint | null {
  if (!data.length || !data.some((d) => 'hour' in d && d.hour)) return null;
  const hourly = data.filter((d) => d.hour != null) as Array<{ hour: string; revenue: number; orders: number }>;
  if (!hourly.length) return null;
  return hourly.reduce((max, cur) => (cur.revenue > max.revenue ? cur : max), hourly[0]);
}

/** Heatmap color by revenue intensity: no sales → dark gray, then blue → green → yellow → red. */
function heatmapColor(revenue: number, maxRevenue: number): string {
  if (revenue <= 0) return '#374151'; // dark gray
  if (maxRevenue <= 0) return '#374151';
  const t = revenue / maxRevenue;
  if (t >= 0.8) return '#DC2626'; // red - peak
  if (t >= 0.5) return '#EAB308'; // yellow - high
  if (t >= 0.25) return '#22C55E'; // green - medium
  return '#3B82F6'; // blue - low
}

export function DailySalesPanel({ data, mode }: Props) {
  const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };
  const isHourly = mode === 'hourly' && data.some((d) => d.hour != null);
  const peakHour = isHourly ? getPeakHour(data) : null;
  const maxRevenue = isHourly && data.length ? Math.max(...data.map((d) => d.revenue)) : 0;

  return (
    <div className="h-full min-h-[320px] flex flex-col rounded-xl overflow-hidden" style={cardBg}>
      <div className="flex-1 min-h-0 p-4 flex flex-col gap-4">
        {peakHour && (
          <div className="shrink-0 flex items-center gap-6 flex-wrap" style={{ borderColor: 'var(--admin-border)', borderBottomWidth: 1, paddingBottom: 12 }}>
            <div className="rounded-lg px-4 py-2.5 min-w-[180px]" style={{ backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Peak Sales Hour</p>
              <p className="text-lg font-semibold mt-0.5" style={{ color: 'var(--admin-text)' }}>{hourTo12hLabel(peakHour.hour!)}</p>
              <p className="text-sm font-medium text-emerald-400 mt-0.5">{CURRENCY}{peakHour.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        )}
        <div className="flex-1 min-h-[280px]">
          {!data.length ? (
            <div className="h-full min-h-[260px] flex items-center justify-center text-slate-500 text-sm">No data for selected range. Data updates every 10s.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" vertical={false} />
                <XAxis
                  dataKey={mode === 'hourly' ? 'hour' : 'date'}
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
                  formatter={(value: number | undefined, name: string) => {
                    if (name === 'revenue') return [`${CURRENCY}${Number(value ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Revenue'];
                    return [value ?? 0, 'Orders'];
                  }}
                />
                <Line type="monotone" dataKey="revenue" yAxisId="left" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 3 }} activeDot={{ r: 5 }} name="Revenue" />
                <Line type="monotone" dataKey="orders" yAxisId="right" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 3 }} activeDot={{ r: 5 }} name="Orders" />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => (value === 'Revenue' ? `${value} (₱)` : value)} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        {isHourly && data.length > 0 && (
          <div className="shrink-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Sales heatmap (24-hour activity)</p>
            <div className="overflow-x-auto">
              <div className="inline-grid gap-0.5 sm:gap-1 min-w-full" style={{ gridTemplateColumns: 'repeat(24, minmax(28px, 1fr))' }}>
              {data.map((d, i) => {
                const hourLabel = d.hour ? hourTo12hLabel(d.hour) : '';
                const color = heatmapColor(d.revenue, maxRevenue);
                const tooltip = `${hourLabel}\nRevenue: ${CURRENCY}${d.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}\nOrders: ${d.orders}`;
                return (
                  <div
                    key={d.hour ?? i}
                    className="aspect-square min-h-[24px] rounded flex flex-col items-center justify-center text-white text-[9px] sm:text-[10px] font-medium cursor-default border border-white/10"
                    style={{ backgroundColor: color }}
                    title={tooltip}
                  >
                    <span className="truncate w-full text-center leading-tight">{hourLabel}</span>
                  </div>
                );
              })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-slate-400">
              <span><span className="inline-block w-3 h-3 rounded mr-1" style={{ backgroundColor: '#374151' }} /> No sales</span>
              <span><span className="inline-block w-3 h-3 rounded mr-1 bg-blue-500" /> Low</span>
              <span><span className="inline-block w-3 h-3 rounded mr-1 bg-green-500" /> Medium</span>
              <span><span className="inline-block w-3 h-3 rounded mr-1 bg-yellow-500" /> High</span>
              <span><span className="inline-block w-3 h-3 rounded mr-1 bg-red-600" /> Peak</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
