import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { inventory, products } from '../api/client';
import type { InventoryListItem, InventoryMovementRow } from '../api/client';

const CURRENCY = '₱';

const BoxIcon = () => (
  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);
const ChartBarIcon = () => (
  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const TrendDownIcon = () => (
  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
  </svg>
);
const TrendUpIcon = () => (
  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);
const PencilIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);
const ClipboardListIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

type Summary = { totalProducts: number; totalValue: number; lowStockCount: number; outOfStockCount: number; overstockedCount: number } | null;

export default function InventoryPage() {
  const [list, setList] = useState<InventoryListItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [category, setCategory] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'adjust' | 'bulkAdjust' | null>(null);
  const [adjusting, setAdjusting] = useState<InventoryListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [adjustForm, setAdjustForm] = useState({
    quantityAdjust: '',
    movementNotes: '',
    lowStockThreshold: '10',
    reorderLevel: '10',
    reorderQuantity: '100',
  });
  const [bulkAdjustItems, setBulkAdjustItems] = useState<Array<{ productId: number; name: string; quantityDelta: string; notes: string }>>([]);
  const [movements, setMovements] = useState<InventoryMovementRow[]>([]);
  const [movementsPagination, setMovementsPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [err, setErr] = useState('');
  const [imagePreview, setImagePreview] = useState<{ imageUrl: string; name: string } | null>(null);

  const loadSummary = () => {
    inventory.summary().then(setSummary).catch(() => setSummary(null));
  };

  const load = () => {
    setLoading(true);
    const status = statusFilter === 'all' ? undefined : statusFilter;
    Promise.all([
      inventory.list({
        page: pagination.page,
        limit: pagination.limit,
        search: search.trim() || undefined,
        category: category || undefined,
        status,
      }),
      products.categories(),
    ])
      .then(([r, cat]) => {
        setList(r.data);
        setPagination(r.pagination);
        setCategories(cat.data || []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  const loadMovements = () => {
    setMovementsLoading(true);
    inventory.movements({ page: movementsPagination.page, limit: movementsPagination.limit })
      .then((r) => {
        setMovements(r.data);
        setMovementsPagination(r.pagination);
      })
      .catch(() => setMovements([]))
      .finally(() => setMovementsLoading(false));
  };

  useEffect(() => { loadSummary(); }, []);
  useEffect(() => { load(); }, [pagination.page, pagination.limit, search, category, statusFilter]);
  useEffect(() => { loadMovements(); }, [movementsPagination.page]);

  const refresh = () => {
    loadSummary();
    load();
    loadMovements();
  };

  const openAdjust = (row: InventoryListItem) => {
    setAdjusting(row);
    setAdjustForm({
      quantityAdjust: '',
      movementNotes: '',
      lowStockThreshold: String(row.lowStockThreshold ?? 10),
      reorderLevel: String(row.reorderLevel ?? row.lowStockThreshold ?? 10),
      reorderQuantity: String(row.reorderQuantity ?? 100),
    });
    setModal('adjust');
  };

  const saveAdjust = async () => {
    if (!adjusting) return;
    const qtyAdjust = adjustForm.quantityAdjust !== '' ? Number(adjustForm.quantityAdjust) : 0;
    const newQty = qtyAdjust !== 0 ? Math.max(0, adjusting.quantity + qtyAdjust) : undefined;
    try {
      await inventory.update(adjusting.productId, {
        ...(newQty !== undefined && { quantity: newQty }),
        lowStockThreshold: Number(adjustForm.lowStockThreshold),
        reorderLevel: Number(adjustForm.reorderLevel),
        reorderQuantity: Number(adjustForm.reorderQuantity),
        ...(adjustForm.movementNotes && { movementNotes: adjustForm.movementNotes }),
      });
      setModal(null);
      setAdjusting(null);
      refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  };

  const toggleSelect = (productId: number) => {
    setSelectedIds((s) => {
      const n = new Set(s);
      if (n.has(productId)) n.delete(productId);
      else n.add(productId);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === list.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(list.map((r) => r.productId)));
  };

  const openBulkAdjust = () => {
    if (selectedIds.size === 0) return;
    setBulkAdjustItems(list.filter((r) => selectedIds.has(r.productId)).map((r) => ({
      productId: r.productId,
      name: r.product?.name ?? '',
      quantityDelta: '0',
      notes: 'Bulk adjust',
    })));
    setModal('bulkAdjust');
  };

  const saveBulkAdjust = async () => {
    const items = bulkAdjustItems
      .filter((i) => i.quantityDelta !== '' && Number(i.quantityDelta) !== 0)
      .map((i) => ({ productId: i.productId, quantityDelta: Number(i.quantityDelta), notes: i.notes || undefined }));
    if (items.length === 0) return;
    try {
      await inventory.bulkAdjust(items);
      setModal(null);
      setSelectedIds(new Set());
      refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  };

  const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };

  const statusLabel = (status?: string) => {
    if (status === 'OUT_OF_STOCK') return { label: 'Out of Stock', className: 'bg-red-500/20 text-red-400' };
    if (status === 'LOW_STOCK') return { label: 'Low Stock', className: 'bg-amber-500/20 text-amber-400' };
    return { label: 'In Stock', className: 'bg-emerald-500/20 text-emerald-400' };
  };

  const movementTypeLabel = (type: string) => {
    if (type === 'STOCK_IN') return 'Stock In';
    if (type === 'STOCK_OUT') return 'Stock Out';
    return 'Adjustment';
  };

  return (
    <div className="space-y-6">
      {/* KPIs: Total Products, Total Value, Low Stock, Out of Stock, Overstocked */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border p-5 card-3d relative overflow-hidden" style={cardBg}>
          <div className="absolute top-4 right-4 opacity-80"><BoxIcon /></div>
          <p className="text-sm font-medium text-slate-400">Total Products</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--admin-text)' }}>{summary?.totalProducts ?? '—'}</p>
        </div>
        <div className="rounded-xl border p-5 card-3d relative overflow-hidden" style={cardBg}>
          <div className="absolute top-4 right-4 opacity-80"><ChartBarIcon /></div>
          <p className="text-sm font-medium text-slate-400">Total Inventory Value</p>
          <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--admin-text)' }}>
            {summary != null ? `${CURRENCY}${summary.totalValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
          </p>
        </div>
        <div className="rounded-xl border p-5 card-3d relative overflow-hidden" style={cardBg}>
          <div className="absolute top-4 right-4 opacity-80"><TrendDownIcon /></div>
          <p className="text-sm font-medium text-slate-400">Low Stock Items</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--admin-text)' }}>{summary?.lowStockCount ?? '—'}</p>
        </div>
        <div className="rounded-xl border p-5 card-3d relative overflow-hidden" style={cardBg}>
          <div className="absolute top-4 right-4 opacity-80"><TrendDownIcon /></div>
          <p className="text-sm font-medium text-slate-400">Out of Stock</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--admin-text)' }}>{summary?.outOfStockCount ?? '—'}</p>
        </div>
        <div className="rounded-xl border p-5 card-3d relative overflow-hidden" style={cardBg}>
          <div className="absolute top-4 right-4 opacity-80"><TrendUpIcon /></div>
          <p className="text-sm font-medium text-slate-400">Overstocked Items</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--admin-text)' }}>{summary?.overstockedCount ?? '—'}</p>
        </div>
      </div>

      {/* Filters: search, status, category, price range, quantity range, Add Product */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-0 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border text-sm placeholder-slate-500 focus:ring-2 focus:ring-[#2563EB]/40"
            style={{ ...cardBg, color: 'var(--admin-text)' }}
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'in' | 'low' | 'out')}
            className="min-w-[120px] h-10 px-4 rounded-xl border text-sm focus:ring-2 focus:ring-[#2563EB]/40"
            style={{ ...cardBg, color: 'var(--admin-text)' }}
          >
            <option value="all">All Status</option>
            <option value="in">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setCategoryOpen((o) => !o)}
            className="flex items-center justify-between gap-2 min-w-[180px] h-10 px-4 rounded-xl border text-sm text-left focus:ring-2 focus:ring-[#2563EB]/40"
            style={{ ...cardBg, color: 'var(--admin-text)' }}
          >
            <span>{category === '' ? 'All Categories' : category}</span>
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {categoryOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setCategoryOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 w-full min-w-[200px] py-1 rounded-xl border shadow-lg" style={cardBg}>
                <button type="button" onClick={() => { setCategory(''); setCategoryOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium rounded-lg ${category === '' ? 'bg-[#2563EB] text-white' : ''}`} style={category === '' ? {} : { color: 'var(--admin-text)' }}>All Categories</button>
                {categories.filter((c) => c !== 'All Categories').map((cat) => (
                  <button key={cat} type="button" onClick={() => { setCategory(cat); setCategoryOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium rounded-lg ${category === cat ? 'bg-[#2563EB] text-white' : ''}`} style={category === cat ? {} : { color: 'var(--admin-text)' }}>{cat}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3 card-3d" style={cardBg}>
          <span className="text-sm text-slate-400">{selectedIds.size} selected</span>
          <button type="button" onClick={openBulkAdjust} className="px-3 py-1.5 rounded-lg text-sm font-medium border hover:bg-white/10" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>Bulk adjust stock</button>
          <button type="button" onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white">Clear selection</button>
        </div>
      )}

      {/* Inventory table */}
      <div className="rounded-xl border overflow-hidden card-3d" style={cardBg}>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="border-b" style={{ borderColor: 'var(--admin-border)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider w-10">
                  <input type="checkbox" checked={list.length > 0 && selectedIds.size === list.length} onChange={toggleSelectAll} className="rounded border-slate-500" />
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Product Name</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">SKU</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Quantity</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Price</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--admin-border)' }}>
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500 text-sm">Loading...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500 text-sm">No products found.</td></tr>
              ) : (
                list.map((row) => {
                  const status = row.status ?? (row.quantity === 0 ? 'OUT_OF_STOCK' : row.quantity <= (row.reorderLevel ?? row.lowStockThreshold ?? 10) ? 'LOW_STOCK' : 'IN_STOCK');
                  const { label, className } = statusLabel(status);
                  const isOverstocked = row.isOverstocked ?? false;
                  return (
                    <tr key={row.productId} className="hover:bg-white/5 transition-colors" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <td className="px-5 py-4">
                        <input type="checkbox" checked={selectedIds.has(row.productId)} onChange={() => toggleSelect(row.productId)} className="rounded border-slate-500" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImagePreview({
                                imageUrl: row.product?.imageUrl ?? '',
                                name: row.product?.name ?? '—',
                              });
                            }}
                            className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border transition-opacity cursor-pointer hover:opacity-90"
                            style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'var(--admin-border)' }}
                            title="Click to view"
                          >
                            {row.product?.imageUrl ? (
                              <img src={row.product.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-slate-500 text-sm font-semibold">{(row.product?.name ?? '?').charAt(0).toUpperCase()}</span>
                            )}
                          </button>
                          <span className="font-medium" style={{ color: 'var(--admin-text)' }}>{row.product?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-300">{row.product?.sku ?? '—'}</td>
                      <td className="px-5 py-4 text-sm text-slate-300">{row.product?.category ?? '—'}</td>
                      <td className="px-5 py-4 text-sm text-slate-300 tabular-nums">{row.quantity}</td>
                      <td className="px-5 py-4 text-sm font-medium tabular-nums" style={{ color: 'var(--admin-text)' }}>{row.product ? `${CURRENCY}${row.product.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}>
                          {isOverstocked ? 'Overstocked' : label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={() => openAdjust(row)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10" title="Adjust stock"><PencilIcon /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Movement / Ledger */}
      <div className="rounded-xl border overflow-hidden card-3d" style={cardBg}>
        <h3 className="px-5 py-4 border-b flex items-center gap-2 font-semibold" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>
          <ClipboardListIcon /> Inventory Movement / Ledger
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="border-b" style={{ borderColor: 'var(--admin-border)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Quantity</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--admin-border)' }}>
              {movementsLoading ? (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-500 text-sm">Loading...</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-500 text-sm">No movements yet.</td></tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <td className="px-5 py-3 text-sm text-slate-300">{new Date(m.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-3 font-medium text-sm" style={{ color: 'var(--admin-text)' }}>{m.product?.name ?? m.productId}</td>
                    <td className="px-5 py-3 text-sm text-slate-300">{movementTypeLabel(m.type)}</td>
                    <td className="px-5 py-3 text-sm tabular-nums">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                    <td className="px-5 py-3 text-sm text-slate-300">{m.user?.fullName ?? m.user?.email ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-400 max-w-xs truncate">{m.notes ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {movementsPagination.pages > 1 && (
          <div className="flex justify-center gap-2 py-3 border-t" style={{ borderColor: 'var(--admin-border)' }}>
            <button type="button" disabled={movementsPagination.page <= 1} onClick={() => setMovementsPagination((p) => ({ ...p, page: p.page - 1 }))} className="px-3 py-1 rounded-lg border text-sm disabled:opacity-50" style={cardBg}>Prev</button>
            <span className="py-1 text-sm text-slate-400">Page {movementsPagination.page} of {movementsPagination.pages}</span>
            <button type="button" disabled={movementsPagination.page >= movementsPagination.pages} onClick={() => setMovementsPagination((p) => ({ ...p, page: p.page + 1 }))} className="px-3 py-1 rounded-lg border text-sm disabled:opacity-50" style={cardBg}>Next</button>
          </div>
        )}
      </div>

      {/* Image preview overlay - portaled so it always appears on top */}
      {imagePreview && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setImagePreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Product image preview"
        >
          <div
            className="rounded-xl border overflow-hidden shadow-xl flex flex-col items-center card-3d"
            style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)', maxWidth: 'min(92vw, 720px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {imagePreview.imageUrl ? (
              <img
                src={imagePreview.imageUrl}
                alt={imagePreview.name}
                className="w-full aspect-square object-contain bg-black/20"
              />
            ) : (
              <div
                className="w-full aspect-square flex items-center justify-center text-6xl font-semibold min-h-[200px]"
                style={{ backgroundColor: 'var(--admin-primary)', color: '#fff' }}
              >
                {imagePreview.name.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <div className="w-full px-3 py-3 border-t flex flex-col items-center gap-2" style={{ borderColor: 'var(--admin-border)' }}>
              <p className="text-sm font-medium text-center w-full truncate" style={{ color: 'var(--admin-text)' }}>{imagePreview.name}</p>
              <button
                type="button"
                onClick={() => setImagePreview(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Adjust stock modal */}
      {modal === 'adjust' && adjusting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl p-6 max-w-md w-full card-3d shadow-xl" style={cardBg}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--admin-text)' }}>Adjust stock — {adjusting.product?.name}</h2>
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Current quantity: <span className="font-medium text-white">{adjusting.quantity}</span></p>
              <input type="number" placeholder="Stock adjustment (+/-)" value={adjustForm.quantityAdjust} onChange={(e) => setAdjustForm((f) => ({ ...f, quantityAdjust: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} title="Add or subtract from current quantity" />
              <input type="text" placeholder="Movement notes (optional)" value={adjustForm.movementNotes} onChange={(e) => setAdjustForm((f) => ({ ...f, movementNotes: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <input type="number" placeholder="Low stock threshold" value={adjustForm.lowStockThreshold} onChange={(e) => setAdjustForm((f) => ({ ...f, lowStockThreshold: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <input type="number" placeholder="Reorder level" value={adjustForm.reorderLevel} onChange={(e) => setAdjustForm((f) => ({ ...f, reorderLevel: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
              <input type="number" placeholder="Reorder quantity" value={adjustForm.reorderQuantity} onChange={(e) => setAdjustForm((f) => ({ ...f, reorderQuantity: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border bg-slate-800/50 text-white placeholder-slate-500" style={{ borderColor: 'var(--admin-border)' }} />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={saveAdjust} className="px-4 py-2.5 bg-[#2563EB] text-white rounded-xl hover:bg-[#1D4ED8] btn-3d">Save</button>
              <button type="button" onClick={() => { setModal(null); setAdjusting(null); }} className="px-4 py-2.5 border rounded-xl hover:bg-white/10" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk adjust modal */}
      {modal === 'bulkAdjust' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl p-6 max-w-lg w-full card-3d shadow-xl max-h-[90vh] overflow-y-auto" style={cardBg}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--admin-text)' }}>Bulk adjust stock</h2>
            <p className="text-sm text-slate-400 mb-3">Quantity delta: positive to add, negative to subtract.</p>
            <div className="space-y-2 mb-4">
              {bulkAdjustItems.map((item, idx) => (
                <div key={item.productId} className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium w-32 truncate" style={{ color: 'var(--admin-text)' }}>{item.name}</span>
                  <input type="number" placeholder="Delta" value={item.quantityDelta} onChange={(e) => setBulkAdjustItems((prev) => { const n = [...prev]; n[idx] = { ...n[idx], quantityDelta: e.target.value }; return n; })} className="w-20 px-2 py-1.5 rounded-lg border text-sm" style={{ ...cardBg, color: 'var(--admin-text)' }} />
                  <input type="text" placeholder="Notes" value={item.notes} onChange={(e) => setBulkAdjustItems((prev) => { const n = [...prev]; n[idx] = { ...n[idx], notes: e.target.value }; return n; })} className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border text-sm" style={{ ...cardBg, color: 'var(--admin-text)' }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={saveBulkAdjust} className="px-4 py-2.5 bg-[#2563EB] text-white rounded-xl hover:bg-[#1D4ED8] btn-3d">Apply</button>
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2.5 border rounded-xl hover:bg-white/10" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {err && <div className="rounded-xl border p-3 text-red-400 text-sm" style={{ borderColor: 'var(--admin-border)' }}>{err}</div>}
    </div>
  );
}
