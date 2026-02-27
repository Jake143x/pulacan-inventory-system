/**
 * Resolve relative image URLs to absolute using the API's public base URL.
 * Use so the customer store (and admin) get working image URLs when served from another origin (e.g. Render static site).
 */

const BASE =
  process.env.API_BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  '';

export function resolveImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = BASE.replace(/\/$/, '');
  if (url.startsWith('/') && base) return `${base}${url}`;
  return url;
}

/** Return a product-like object with imageUrl resolved to a full URL. */
export function resolveProductImage<T extends { imageUrl?: string | null }>(p: T): T {
  if (!p || p.imageUrl == null) return p;
  return { ...p, imageUrl: resolveImageUrl(p.imageUrl) ?? p.imageUrl };
}

/** Resolve product.imageUrl inside order.items (for API responses). */
export function resolveOrderProductImages<T extends { items?: Array<{ product?: { imageUrl?: string | null } }> }>(order: T): T {
  if (!order?.items) return order;
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      product: item.product ? resolveProductImage(item.product as { imageUrl?: string | null }) : item.product,
    })),
  } as T;
}
