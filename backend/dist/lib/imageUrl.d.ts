/**
 * Resolve relative image URLs to absolute using the API's public base URL.
 * Use so the customer store (and admin) get working image URLs when served from another origin (e.g. Render static site).
 */
/** Public base URL (no trailing slash) used for image URLs. Empty if not set. */
export declare function getImageBaseUrl(): string;
export declare function resolveImageUrl(url: string | null | undefined): string | null | undefined;
/** Return a product-like object with imageUrl resolved to a full URL. */
export declare function resolveProductImage<T extends {
    imageUrl?: string | null;
}>(p: T): T;
/** Resolve product.imageUrl inside order.items (for API responses). */
export declare function resolveOrderProductImages<T extends {
    items?: Array<{
        product?: {
            imageUrl?: string | null;
        };
    }>;
}>(order: T): T;
