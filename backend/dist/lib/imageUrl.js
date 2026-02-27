/**
 * Resolve relative image URLs to absolute using the API's public base URL.
 * Use so the customer store (and admin) get working image URLs when served from another origin (e.g. Render static site).
 */
const BASE = process.env.API_BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    '';
/** Public base URL (no trailing slash) used for image URLs. Empty if not set. */
export function getImageBaseUrl() {
    return BASE.replace(/\/$/, '');
}
export function resolveImageUrl(url) {
    if (!url)
        return url;
    if (url.startsWith('http://') || url.startsWith('https://'))
        return url;
    const base = getImageBaseUrl();
    if (url.startsWith('/') && base)
        return `${base}${url}`;
    return url;
}
/** Return a product-like object with imageUrl resolved to a full URL. */
export function resolveProductImage(p) {
    if (!p || p.imageUrl == null)
        return p;
    return { ...p, imageUrl: resolveImageUrl(p.imageUrl) ?? p.imageUrl };
}
/** Resolve product.imageUrl inside order.items (for API responses). */
export function resolveOrderProductImages(order) {
    if (!order?.items)
        return order;
    return {
        ...order,
        items: order.items.map((item) => ({
            ...item,
            product: item.product ? resolveProductImage(item.product) : item.product,
        })),
    };
}
