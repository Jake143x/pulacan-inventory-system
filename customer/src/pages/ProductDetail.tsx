import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { products } from '../api/client';
import type { Product } from '../api/client';
import { useCart } from '../context/CartContext';
import ProductImagePlaceholder from '../components/ProductImagePlaceholder';

const CURRENCY = '₱';

type TabId = 'description' | 'specifications' | 'reviews';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('description');

  useEffect(() => {
    const numId = Number(id);
    if (!numId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    products.get(numId).then(setProduct).catch(() => setProduct(null)).finally(() => setLoading(false));
  }, [id]);

  const stock = product?.inventory?.quantity ?? 0;
  const outOfStock = stock === 0;
  const maxQty = Math.max(0, stock);
  const imageUrl = product?.imageUrl;

  useEffect(() => {
    if (product && quantity > maxQty) setQuantity(Math.max(1, maxQty));
  }, [product, maxQty, quantity]);

  const handleAddToCart = () => {
    if (!product || outOfStock) return;
    const qty = Math.min(Math.max(1, quantity), maxQty);
    for (let i = 0; i < qty; i++) addItem(product.id, { maxQuantity: maxQty });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const shortDescription = product?.description
    ? (product.description.slice(0, 180) + (product.description.length > 180 ? '…' : ''))
    : '';

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-[var(--customer-primary)] animate-spin" />
        <span className="text-sm text-slate-500">Loading product...</span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-[90rem] mx-auto space-y-6">
        <p className="text-slate-600">Product not found.</p>
        <Link to="/browse" className="inline-block px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50">
          ← Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[90rem] mx-auto space-y-6">
      <Link to="/browse" className="inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Back to products
      </Link>

      {/* Content panel — industrial / tool bench theme: rounded, soft shadow */}
      <div className="content-card p-6 sm:p-8">
      {/* Two-column: Left 60% image, Right 40% info */}
      <div className="grid md:grid-cols-5 gap-8 md:gap-12">
        {/* Left — 60%: large product image */}
        <div className="md:col-span-3">
          <div className="aspect-square max-h-[480px] md:max-h-none rounded-2xl border border-slate-200 bg-white flex items-center justify-center p-8 overflow-hidden shadow-sm">
            {imageUrl ? (
              <img src={imageUrl} alt={product.name} className="w-full h-full object-contain" />
            ) : (
              <ProductImagePlaceholder className="w-full h-full max-w-[280px] max-h-[280px]" />
            )}
          </div>
        </div>

        {/* Right — 40%: product info block */}
        <div className="md:col-span-2 flex flex-col">
          {product.category && (
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">
              {product.category}
            </p>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight mb-3">
            {product.name}
          </h1>
          <p className="text-2xl md:text-3xl font-bold text-[var(--customer-primary)] tabular-nums mb-2">
            {CURRENCY}{product.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
          <p className={`text-sm ${outOfStock ? 'text-red-600' : 'text-slate-600'}`}>
            Stock: {outOfStock ? 'Out of stock' : `${stock} available`}
          </p>

          <div className="border-t border-slate-200 my-6" />

          {shortDescription && (
            <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 mb-4">
              {shortDescription}
            </p>
          )}
          {product.sku && (
            <p className="text-xs text-slate-500 mb-6">SKU: {product.sku}</p>
          )}

          {/* Quantity: plus/minus style buttons */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="text-sm font-medium text-slate-700">Qty:</span>
            <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1 || outOfStock}
                className="w-12 h-12 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                −
              </button>
              <span className="w-14 text-center text-base font-semibold text-slate-900 tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty || outOfStock}
                className="w-12 h-12 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Action buttons — clear spacing */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={outOfStock}
              className="w-full py-3.5 rounded-xl text-base font-semibold text-white bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              {added ? 'Added to cart' : outOfStock ? 'Out of stock' : 'Add to Cart'}
            </button>
            <button
              type="button"
              className="w-full py-3.5 rounded-xl text-base font-semibold border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>

      {/* Optional: Tabs — Description | Specifications | Reviews */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex border-b border-slate-200">
          {(['description', 'specifications', 'reviews'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-6 py-4 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-[var(--customer-primary)] border-b-2 border-[var(--customer-primary)] bg-[var(--customer-primary-light)]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="p-6 min-h-[120px]">
          {activeTab === 'description' && (
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
              {product.description || 'No description available.'}
            </p>
          )}
          {activeTab === 'specifications' && (
            <dl className="space-y-3 text-sm">
              <div className="flex gap-4">
                <dt className="text-slate-500 w-32 shrink-0">SKU</dt>
                <dd className="text-slate-900">{product.sku || '—'}</dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-slate-500 w-32 shrink-0">Category</dt>
                <dd className="text-slate-900">{product.category || '—'}</dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-slate-500 w-32 shrink-0">Price</dt>
                <dd className="text-slate-900 font-semibold">{CURRENCY}{product.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-slate-500 w-32 shrink-0">Stock</dt>
                <dd className="text-slate-900">{stock} available</dd>
              </div>
            </dl>
          )}
          {activeTab === 'reviews' && (
            <p className="text-slate-500 text-sm">No reviews yet. Be the first to review this product.</p>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
