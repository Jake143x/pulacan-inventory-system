const API_URL = import.meta.env.VITE_API_URL || '/api';

/** Base URL of the API server (no /api suffix). Used to resolve relative image paths. */
export const API_BASE_URL = API_URL ? API_URL.replace(/\/api\/?$/, '') : '';

/** Resolve product/upload image URL so it loads from the backend when the app is on a different origin (e.g. static site). */
export function resolveImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/') && API_BASE_URL) return `${API_BASE_URL}${url}`;
  return url;
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data as T;
}

export const auth = {
  login: (email: string, password: string) =>
    api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, fullName: string, contactNumber?: string) =>
    api<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName, contactNumber: contactNumber || undefined }),
    }),
  me: () => api<User>('/auth/me'),
  updateProfile: (data: { fullName?: string; password?: string; profilePictureUrl?: string | null }) =>
    api<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
};

export async function uploadAvatar(file: File): Promise<{ url: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('avatar', file);
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/upload/avatar`, { method: 'POST', body: formData, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Upload failed');
  return data as { url: string };
}

export const products = {
  list: (params?: { page?: number; limit?: number; search?: string; category?: string; shop?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.search) sp.set('search', params.search ?? '');
    if (params?.category) sp.set('category', params.category ?? '');
    if (params?.shop) sp.set('shop', 'true');
    return api<{ data: Product[]; pagination: Pagination }>(`/products?${sp}`);
  },
  get: (id: number) => api<Product>(`/products/${id}`),
  categories: (params?: { shop?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.shop) sp.set('shop', 'true');
    const q = sp.toString();
    return api<{ data: string[] }>(`/products/categories${q ? `?${q}` : ''}`);
  },
};

export const orders = {
  list: (params?: { page?: number; limit?: number; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.status) sp.set('status', params.status ?? '');
    return api<{ data: OnlineOrder[]; pagination: Pagination }>(`/orders?${sp}`);
  },
  get: (id: number) => api<OnlineOrder>(`/orders/${id}`),
  create: (
    items: Array<{ productId: number; quantity: number }>,
    paymentMethod?: string,
    address?: ShippingAddress
  ) =>
    api<OnlineOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        items,
        ...(paymentMethod && { paymentMethod }),
        ...(address && {
          streetAddress: address.streetAddress,
          barangay: address.barangay,
          city: address.city,
          province: address.province,
          zipCode: address.zipCode,
          ...(address.landmark && { landmark: address.landmark }),
        }),
      }),
    }),
  delete: (id: number) => api<{ ok: boolean }>(`/orders/${id}`, { method: 'DELETE' }),
};

export const ai = {
  chat: (message: string) =>
    api<{ reply: string }>('/ai/chat', { method: 'POST', body: JSON.stringify({ message }) }),
};

export const notifications = {
  list: (params?: { page?: number; limit?: number; unread?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.unread) sp.set('unread', 'true');
    return api<{ data: Notification[]; pagination: Pagination }>(`/notifications?${sp}`);
  },
  markAsRead: (id: number) => api<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => api<{ ok: boolean }>('/notifications/read-all', { method: 'PATCH' }),
  delete: (id: number) => api<{ ok: boolean }>(`/notifications/${id}`, { method: 'DELETE' }),
};

/** Public config (e.g. GCash QR URL for payment). No auth required. */
export const publicConfig = {
  get: () => api<{ gcashQrUrl: string | null }>('/config/public'),
};

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: string;
  profilePictureUrl?: string | null;
}

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  specifications?: string | null;
  unitPrice: number;
  /** Optional image URL — when set, product cards and detail page show this image; otherwise placeholder/logo is shown. */
  imageUrl?: string | null;
  inventory?: { quantity: number; lowStockThreshold: number };
}

export interface ShippingAddress {
  streetAddress: string;
  barangay: string;
  city: string;
  province: string;
  zipCode: string;
  landmark?: string;
}

export interface OnlineOrder {
  id: number;
  userId: number;
  status: string;
  total: number;
  paymentMethod?: string | null;
  streetAddress?: string | null;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
  zipCode?: string | null;
  landmark?: string | null;
  createdAt: string;
  items: Array<{ productId: number; quantity: number; unitPrice: number; subtotal: number; product?: Product }>;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
