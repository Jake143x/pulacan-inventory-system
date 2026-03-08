import { PieChart, Pie, Cell, Tooltip } from 'recharts';

const CURRENCY = '₱';

type InventorySummary = {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  overstockedCount: number;
};

type Props = {
  summary: InventorySummary | null;
};

export function InventoryHealthPanel({ summary }: Props) {
  const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };
  const donutData =
    summary != null
      ? (() => {
          const { totalProducts, lowStockCount, outOfStockCount, overstockedCount } = summary;
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
    <div className="h-full flex flex-col rounded-xl border overflow-hidden" style={cardBg}>
      <div className="flex-1 min-h-0 p-4 flex flex-col sm:flex-row gap-6 items-center justify-center">
        <div className="shrink-0 w-40 h-40">
          {donutData.length > 0 ? (
            <PieChart width={160} height={160}>
              <Pie
                data={donutData}
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
                {donutData.map((entry, index) => (
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
            <span className="font-semibold tabular-nums" style={{ color: 'var(--admin-text)' }}>{summary?.lowStockCount ?? 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">Out of Stock</span>
            <span className="font-semibold tabular-nums text-red-400">{summary?.outOfStockCount ?? 0}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: 'var(--admin-border)' }}>
            <span className="text-sm text-slate-400">Inventory Value</span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--admin-text)' }}>
              {summary != null ? `${CURRENCY}${summary.totalValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
