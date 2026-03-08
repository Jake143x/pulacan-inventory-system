import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { products } from '../api/client';
import type { Product } from '../api/client';
import { resolveImageUrl, getProductUnitType } from '../api/client';
import ProductImagePlaceholder from '../components/ProductImagePlaceholder';
import { useCart } from '../context/CartContext';

const CURRENCY = '₱';

/** Inline quantity input + Add for kg or meter products. */
function CustomQtyAdd({ product, onAdd, unitLabel, promptLabel }: { product: Product; onAdd: (productId: number, qty: number) => void; unitLabel: string; promptLabel: string }) {
  const stock = product.inventory?.quantity ?? 0;
  const minQ = product.minOrderQuantity ?? 0;
  const step = product.quantityStep ?? 0.01;
  const [qty, setQty] = useState(minQ > 0 ? minQ : step);
  const handleAdd = () => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0 || n > stock) return;
    onAdd(product.id, n);
  };
  return (
    <div className="mt-4 space-y-1.5">
      <p className="text-xs font-medium text-[var(--customer-text-muted)]">{promptLabel}</p>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          min={minQ}
          step={step}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-20 py-2 px-2 rounded-xl border border-[var(--customer-border)] bg-[var(--customer-bg)] text-[var(--customer-text)] text-sm text-center tabular-nums focus:ring-2 focus:ring-[var(--customer-primary)]/20"
        />
        <span className="text-xs text-[var(--customer-text-muted)] shrink-0">{unitLabel}</span>
        <button
          type="button"
          onClick={handleAdd}
          disabled={stock === 0}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          Add to Cart
        </button>
      </div>
      <p className="text-xs text-[var(--customer-text-muted)]">Total = {qty} × ₱{product.unitPrice} = ₱{(Number(qty) * product.unitPrice).toFixed(2)}</p>
    </div>
  );
}

type SortOption = 'default' | 'price_asc' | 'price_desc' | 'name_asc';
function displayPrice(p: Product): number {
  if (p.productUnits && p.productUnits.length > 0) return Math.min(...p.productUnits.map((u) => u.price));
  return p.unitPrice;
}
function sortProducts(list: Product[], sort: SortOption): Product[] {
  if (sort === 'default') return list;
  const copy = [...list];
  if (sort === 'price_asc') return copy.sort((a, b) => displayPrice(a) - displayPrice(b));
  if (sort === 'price_desc') return copy.sort((a, b) => displayPrice(b) - displayPrice(a));
  if (sort === 'name_asc') return copy.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return copy;
}

