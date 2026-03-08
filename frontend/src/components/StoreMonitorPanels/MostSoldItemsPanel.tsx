import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Props = {
  data: Array<{ product: { name: string }; quantity: number }>;
  dateRangeStart: string;
  dateRangeEnd: string;
};

export function MostSoldItemsPanel({ data, dateRangeStart, dateRangeEnd }: Props) {
  const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };
  const chartData = data.map((d) => ({
    name: d.product.name.length > 28 ? d.product.name.slice(0, 25) + '…' : d.product.name,
    quantity: d.quantity,
    fullName: d.product.name,
  }));
  return (
    <div className="h-full flex flex-col rounded-xl border overflow-hidden" style={cardBg}>
      <div className="flex-1 min-h-0 p-4 flex flex-col">
        <p className="text-sm text-slate-400 mb-2 shrink-0">{dateRangeStart} to {dateRangeEnd}</p>
        <div className="flex-1 min-h-0">
          {!chartData.length ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">No sales data for selected range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
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
    </div>
  );
}
