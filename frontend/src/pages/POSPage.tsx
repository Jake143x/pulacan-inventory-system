import { useEffect, useState } from 'react';
import { products, pos } from '../api/client';
import type { Product } from '../api/client';
import ProductImagePlaceholder from '../components/ProductImagePlaceholder';

const CURRENCY = '₱';
const TAX_RATE = 0.12;

type ProductWithStock = Product & { inventory?: { quantity: number } };
type CartItem = { product: ProductWithStock; quantity: number; unitName?: string; unitPrice?: number };

function CustomQtyAdd({ product, stock, minQ, step, unitLabel, promptLabel, onAdd, unitName, unitPrice }: {
  product: ProductWithStock;
  stock: number;
  minQ: number;
  step: number;
  unitLabel: string;
  promptLabel: string;
  onAdd: (p: ProductWithStock, qty: number, unitName?: string, unitPrice?: number) => void;
  unitName?: string;
  unitPrice?: number;
}) {
  const [qty, setQty] = useState(minQ > 0 ? minQ : step);
  const price = unitPrice ?? product.unitPrice;
  const handleAdd = () => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return;
    onAdd(product, n, unitName, unitPrice);
  };
  return (
    <div className="mt-auto space-y-1">
      <p className="text-xs text-slate-500">{promptLabel}</p>
      <div className="flex gap-1 items-center">
        <input
          type="number"
          min={minQ}
          step={step}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-14 py-1.5 px-2 rounded-lg border text-sm text-center tabular-nums"
          style={{ ...{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }, color: 'var(--admin-text)' }}
        />
        <span className="text-xs text-slate-500 shrink-0">{unitLabel}</span>
        <button type="button" onClick={handleAdd} disabled={stock === 0} className="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          Add
        </button>
      </div>
      <p className="text-xs text-slate-500">Total = qty × ₱{price} = ₱{(Number(qty) * price).toFixed(2)}</p>
    </div>
  );
}

