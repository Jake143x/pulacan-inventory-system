import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { products, orders, publicConfig } from '../api/client';
import type { Product } from '../api/client';
import { useCart } from '../context/CartContext';
import ProductImagePlaceholder from '../components/ProductImagePlaceholder';

const CURRENCY = '₱';
const SHIPPING_FEE = 150;
const TAX = 0;
const FREE_SHIPPING_THRESHOLD = 2000;
const LOW_STOCK_THRESHOLD = 5;

const PAYMENT_OPTIONS = [
  { value: 'GCASH', label: 'GCash' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'CASH_ON_DELIVERY', label: 'Cash on Delivery' },
] as const;

/** Door Repair Bundle: show when cart contains wood-like + nails-like items (rule-based AI simulation). */
const DOOR_REPAIR_BUNDLE_SAVINGS = 150;
const DOOR_REPAIR_BUNDLE_SLOTS: Array<{ label: string; match: (p: Product) => boolean }> = [
  { label: 'Wood', match: (p) => /wood|lumber/i.test(p.category ?? '') || /wood|lumber/i.test(p.name ?? '') },
  { label: 'Nails', match: (p) => (p.category ?? '').toLowerCase().includes('hardware') || /nail/i.test(p.name ?? '') },
  { label: 'Door Hinges', match: (p) => /hinge/i.test(p.category ?? '') || /hinge/i.test(p.name ?? '') },
  { label: 'Wood Glue', match: (p) => /glue/i.test(p.category ?? '') || /glue/i.test(p.name ?? '') },
  { label: 'Sandpaper', match: (p) => /sandpaper/i.test(p.category ?? '') || /sandpaper/i.test(p.name ?? '') },
];

/* Construction-themed empty cart: cart with tools */
const CartWithToolsIcon = () => (
  <svg className="w-32 h-32 text-slate-300" fill="none" viewBox="0 0 120 120" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M25 38h70l-8 32H33L25 38z" />
    <path d="M45 38V28a5 5 0 0110 0v10" />
    <circle cx="42" cy="78" r="6" />
    <circle cx="78" cy="78" r="6" />
    <path d="M52 78h22" />
    <path d="M75 45l8 6 6-8" />
    <path d="M22 52l6 4 4-6" />
    <path d="M28 68l-4 4 4 4 4-4" />
    <path d="M95 58l4 4-4 4-4-4" />
  </svg>
);

