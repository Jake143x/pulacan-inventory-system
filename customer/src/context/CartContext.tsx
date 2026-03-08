import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'pulacan_cart';

export { STORAGE_KEY };

export type CartItem = {
  productId: number;
  quantity: number;
  /** When product has multiple purchase units */
  unitName?: string;
  /** Price per unit at time of add (for display and total) */
  pricePerUnit?: number;
};

/** Unique key for a cart line: same product + same unit = same line */
export function cartItemKey(item: CartItem): string {
  return `${item.productId}:${item.unitName ?? ''}`;
}

type CartContextValue = {
  items: CartItem[];
  addItem: (productId: number, options?: { maxQuantity?: number; quantity?: number; unitName?: string; pricePerUnit?: number }) => void;
  updateQty: (productId: number, delta: number, unitName?: string) => void;
  setQuantity: (productId: number, quantity: number, unitName?: string) => void;
  remove: (productId: number, unitName?: string) => void;
  clear: () => void;
  itemCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is CartItem =>
        typeof x === 'object' &&
        x != null &&
        typeof (x as CartItem).productId === 'number' &&
        typeof (x as CartItem).quantity === 'number' &&
        (x as CartItem).quantity > 0
    );
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    saveCart(items);
  }, [items]);

  const addItem = useCallback((productId: number, options?: { maxQuantity?: number; quantity?: number; unitName?: string; pricePerUnit?: number }) => {
    const max = options?.maxQuantity ?? 9999;
    const qty = options?.quantity ?? 1;
    const unitName = options?.unitName ?? undefined;
    const pricePerUnit = options?.pricePerUnit ?? undefined;
    const addQty = Math.max(0, typeof qty === 'number' && Number.isFinite(qty) ? qty : 1);
    setItems((prev) => {
      const existing = prev.find((x) => x.productId === productId && (x.unitName ?? '') === (unitName ?? ''));
      const newQty = existing ? Math.min(existing.quantity + addQty, max) : Math.min(addQty, max);
      if (newQty <= 0) return prev;
      const newItem: CartItem = { productId, quantity: newQty };
      if (unitName !== undefined) newItem.unitName = unitName;
      if (pricePerUnit !== undefined) newItem.pricePerUnit = pricePerUnit;
      if (existing) return prev.map((x) => (x.productId === productId && (x.unitName ?? '') === (unitName ?? '') ? { ...x, quantity: newQty, ...(pricePerUnit !== undefined && { pricePerUnit }) } : x));
      return [...prev, newItem];
    });
  }, []);

  const updateQty = useCallback((productId: number, delta: number, unitName?: string) => {
    setItems((prev) => {
      const existing = prev.find((x) => x.productId === productId && (x.unitName ?? '') === (unitName ?? ''));
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) return prev.filter((x) => !(x.productId === productId && (x.unitName ?? '') === (unitName ?? '')));
      return prev.map((x) => (x.productId === productId && (x.unitName ?? '') === (unitName ?? '') ? { ...x, quantity: newQty } : x));
    });
  }, []);

  const setQuantity = useCallback((productId: number, quantity: number, unitName?: string) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((x) => !(x.productId === productId && (x.unitName ?? '') === (unitName ?? ''))));
      return;
    }
    setItems((prev) => {
      const existing = prev.find((x) => x.productId === productId && (x.unitName ?? '') === (unitName ?? ''));
      if (existing) return prev.map((x) => (x.productId === productId && (x.unitName ?? '') === (unitName ?? '') ? { ...x, quantity } : x));
      return [...prev, { productId, quantity, ...(unitName !== undefined && { unitName }) }];
    });
  }, []);

  const remove = useCallback((productId: number, unitName?: string) => {
    setItems((prev) => prev.filter((x) => !(x.productId === productId && (x.unitName ?? '') === (unitName ?? ''))));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const value: CartContextValue = {
    items,
    addItem,
    updateQty,
    setQuantity,
    remove,
    clear,
    itemCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