export default function POSPage() {
  const [productList, setProductList] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedUnitByProductId, setSelectedUnitByProductId] = useState<Record<number, { unitName: string; price: number; stock: number }>>({});
  useEffect(() => {
    products.categories().then((r) => setCategories(r.data || [])).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    products
      .list({ limit: 50, search: search.trim() || undefined, category: category || undefined })
      .then((r) => setProductList(r.data as ProductWithStock[]))
      .catch(() => setProductList([]))
      .finally(() => setLoading(false));
  }, [search, category]);

  const addToCart = (p: ProductWithStock, qty: number = 1, unitName?: string, unitPrice?: number) => {
    const hasUnits = p.productUnits && p.productUnits.length > 0;
    const max = hasUnits && unitName
      ? (p.productUnits!.find((u) => u.unitName.toLowerCase() === unitName.toLowerCase())?.stock ?? 0)
      : (p.inventory?.quantity ?? 0);
    const price = unitPrice ?? p.unitPrice;
    const uType = hasUnits && unitName ? unitName : (p.unitType || 'piece');
    const minQ = /^(kg|meter|liter|kilo|metre|litre)$/i.test(uType) ? 0 : 1;
    const step = /^(kg|meter|liter|kilo|metre|litre)$/i.test(uType) ? 0.01 : 1;
    if (uType !== 'piece' && !hasUnits) {
      const remainder = Math.abs((qty / step) - Math.round(qty / step));
      if (remainder > 0.001) {
        setErr(`Use steps of ${step} ${uType}`);
        return;
      }
    }
    if (p.minOrderQuantity != null && qty < p.minOrderQuantity) {
      setErr(`Minimum ${p.minOrderQuantity} ${uType}`);
      return;
    }
    if (max < qty) {
      setErr(`Only ${max} in stock${unitName ? ` (${unitName})` : ''}`);
      return;
    }
    setErr('');
    setSuccess('');
    setCart((c) => {
      const existing = c.find((x) => x.product.id === p.id && (x.unitName ?? '') === (unitName ?? ''));
      const newQty = existing ? existing.quantity + qty : qty;
      if (newQty > max) {
        setErr(`Max ${max} in stock`);
        return c;
      }
      if (existing) return c.map((x) => (x.product.id === p.id && (x.unitName ?? '') === (unitName ?? '') ? { ...x, quantity: newQty } : x));
      return [...c, { product: p, quantity: qty, unitName, unitPrice }];
    });
  };

  const updateQty = (productId: number, delta: number, unitName?: string) => {
    setCart((c) => {
      const item = c.find((x) => x.product.id === productId && (x.unitName ?? '') === (unitName ?? ''));
      if (!item) return c;
      const hasUnits = item.unitName != null;
      const uType = item.unitName ?? item.product.unitType ?? 'piece';
      const step = /^(kg|meter|liter|kilo|metre|litre)$/i.test(uType) ? 0.01 : 1;
      const add = delta > 0 ? step : -step;
      const newQty = item.quantity + add;
      if (newQty <= 0) return c.filter((x) => !(x.product.id === productId && (x.unitName ?? '') === (unitName ?? '')));
      const max = hasUnits && item.product.productUnits?.length
        ? (item.product.productUnits!.find((u) => u.unitName.toLowerCase() === (unitName ?? '').toLowerCase())?.stock ?? 0)
        : (item.product.inventory?.quantity ?? 0);
      return c.map((x) => (x.product.id === productId && (x.unitName ?? '') === (unitName ?? '') ? { ...x, quantity: Math.min(Math.max(0, newQty), max) } : x));
    });
  };

  const subtotal = cart.reduce((s, i) => s + (i.unitPrice ?? i.product.unitPrice) * i.quantity, 0);
  const tax = subtotal * TAX_RATE;
  const grandTotal = subtotal + tax;

  const completeSale = async () => {
    if (cart.length === 0) {
      setErr('Cart is empty');
      return;
    }
    setProcessing(true);
    setErr('');
    setSuccess('');
    try {
      await pos.createTransaction(cart.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        ...(i.unitName != null && i.unitName !== '' && { unitName: i.unitName }),
      })));
      setSuccess('Transaction saved.');
      setCart([]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setProcessing(false);
    }
  };

  const cancelSale = () => {
    if (cart.length === 0) return;
    setCart([]);
    setSuccess('Sale cancelled. Cart cleared.');
  };

  const cardBg = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-1 min-h-0 gap-4">
        {/* Left: Product grid */}
        <div className="flex-1 flex flex-col min-w-0 overflow-auto">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-0 max-w-md">
              <input
                type="text"
                placeholder="Q Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-xl border text-sm placeholder-slate-500 focus:ring-2 focus:ring-[#2563EB]/40"
                style={{ ...cardBg, color: 'var(--admin-text)' }}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
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
                    {categories.map((cat) => (
                      <button key={cat} type="button" onClick={() => { setCategory(cat); setCategoryOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium rounded-lg ${category === cat ? 'bg-[#2563EB] text-white' : ''}`} style={category === cat ? {} : { color: 'var(--admin-text)' }}>{cat}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          {err && <p className="text-amber-400 text-sm mb-1">{err}</p>}
          {success && <p className="text-emerald-400 text-sm mb-1">{success}</p>}
          {loading ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : productList.length === 0 ? (
            <p className="text-slate-500 text-sm">No products found.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3">
              {productList.map((p) => {
                const hasUnits = p.productUnits && p.productUnits.length > 0;
                const selectedUnit = hasUnits ? (selectedUnitByProductId[p.id] ?? { unitName: p.productUnits![0].unitName, price: p.productUnits![0].price, stock: p.productUnits![0].stock }) : null;
                const stock = hasUnits && selectedUnit ? selectedUnit.stock : (p.inventory?.quantity ?? 0);
                const uType = hasUnits && selectedUnit ? selectedUnit.unitName : (p.unitType || 'piece');
                const unit = uType === 'piece' ? 'piece' : (p.saleUnit || uType);
                const minQ = /^(kg|meter|liter|kilo|metre|litre)$/i.test(uType) ? 0.01 : 1;
                const step = /^(kg|meter|liter|kilo|metre|litre)$/i.test(uType) ? 0.01 : 1;
                const price = hasUnits && selectedUnit ? selectedUnit.price : p.unitPrice;
                const priceLabel = hasUnits && selectedUnit
                  ? `${CURRENCY}${selectedUnit.price.toFixed(2)}/${selectedUnit.unitName}`
                  : uType === 'piece'
                    ? `${CURRENCY}${p.unitPrice.toFixed(2)}`
                    : `${CURRENCY}${p.unitPrice.toFixed(2)} per ${uType}`;
                const stockLabel = `Stock: ${typeof stock === 'number' && stock % 1 !== 0 ? stock.toFixed(2) : stock} ${hasUnits && selectedUnit ? selectedUnit.unitName : unit}`;
                return (
                  <div key={p.id} className="rounded-2xl border overflow-hidden flex flex-col card-3d" style={cardBg}>
                    <div className="aspect-square flex items-center justify-center shrink-0 p-2" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                      {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" /> : <ProductImagePlaceholder className="w-full h-full max-w-[80px] max-h-[80px]" />}
                    </div>
                    <div className="p-3 flex flex-col flex-1 min-w-0">
                      {p.category && <span className="text-xs text-slate-500 truncate block mb-0.5">{p.category}</span>}
                      <h3 className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.25rem]" style={{ color: 'var(--admin-text)' }}>{p.name}</h3>
                      {hasUnits && (
                        <select
                          value={selectedUnit?.unitName ?? ''}
                          onChange={(e) => {
                            const u = p.productUnits!.find((x) => x.unitName === e.target.value);
                            if (u) setSelectedUnitByProductId((prev) => ({ ...prev, [p.id]: { unitName: u.unitName, price: u.price, stock: u.stock } }));
                          }}
                          className="mt-1 w-full px-2 py-1 rounded border text-xs"
                          style={{ ...cardBg, color: 'var(--admin-text)', borderColor: 'var(--admin-border)' }}
                        >
                          {p.productUnits!.map((u) => (
                            <option key={u.id} value={u.unitName}>{u.unitName} — ₱{u.price.toFixed(2)} ({u.stock})</option>
                          ))}
                        </select>
                      )}
                      <p className="text-sm font-semibold mt-1 tabular-nums" style={{ color: 'var(--admin-text)' }}>{priceLabel}</p>
                      <p className="text-xs text-slate-500 mb-2">{stockLabel}</p>
                      {hasUnits ? (
                        /^(kg|meter|liter|kilo|metre|litre)$/i.test(selectedUnit?.unitName ?? '') ? (
                          <CustomQtyAdd
                            product={p}
                            stock={stock}
                            minQ={minQ}
                            step={step}
                            unitLabel={selectedUnit?.unitName === 'kg' ? 'kg' : selectedUnit?.unitName === 'meter' ? 'm' : selectedUnit?.unitName ?? ''}
                            promptLabel={`Qty (${selectedUnit?.unitName}):`}
                            onAdd={addToCart}
                            unitName={selectedUnit?.unitName}
                            unitPrice={selectedUnit?.price}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToCart(p, 1, selectedUnit?.unitName, selectedUnit?.price)}
                            disabled={stock === 0}
                            className="mt-auto w-full py-2 rounded-xl text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Add
                          </button>
                        )
                      ) : uType === 'kg' ? (
                        <CustomQtyAdd product={p} stock={stock} minQ={p.minOrderQuantity ?? 0} step={p.quantityStep ?? 0.01} unitLabel="kg" promptLabel="Enter quantity (kg):" onAdd={addToCart} />
                      ) : uType === 'meter' ? (
                        <CustomQtyAdd product={p} stock={stock} minQ={p.minOrderQuantity ?? 0} step={p.quantityStep ?? 0.01} unitLabel="m" promptLabel="Enter length (meter):" onAdd={addToCart} />
                      ) : (
                        <button type="button" onClick={() => addToCart(p)} disabled={stock === 0} className="mt-auto w-full py-2 rounded-xl text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Current sale — list, Total Sales, Tax, Grand Total, Complete sale + Cancel */}
        <aside className="w-full sm:w-[360px] flex-shrink-0 rounded-2xl border flex flex-col card-3d overflow-visible" style={cardBg}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--admin-border)' }}>
            <h2 className="font-semibold text-base" style={{ color: 'var(--admin-text)' }}>Current sale chart</h2>
          </div>
          <div className="flex-1 overflow-auto min-h-0 rounded-b-2xl">
            <div className="px-4 py-3">
              {cart.length === 0 ? (
                <p className="text-slate-500 text-sm py-8 text-center">Empty. Add items from the list.</p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {cart.map((i) => {
                      const key = `${i.product.id}:${i.unitName ?? ''}`;
                      const unitPrice = i.unitPrice ?? i.product.unitPrice;
                      const unitLabel = i.unitName ?? i.product.unitType ?? 'piece';
                      return (
                        <li key={key} className="flex items-center gap-3 py-2.5 border-b" style={{ borderColor: 'var(--admin-border)' }}>
                          <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                            {i.product.imageUrl ? <img src={i.product.imageUrl} alt="" className="w-full h-full object-contain" /> : <ProductImagePlaceholder className="w-8 h-8" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate" style={{ color: 'var(--admin-text)' }}>{i.product.name}</p>
                            <p className="text-xs text-slate-500 tabular-nums">
                              {i.quantity % 1 === 0 ? i.quantity : i.quantity.toFixed(2)} {unitLabel} × {CURRENCY}{unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })} = {CURRENCY}{(unitPrice * i.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => updateQty(i.product.id, -1, i.unitName)} className="w-8 h-8 rounded-lg border flex items-center justify-center text-sm hover:bg-white/10" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>−</button>
                            <span className="w-7 text-center text-sm font-medium tabular-nums" style={{ color: 'var(--admin-text)' }}>{i.quantity % 1 === 0 ? i.quantity : i.quantity.toFixed(2)}</span>
                            <button type="button" onClick={() => updateQty(i.product.id, 1, i.unitName)} className="w-8 h-8 rounded-lg border flex items-center justify-center text-sm hover:bg-white/10" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>+</button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="pt-4 mt-3 border-t-2 space-y-2" style={{ borderColor: 'var(--admin-border)' }}>
                    <div className="flex justify-between text-sm" style={{ color: 'var(--admin-text)' }}>
                      <span>Total Sales</span>
                      <span className="tabular-nums">{CURRENCY}{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm" style={{ color: 'var(--admin-text)' }}>
                      <span>Tax (12%)</span>
                      <span className="tabular-nums">{CURRENCY}{tax.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2" style={{ color: 'var(--admin-text)' }}>
                      <span>Grand Total</span>
                      <span className="tabular-nums">{CURRENCY}{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button type="button" onClick={completeSale} disabled={processing || cart.length === 0} className="flex-1 py-3 rounded-xl font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 transition-all btn-3d">
                      {processing ? 'Processing...' : 'Complete sale'}
                    </button>
                    <button type="button" onClick={cancelSale} disabled={cart.length === 0} className="flex-1 py-3 rounded-xl font-semibold border hover:bg-white/10 disabled:opacity-50 transition-colors" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
