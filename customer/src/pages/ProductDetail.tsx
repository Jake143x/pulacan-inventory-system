import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { products } from '../api/client';
import type { Product } from '../api/client';
import { resolveImageUrl, getProductUnitType } from '../api/client';
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
  const [selectedUnitName, setSelectedUnitName] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('description');

  useEffect(() => {
    const numId = Number(id);
    if (!numId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    products.get(numId).then((p) => {
      setProduct(p);
      if (p?.productUnits?.length) setSelectedUnitName(p.productUnits[0].unitName);
      else setSelectedUnitName(null);
    }).catch(() => setProduct(null)).finally(() => setLoading(false));
  }, [id]);

  const hasUnits = product?.productUnits && product.productUnits.length > 0;
  const selectedUnit = hasUnits && selectedUnitName
    ? product!.productUnits!.find((u) => u.unitName.toLowerCase() === selectedUnitName.toLowerCase())
    : null;
  const stock = selectedUnit ? selectedUnit.stock : (product?.inventory?.quantity ?? 0);
  const outOfStock = stock === 0;
  const maxQty = Math.max(0, stock);
  const pricePerUnit = selectedUnit ? selectedUnit.price : (product?.unitPrice ?? 0);
  const isDecimalUnit = selectedUnitName ? /^(kg|meter|liter|kilo|metre|litre)$/i.test(selectedUnitName) : (getProductUnitType(product) === 'kg' || getProductUnitType(product) === 'meter');
  const allowCustom = hasUnits ? isDecimalUnit : (getProductUnitType(product) === 'kg' || getProductUnitType(product) === 'meter');
  const uType = selectedUnitName || getProductUnitType(product);
  const minQ = isDecimalUnit ? 0.01 : 1;
  const step = isDecimalUnit ? 0.01 : 1;
  const imageUrl = product?.imageUrl;

  useEffect(() => {
    if (product && quantity > maxQty) setQuantity(allowCustom ? Math.max(minQ, maxQty) : Math.max(1, maxQty));
  }, [product, maxQty, quantity, allowCustom, minQ]);

  useEffect(() => {
    if (product && allowCustom && selectedUnit) setQuantity(minQ);
  }, [product?.id, allowCustom, minQ, selectedUnitName]);

  const handleAddToCart = () => {
    if (!product || outOfStock) return;
    const qty = allowCustom
      ? Math.min(Math.max(minQ, quantity), maxQty)
      : Math.min(Math.max(1, quantity), maxQty);
    addItem(product.id, {
      maxQuantity: maxQty,
      quantity: qty,
      ...(hasUnits && selectedUnitName && { unitName: selectedUnitName, pricePerUnit: pricePerUnit }),
    });
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
              <img src={resolveImageUrl(imageUrl) ?? ''} alt={product.name} className="w-full h-full object-contain" />
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
          {hasUnits ? (
            <>
              <p className="text-sm font-medium text-slate-700 mb-2">Purchase Unit</p>
              <div className="flex flex-wrap gap-3 mb-3">
                {product.productUnits!.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="purchaseUnit"
                      checked={(selectedUnitName ?? '') === u.unitName}
                      onChange={() => {
                        setSelectedUnitName(u.unitName);
                        const isDec = /^(kg|meter|liter|kilo|metre|litre)$/i.test(u.unitName);
                        setQuantity(isDec ? 0.01 : 1);
                      }}
                      className="text-[var(--customer-primary)] focus:ring-[var(--customer-primary)]"
                    />
                    <span className="font-medium text-slate-900">{u.unitName}</span>
                    <span className="tabular-nums text-slate-600">₱{u.price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    <span className="text-xs text-slate-500">({u.stock} in stock)</span>
                  </label>
                ))}
              </div>
              <p className="text-2xl md:text-3xl font-bold text-[var(--customer-primary)] tabular-nums mb-2">
                {selectedUnit ? `${CURRENCY}${selectedUnit.price.toLocaleString('en-PH', { minimumFractionDigits: 2 })} per ${selectedUnit.unitName}` : ''}
              </p>
              <p className={`text-sm ${outOfStock ? 'text-red-600' : 'text-slate-600'}`}>
                Stock: {outOfStock ? 'Out of stock' : `${typeof stock === 'number' && stock % 1 !== 0 ? stock.toFixed(2) : stock} ${selectedUnitName ?? ''} available`}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl md:text-3xl font-bold text-[var(--customer-primary)] tabular-nums mb-2">
                {uType === 'piece' ? CURRENCY + product.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : `${CURRENCY}${product.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })} per ${uType}`}
              </p>
              <p className={`text-sm ${outOfStock ? 'text-red-600' : 'text-slate-600'}`}>
                Stock: {outOfStock ? 'Out of stock' : `${typeof stock === 'number' && stock % 1 !== 0 ? stock.toFixed(2) : stock} ${uType} available`}
              </p>
              {allowCustom && (
                <p className="text-sm text-slate-600 mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <span className="font-medium text-slate-700">Custom quantity:</span> {uType === 'kg' ? 'Enter weight in kg (e.g. 1.5, 2.75).' : 'Enter length in meters (e.g. 0.5, 3.25).'}
                </p>
              )}
            </>
          )}

          <div className="border-t border-slate-200 my-6" />

          {shortDescription && (
            <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 mb-4">
              {shortDescription}
            </p>
          )}
          {product.sku && (
            <p className="text-xs text-slate-500 mb-6">SKU: {product.sku}</p>
          )}

          {/* Quantity: decimal for kg/meter/liter, plus/minus for piece/bag/box/sheet/roll */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="text-sm font-medium text-slate-700">
              {allowCustom ? (selectedUnitName?.toLowerCase() === 'kg' ? 'Quantity (kg):' : selectedUnitName?.toLowerCase() === 'meter' ? 'Length (meter):' : 'Quantity:') : 'Qty:'}
            </span>
            {allowCustom ? (
              <input
                type="number"
                min={minQ}
                step={step}
                max={maxQty}
                value={quantity}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') return;
                  const n = Number(v);
                  if (!Number.isNaN(n)) setQuantity(n);
                }}
                className="w-28 py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-base font-semibold tabular-nums focus:ring-2 focus:ring-[var(--customer-primary)]/20 focus:border-[var(--customer-primary)]"
              />
            ) : (
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
            )}
          </div>

          <p className="text-lg font-semibold text-slate-900 mb-6">
            Total: {CURRENCY}{(quantity * pricePerUnit).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>

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
                <dd className="text-slate-900 font-semibold">
                  {hasUnits && product.productUnits?.length
                    ? `From ${CURRENCY}${Math.min(...product.productUnits.map((u) => u.price)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                    : `${CURRENCY}${product.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-slate-500 w-32 shrink-0">Stock</dt>
                <dd className="text-slate-900">{stock} {hasUnits && selectedUnitName ? selectedUnitName : uType} available</dd>
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