export default function Cart() {
  const [searchParams, setSearchParams] = useSearchParams();
  const addId = searchParams.get('add');
  const { items: cartItems, updateQty, setQuantity, addItem, remove, clear } = useCart();
  const [productList, setProductList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH_ON_DELIVERY');
  const [gcashQrUrl, setGcashQrUrl] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [landmark, setLandmark] = useState('');

  useEffect(() => {
    products.list({ limit: 100 }).then((r) => setProductList(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (paymentMethod !== 'GCASH') return;
    publicConfig.get()
      .then((r) => setGcashQrUrl(r.gcashQrUrl))
      .catch(() => setGcashQrUrl(null));
  }, [paymentMethod]);

  useEffect(() => {
    if (!addId || !productList.length) return;
    const id = Number(addId);
    const p = productList.find((x) => x.id === id);
    if (p) {
      const max = (p as Product & { inventory?: { quantity: number } }).inventory?.quantity ?? 0;
      addItem(id, { maxQuantity: max });
      setSearchParams({});
    }
  }, [addId, productList, addItem, setSearchParams]);

  const cart = cartItems
    .map((item) => {
      const product = productList.find((p) => p.id === item.productId);
      return product ? { product, quantity: item.quantity } : null;
    })
    .filter((x): x is { product: Product; quantity: number } => x != null);

  const updateQtyWithCap = (productId: number, delta: number) => {
    const product = productList.find((p) => p.id === productId);
    const inv = product && (product as Product & { inventory?: { quantity: number } }).inventory;
    const max = inv?.quantity ?? 9999;
    const item = cartItems.find((x) => x.productId === productId);
    if (!item) return;
    if (delta > 0) {
      const newQty = Math.min(item.quantity + delta, max);
      setQuantity(productId, newQty);
    } else {
      updateQty(productId, delta);
    }
  };

  const subtotal = cart.reduce((s, i) => s + i.product.unitPrice * i.quantity, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping + TAX;
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  // Rule-based AI: show Door Repair Bundle when cart has wood-like + nails-like items
  // (matches "Wood" / "Building Materials" / lumber and "Nails" / "Hardware" / nail in name)
  const showDoorRepairRecommendation = useMemo(() => {
    const cat = (c: Product) => (c.category ?? '').toLowerCase();
    const name = (c: Product) => (c.name ?? '').toLowerCase();
    const hasWood = cart.some(
      (c) =>
        cat(c.product) === 'wood' ||
        cat(c.product).includes('building materials') ||
        cat(c.product).includes('lumber') ||
        /wood|lumber/i.test(name(c.product))
    );
    const hasNails = cart.some(
      (c) =>
        cat(c.product) === 'nails' ||
        cat(c.product).includes('hardware') ||
        /nail/i.test(name(c.product))
    );
    return hasWood && hasNails;
  }, [cart]);

  const doorRepairBundleProducts = useMemo(() => {
    return DOOR_REPAIR_BUNDLE_SLOTS.map((slot) => {
      const product = productList.find((p) => slot.match(p));
      return { label: slot.label, product: product ?? null };
    });
  }, [productList]);

  const bundleTotalPrice = useMemo(() => {
    return doorRepairBundleProducts.reduce((sum, { product }) => sum + (product?.unitPrice ?? 0), 0);
  }, [doorRepairBundleProducts]);

  const addDoorRepairBundle = () => {
    doorRepairBundleProducts.forEach(({ product }) => {
      if (!product) return;
      const max = (product as Product & { inventory?: { quantity: number } }).inventory?.quantity ?? 99;
      addItem(product.id, { maxQuantity: max });
    });
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      setErr('Your cart is empty.');
      return;
    }
    const street = streetAddress.trim();
    const brgy = barangay.trim();
    const cityVal = city.trim();
    const prov = province.trim();
    const zip = zipCode.trim();
    if (!street || !brgy || !cityVal || !prov || !zip) {
      setErr('Please fill in all required shipping address fields (Street, Barangay, City, Province, ZIP Code).');
      return;
    }
    setPlacing(true);
    setErr('');
    setSuccess('');
    try {
      await orders.create(
        cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        paymentMethod,
        {
          streetAddress: street,
          barangay: brgy,
          city: cityVal,
          province: prov,
          zipCode: zip,
          ...(landmark.trim() && { landmark: landmark.trim() }),
        }
      );
      setSuccess('Order placed successfully. It is pending approval.');
      clear();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setPlacing(false);
    }
  };

  if (loading && productList.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-[var(--customer-primary)] animate-spin" />
        <span className="text-sm text-slate-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[90rem] mx-auto space-y-6">
      {err && <p className="text-sm text-red-600 rounded-xl bg-red-50 px-4 py-2">{err}</p>}
      {success && <p className="text-sm text-emerald-700 rounded-xl bg-emerald-50 px-4 py-2">{success}</p>}

      {cart.length === 0 ? (
        /* ——— EMPTY CART — Construction theme, large white card ——— */
        <div className="content-card max-w-lg mx-auto overflow-hidden">
          <div className="p-8 sm:p-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-36 h-36 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                <CartWithToolsIcon />
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Your cart is empty</h2>
            <p className="mt-2 text-slate-600 text-sm">
              Looks like you haven&apos;t added anything yet.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                to="/browse"
                className="inline-flex items-center justify-center w-full py-3.5 px-6 rounded-xl text-base font-semibold text-white bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-hover)] transition-colors shadow-md"
              >
                Browse Products
              </Link>
              <Link
                to="/dashboard"
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                View featured items
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* ——— CART WITH ITEMS — Large white container card ——— */
        <div className="content-card p-6 sm:p-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Cart ({itemCount} {itemCount === 1 ? 'item' : 'items'})</h1>
            <p className="mt-1 text-sm text-slate-600">Review your items before checkout.</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 mt-6">
            {/* LEFT (70%) — Cart items */}
            <div className="lg:w-[70%] space-y-0">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {cart.map((i, index) => {
                  const stock = (i.product as Product & { inventory?: { quantity: number } }).inventory?.quantity ?? 0;
                  const lowStock = stock > 0 && stock <= LOW_STOCK_THRESHOLD;
                  const shortDesc = i.product.description
                    ? (i.product.description.slice(0, 60) + (i.product.description.length > 60 ? '…' : ''))
                    : '';
                  return (
                    <div key={i.product.id}>
                      {index > 0 && <div className="border-t border-slate-200" />}
                      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                        <Link to={`/product/${i.product.id}`} className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                          {i.product.imageUrl ? (
                            <img src={i.product.imageUrl} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <ProductImagePlaceholder className="w-10 h-10" />
                          )}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link to={`/product/${i.product.id}`} className="font-semibold text-slate-900 hover:text-[var(--customer-primary)] line-clamp-2">
                            {i.product.name}
                          </Link>
                          {shortDesc && <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{shortDesc}</p>}
                          <p className="text-sm font-medium text-slate-700 mt-1 tabular-nums">
                            {CURRENCY}{i.product.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </p>
                          {lowStock && (
                            <p className="text-xs text-amber-600 font-medium mt-1">Only {stock} left in stock</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden bg-white">
                            <button
                              type="button"
                              onClick={() => updateQtyWithCap(i.product.id, -1)}
                              className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                            >
                              −
                            </button>
                            <span className="w-10 text-center text-sm font-semibold text-slate-900 tabular-nums">{i.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQtyWithCap(i.product.id, 1)}
                              className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                            >
                              +
                            </button>
                          </div>
                          <p className="font-semibold text-slate-900 tabular-nums w-24 text-right">
                            {CURRENCY}{(i.product.unitPrice * i.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </p>
                          <button
                            type="button"
                            onClick={() => remove(i.product.id)}
                            className="text-sm text-red-600 hover:text-red-700 font-medium shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Recommended Package — show when cart has Wood + Nails */}
              {showDoorRepairRecommendation && (
                <div
                  className="mt-6 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-sky-50 to-blue-50/80 p-5 sm:p-6 shadow-md ai-recommend-fade-in relative overflow-hidden"
                  style={{ boxShadow: '0 4px 20px rgba(14, 165, 233, 0.12)' }}
                >
                  <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider text-sky-600 bg-sky-100/90 px-2 py-1 rounded-lg border border-sky-200/80">
                    AI Suggested
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 pr-24">
                    🧠 AI Recommended Package For Your Project
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Based on the items in your cart, you may also need:
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3 overflow-x-auto pb-2">
                    {doorRepairBundleProducts.map(({ label, product }, idx) => (
                      <Fragment key={idx}>
                        {idx > 0 && (
                          <span className="shrink-0 text-slate-400 font-bold text-lg" aria-hidden>+</span>
                        )}
                        <div
                          className="flex flex-col shrink-0 w-24 sm:w-28 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden"
                        >
                          <div className="w-full aspect-square bg-slate-100 flex items-center justify-center p-2">
                            {product?.imageUrl ? (
                              <img src={product.imageUrl} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <ProductImagePlaceholder className="w-8 h-8 text-slate-400" />
                            )}
                          </div>
                          <div className="p-2 flex-1 flex flex-col min-w-0">
                            <p className="text-xs font-medium text-slate-900 line-clamp-2 leading-tight">
                              {product?.name ?? label}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-700 tabular-nums">
                              {product != null
                                ? `${CURRENCY}${product.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                : '—'}
                          </p>
                        </div>
                        </div>
                      </Fragment>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="text-slate-600">
                      Bundle total: <span className="font-semibold text-slate-900 tabular-nums">{CURRENCY}{bundleTotalPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </span>
                    <span className="text-emerald-600 font-semibold">
                      Save {CURRENCY}{DOOR_REPAIR_BUNDLE_SAVINGS.toLocaleString('en-PH', { minimumFractionDigits: 0 })} when you buy this complete set
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={addDoorRepairBundle}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-hover)] shadow-md transition-colors"
                    >
                      Add Complete Door Repair Kit
                    </button>
                    <Link
                      to="/browse"
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      View Bundle Details
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT (30%) — Order summary (sticky) */}
            <div className="lg:w-[30%] shrink-0">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md sticky top-24">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Order Summary</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="tabular-nums font-medium">{CURRENCY}{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping</span>
                    <span className="tabular-nums font-medium">
                      {shipping === 0 ? 'Free' : `${CURRENCY}${shipping.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax</span>
                    <span className="tabular-nums font-medium">{CURRENCY}{TAX.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                    <span className="font-semibold text-slate-900">Total</span>
                    <span className="text-lg font-bold text-slate-900 tabular-nums">{CURRENCY}{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD && (
                  <p className="mt-3 text-xs text-slate-500">
                    Add {CURRENCY}{(FREE_SHIPPING_THRESHOLD - subtotal).toLocaleString('en-PH', { minimumFractionDigits: 0 })} more for free shipping.
                  </p>
                )}

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Shipping address</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Street address <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={streetAddress}
                        onChange={(e) => setStreetAddress(e.target.value)}
                        placeholder="House/unit no., street name"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[var(--customer-primary)]/30 focus:border-[var(--customer-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Barangay <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={barangay}
                        onChange={(e) => setBarangay(e.target.value)}
                        placeholder="Barangay"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[var(--customer-primary)]/30 focus:border-[var(--customer-primary)]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">City <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="City"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[var(--customer-primary)]/30 focus:border-[var(--customer-primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Province <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={province}
                          onChange={(e) => setProvince(e.target.value)}
                          placeholder="Province"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[var(--customer-primary)]/30 focus:border-[var(--customer-primary)]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">ZIP code <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                          placeholder="ZIP"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[var(--customer-primary)]/30 focus:border-[var(--customer-primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Landmark (optional)</label>
                        <input
                          type="text"
                          value={landmark}
                          onChange={(e) => setLandmark(e.target.value)}
                          placeholder="e.g. near church"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[var(--customer-primary)]/30 focus:border-[var(--customer-primary)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs text-slate-500 mb-1">Promo code</label>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Enter code"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[var(--customer-primary)]/30 focus:border-[var(--customer-primary)]"
                  />
                </div>

                <div className="mt-4 space-y-3">
                  <p className="text-xs text-slate-500">Payment</p>
                  <div className="flex flex-wrap gap-3">
                    {PAYMENT_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={opt.value}
                          checked={paymentMethod === opt.value}
                          onChange={() => setPaymentMethod(opt.value)}
                          className="rounded-full border-slate-300 text-[var(--customer-primary)] focus:ring-[var(--customer-primary)]"
                        />
                        <span className="text-sm text-slate-700">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'GCASH' && gcashQrUrl && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-xs text-slate-600 mb-2">Scan to pay</p>
                    <div className="inline-block p-2 bg-white rounded-lg">
                      <img src={gcashQrUrl} alt="GCash QR" className="w-28 h-28 object-contain" />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={placing}
                  className="mt-5 w-full py-3.5 rounded-xl text-base font-semibold text-white bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-hover)] disabled:opacity-50 transition-colors shadow-md"
                >
                  {placing ? 'Placing…' : 'Proceed to Checkout'}
                </button>
                <p className="mt-2 text-xs text-slate-500 text-center">Secure checkout guaranteed</p>
                <Link to="/browse" className="mt-3 block text-center text-sm font-medium text-slate-600 hover:text-slate-900">
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
