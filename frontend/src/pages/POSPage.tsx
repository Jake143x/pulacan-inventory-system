import { useEffect, useState } from 'react';
import { products, pos } from '../api/client';
import type { Product } from '../api/client';
import ProductImagePlaceholder from '../components/ProductImagePlaceholder';

const CURRENCY = '₱';
const TAX_RATE = 0.12;

type ProductWithStock = Product & { inventory?: { quantity: number } };

export default function POSPage() {
  const [productList, setProductList] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Array<{ product: ProductWithStock; quantity: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
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

  const addToCart = (p: ProductWithStock, qty: number = 1) => {
    const max = p.inventory?.quantity ?? 0;
    if (max < qty) {
      setErr(`Only ${max} in stock`);
      return;
    }
    setErr('');
    setSuccess('');
    setCart((c) => {
      const existing = c.find((x) => x.product.id === p.id);
      const newQty = existing ? existing.quantity + qty : qty;
      if (newQty > max) {
        setErr(`Max ${max} in stock`);
        return c;
      }
      if (existing) return c.map((x) => (x.product.id === p.id ? { ...x, quantity: newQty } : x));
      return [...c, { product: p, quantity: qty }];
    });
  };

  const updateQty = (productId: number, delta: number) => {
    setCart((c) => {
      const item = c.find((x) => x.product.id === productId);
      if (!item) return c;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return c.filter((x) => x.product.id !== productId);
      const max = item.product.inventory?.quantity ?? 0;
      return c.map((x) => (x.product.id === productId ? { ...x, quantity: Math.min(newQty, max) } : x));
    });
  };

  const subtotal = cart.reduce((s, i) => s + i.product.unitPrice * i.quantity, 0);
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
      await pos.createTransaction(cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })));
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
                const stock = p.inventory?.quantity ?? 0;
                return (
                  <div key={p.id} className="rounded-2xl border overflow-hidden flex flex-col card-3d" style={cardBg}>
                    <div className="aspect-square flex items-center justify-center shrink-0 p-2" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                      {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" /> : <ProductImagePlaceholder className="w-full h-full max-w-[80px] max-h-[80px]" />}
                    </div>
                    <div className="p-3 flex flex-col flex-1 min-w-0">
                      {p.category && <span className="text-xs text-slate-500 truncate block mb-0.5">{p.category}</span>}
                      <h3 className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.25rem]" style={{ color: 'var(--admin-text)' }}>{p.name}</h3>
                      <p className="text-sm font-semibold mt-1 tabular-nums" style={{ color: 'var(--admin-text)' }}>{CURRENCY}{p.unitPrice.toFixed(2)}</p>
                      <p className="text-xs text-slate-500 mb-2">Stock: {stock}</p>
                      <button type="button" onClick={() => addToCart(p)} disabled={stock === 0} className="mt-auto w-full py-2 rounded-xl text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        Add
                      </button>
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
                    {cart.map((i) => (
                      <li key={i.product.id} className="flex items-center gap-3 py-2.5 border-b" style={{ borderColor: 'var(--admin-border)' }}>
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                          {i.product.imageUrl ? <img src={i.product.imageUrl} alt="" className="w-full h-full object-contain" /> : <ProductImagePlaceholder className="w-8 h-8" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" style={{ color: 'var(--admin-text)' }}>{i.product.name}</p>
                          <p className="text-xs text-slate-500 tabular-nums">{CURRENCY}{(i.product.unitPrice * i.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => updateQty(i.product.id, -1)} className="w-8 h-8 rounded-lg border flex items-center justify-center text-sm hover:bg-white/10" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>−</button>
                          <span className="w-7 text-center text-sm font-medium tabular-nums" style={{ color: 'var(--admin-text)' }}>{i.quantity}</span>
                          <button type="button" onClick={() => updateQty(i.product.id, 1)} className="w-8 h-8 rounded-lg border flex items-center justify-center text-sm hover:bg-white/10" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>+</button>
                        </div>
                      </li>
                    ))}
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
