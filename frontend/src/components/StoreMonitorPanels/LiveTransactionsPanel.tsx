import type { SaleTransaction } from '../../api/client';

const CURRENCY = '₱';

type Props = {
  transactions: SaleTransaction[];
};

export function LiveTransactionsPanel({ transactions }: Props) {
  const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };
  return (
    <div className="h-full flex flex-col rounded-xl border overflow-hidden" style={cardBg}>
      <div className="flex-1 min-h-0 overflow-auto p-4">
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
            {!transactions.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">No transactions today yet. Resets daily.</td>
              </tr>
            ) : (
              transactions.map((t, index) => {
                const dailyInvoiceNum = transactions.length - index;
                return (
                  <tr key={t.id} className="border-b" style={{ borderColor: 'var(--admin-border)' }}>
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
  );
}