export default function Browse() {
  const [list, setList] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortOption>('default');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const sortedList = sortProducts(list, sort);

  useEffect(() => {
    products.categories({ shop: true }).then((r) => setCategories(r.data || [])).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    products.list({ page, limit: 24, search: search.trim() || undefined, category: category || undefined, shop: true })
      .then((r) => {
        setList(r.data);
        setPages(r.pagination.pages || 1);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [page, search, category]);

  return (
    <div className="space-y-8 w-full max-w-[90rem] mx-auto">
      {/* Hero header */}
      <div className="text-center space-y-2 pt-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--customer-text)]">
          Products
        </h1>
        <p className="text-base sm:text-lg text-[var(--customer-text-muted)] max-w-2xl mx-auto">
          Browse our catalog. Add items to cart and checkout when you’re ready.
        </p>
      </div>

      {/* Filters bar — modern pill search + dropdowns */}
      <div className="rounded-2xl bg-white/95 backdrop-blur border border-[var(--customer-border)] p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder="Search by name or keyword..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-12 pl-5 pr-12 rounded-full border border-[var(--customer-border)] bg-[var(--customer-bg)] text-[var(--customer-text)] placeholder-[var(--customer-text-muted)] focus:ring-2 focus:ring-[var(--customer-primary)]/20 focus:border-[var(--customer-primary)] transition-all duration-200 shadow-sm"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--customer-text-muted)]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="h-12 px-4 rounded-xl border border-[var(--customer-border)] bg-[var(--customer-bg)] text-[var(--customer-text)] focus:ring-2 focus:ring-[var(--customer-primary)]/20 focus:border-[var(--customer-primary)] transition-all duration-200 shadow-sm min-w-[180px]"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="h-12 px-4 rounded-xl border border-[var(--customer-border)] bg-[var(--customer-bg)] text-[var(--customer-text)] focus:ring-2 focus:ring-[var(--customer-primary)]/20 focus:border-[var(--customer-primary)] transition-all duration-200 shadow-sm min-w-[160px]"
          >
            <option value="default">Sort: Default</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="name_asc">Name: A–Z</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--customer-border)] border-t-[var(--customer-primary)] animate-spin" />
          <span className="text-sm text-[var(--customer-text-muted)]">Loading products...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[var(--customer-border)] p-16 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <p className="text-[var(--customer-text-muted)]">No products found.</p>
          <p className="mt-2 text-sm text-[var(--customer-text-muted)] max-w-md mx-auto">
            In the staff panel (Product Management), set product status to <strong>Active</strong> for them to appear in the store.
          </p>
          <button
            type="button"
            onClick={() => { setSearch(''); setCategory(''); setPage(1); }}
            className="mt-3 text-sm font-semibold text-[var(--customer-primary)] hover:underline transition-opacity duration-200"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* Product grid — 1 col mobile, 2 tablet, 4 desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-6">
            {sortedList.map((p) => {
              const hasUnits = p.productUnits && p.productUnits.length > 0;
              const stock = hasUnits
                ? (p.productUnits!.reduce((s, u) => s + u.stock, 0) > 0 ? 1 : 0)
                : (p.inventory?.quantity ?? 0);
              const stockNum = hasUnits ? Math.max(0, ...p.productUnits!.map((u) => u.stock)) : (p.inventory?.quantity ?? 0);
              const lowThreshold = p.inventory?.lowStockThreshold ?? 10;
              const stockLabel = stockNum === 0 ? 'Out of Stock' : hasUnits ? (stockNum > 0 ? 'In Stock' : 'Out of Stock') : stockNum <= lowThreshold ? 'Low Stock' : 'In Stock';
              const stockColor = stockNum === 0 ? 'text-red-600' : hasUnits ? 'text-emerald-600' : stockNum <= lowThreshold ? 'text-amber-600' : 'text-emerald-600';
              const shortDesc = p.description ? (p.description.slice(0, 60) + (p.description.length > 60 ? '…' : '')) : '';
              const uType = getProductUnitType(p);
              const priceLabel = hasUnits
                ? `From ${CURRENCY}${Math.min(...p.productUnits!.map((u) => u.price)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                : uType === 'piece'
                  ? `${CURRENCY}${p.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                  : `${CURRENCY}${p.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}/${uType}`;
              const allowCustom = !hasUnits && (uType === 'kg' || uType === 'meter');
              return (
                <div
                  key={p.id}
                  className="group rounded-2xl border border-[var(--customer-border)] bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300"
                >
                  <Link to={`/product/${p.id}`} className="block aspect-square overflow-hidden bg-[var(--customer-bg)]">
                    <div className="w-full h-full flex items-center justify-center p-5 transition-transform duration-300 group-hover:scale-105">
                      {p.imageUrl ? (
                        <img src={resolveImageUrl(p.imageUrl) ?? ''} alt={p.name} className="w-full h-full object-contain" />
                      ) : (
                        <ProductImagePlaceholder className="w-full h-full max-w-[140px] max-h-[140px]" />
                      )}
                    </div>
                  </Link>
                  <div className="p-5 flex flex-col flex-1 min-w-0">
                    {p.category && (
                      <span className="text-xs font-medium uppercase tracking-wider text-[var(--customer-text-muted)] mb-1.5">
                        {p.category}
                      </span>
                    )}
                    <Link to={`/product/${p.id}`} className="group/title">
                      <h3 className="font-bold text-[var(--customer-text)] line-clamp-2 leading-tight group-hover/title:text-[var(--customer-primary)] transition-colors duration-200">
                        {p.name}
                      </h3>
                    </Link>
                    {shortDesc && (
                      <p className="mt-1.5 text-sm text-[var(--customer-text-muted)] line-clamp-2">{shortDesc}</p>
                    )}
                    <p className="mt-3 text-lg font-bold text-[var(--customer-text)] tabular-nums">
                      {priceLabel}
                    </p>
                    <p className={`text-xs font-medium mt-0.5 ${stockColor}`}>{stockLabel}</p>
                    <div className="mt-4 flex flex-col sm:flex-row gap-2">
                      {hasUnits ? (
                        <Link
                          to={`/product/${p.id}`}
                          className="flex-1 py-3 rounded-xl text-sm font-semibold text-center text-white bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                        >
                          View Details & Choose Unit
                        </Link>
                      ) : allowCustom ? (
                        <CustomQtyAdd
                          product={p}
                          onAdd={(productId, qty) => addItem(productId, { maxQuantity: stock, quantity: qty })}
                          unitLabel={uType === 'kg' ? 'kg' : 'm'}
                          promptLabel={uType === 'kg' ? 'Enter quantity (kg):' : 'Enter length (meter):'}
                        />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => addItem(p.id, { maxQuantity: stock })}
                            disabled={stock === 0}
                            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                          >
                            Add to Cart
                          </button>
                          <Link
                            to={`/product/${p.id}`}
                            className="py-3 px-4 rounded-xl text-sm font-semibold border border-[var(--customer-border)] text-[var(--customer-text-muted)] hover:border-[var(--customer-primary)] hover:text-[var(--customer-primary)] hover:bg-[var(--customer-primary-light)] transition-all duration-200 text-center"
                          >
                            View Details
                          </Link>
                        </>
                      )}
                    </div>
                    {allowCustom && (
                      <Link
                        to={`/product/${p.id}`}
                        className="mt-2 py-2 text-center text-sm font-medium text-[var(--customer-primary)] hover:underline"
                      >
                        View Details
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-8">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--customer-border)] bg-white text-[var(--customer-text)] hover:bg-[var(--customer-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                « Previous
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`min-w-[2.5rem] h-10 rounded-xl text-sm font-medium transition-all duration-200 ${
                        page === p
                          ? 'bg-[var(--customer-primary)] text-white shadow-sm'
                          : 'border border-[var(--customer-border)] bg-white text-[var(--customer-text)] hover:bg-[var(--customer-bg)]'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
                disabled={page >= pages}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--customer-border)] bg-white text-[var(--customer-text)] hover:bg-[var(--customer-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Next »
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
