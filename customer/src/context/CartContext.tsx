import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'pulacan_cart';

export { STORAGE_KEY };

export type CartItem = { productId: number; quantity: number };

type CartContextValue = {
  items: CartItem[];
  addItem: (productId: number, options?: { maxQuantity?: number }) => void;
  updateQty: (productId: number, delta: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
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

  const addItem = useCallback((productId: number, options?: { maxQuantity?: number }) => {
    const max = options?.maxQuantity ?? 9999;
    setItems((prev) => {
      const existing = prev.find((x) => x.productId === productId);
      const newQty = existing ? Math.min(existing.quantity + 1, max) : Math.min(1, max);
      if (newQty <= 0) return prev;
      if (existing) return prev.map((x) => (x.productId === productId ? { ...x, quantity: newQty } : x));
      return [...prev, { productId, quantity: newQty }];
    });
  }, []);

  const updateQty = useCallback((productId: number, delta: number) => {
    setItems((prev) => {
      const existing = prev.find((x) => x.productId === productId);
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) return prev.filter((x) => x.productId !== productId);
      return prev.map((x) => (x.productId === productId ? { ...x, quantity: newQty } : x));
    });
  }, []);

  const setQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((x) => x.productId !== productId));
      return;
    }
    setItems((prev) => {
      const existing = prev.find((x) => x.productId === productId);
      if (existing) return prev.map((x) => (x.productId === productId ? { ...x, quantity } : x));
      return [...prev, { productId, quantity }];
    });
  }, []);

  const remove = useCallback((productId: number) => {
    setItems((prev) => prev.filter((x) => x.productId !== productId));
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
