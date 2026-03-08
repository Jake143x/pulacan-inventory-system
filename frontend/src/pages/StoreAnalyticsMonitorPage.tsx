import { useEffect, useState, useCallback } from 'react';
import { reports, inventory } from '../api/client';
import type { SaleTransaction } from '../api/client';
import {
  DailySalesPanel,
  LiveTransactionsPanel,
  MostSoldItemsPanel,
  InventoryHealthPanel,
} from '../components/StoreMonitorPanels';

const POLL_INTERVAL_MS = 10000;
const LIVE_TRANSACTIONS_LIMIT = 10;

type TabId = 'sales' | 'transactions' | 'products' | 'inventory';

const TABS: { id: TabId; label: string }[] = [
  { id: 'sales', label: 'Daily Sales' },
  { id: 'transactions', label: 'POS Transactions' },
  { id: 'products', label: 'Most Sold Items' },
  { id: 'inventory', label: 'Inventory Health' },
];

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

type InventorySummary = {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  overstockedCount: number;
};

export default function StoreAnalyticsMonitorPage() {
  const defaultRange = getDefaultDateRange();
  const [dateRangeStart, setDateRangeStart] = useState(defaultRange.startDate);
  const [dateRangeEnd, setDateRangeEnd] = useState(defaultRange.endDate);
  const [activeTab, setActiveTab] = useState<TabId>('sales');
  const [salesChartData, setSalesChartData] = useState<Array<{ hour?: string; date?: string; revenue: number; orders: number }>>([]);
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

  const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };

  return (
    <div
      className="admin-canvas flex flex-col overflow-hidden"
      style={{ height: '100vh', backgroundColor: 'var(--admin-bg)' }}
    >
      {/* Header */}
      <header
        className="shrink-0 px-6 py-4 border-b"
        style={{ ...cardBg, borderColor: 'var(--admin-border)' }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--admin-text)' }}>
            Store Analytics Monitor
          </h1>
          <span className="inline-flex items-center gap-2 text-sm text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
            LIVE • updating every 10s
          </span>
        </div>
      </header>

      {/* Salesforce-style tab bar */}
      <div
        className="shrink-0 border-b flex overflow-x-auto"
        style={{ borderColor: 'var(--admin-border)', backgroundColor: 'var(--admin-bg)' }}
      >
        <div className="flex min-w-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-500'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Large content panel — fills remaining space, no scroll */}
      <div className="flex-1 min-h-0 p-4 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-[360px] rounded-xl border overflow-hidden flex flex-col" style={cardBg}>
          {activeTab === 'sales' && (
            <DailySalesPanel data={salesChartData} mode={salesChartMode} />
          )}
          {activeTab === 'transactions' && (
            <LiveTransactionsPanel transactions={liveTransactions} />
          )}
          {activeTab === 'products' && (
            <MostSoldItemsPanel
              data={bestSelling}
              dateRangeStart={dateRangeStart}
              dateRangeEnd={dateRangeEnd}
            />
          )}
          {activeTab === 'inventory' && (
            <InventoryHealthPanel summary={inventorySummary} />
          )}
        </div>
      </div>
    </div>
  );
}
