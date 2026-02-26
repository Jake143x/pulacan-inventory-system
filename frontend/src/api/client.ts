const API_URL = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
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
    api<{ token: string; user: User; mustChangePassword?: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, fullName: string) =>
    api<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
    }),
  me: () => api<User>('/auth/me'),
  updateMe: (data: Partial<{ fullName: string; email: string; contactNumber: string | null; profilePictureUrl: string | null; password: string }>) =>
    api<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
};

export async function uploadAvatar(file: File): Promise<{ url: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('avatar', file);
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/upload/avatar`, { method: 'POST', body: formData, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Upload failed');
  return data as { url: string };
}

export async function uploadProductImage(file: File): Promise<{ url: string; path: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('image', file);
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/upload/product`, { method: 'POST', body: formData, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Upload failed');
  return data as { url: string; path: string };
}

export const products = {
  list: (params?: { page?: number; limit?: number; search?: string; category?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.search) sp.set('search', params.search ?? '');
    if (params?.category) sp.set('category', params.category);
    return api<{ data: Product[]; pagination: Pagination }>(`/products?${sp}`);
  },
  get: (id: number) => api<Product>(`/products/${id}`),
  categories: () => api<{ data: string[] }>('/products/categories'),
  create: (body: { name: string; sku?: string; category?: string; description?: string; specifications?: string; unitPrice: number; imageUrl?: string; status?: 'active' | 'inactive'; initialQuantity?: number; lowStockThreshold?: number; reorderLevel?: number; reorderQuantity?: number }) =>
    api<Product>('/products', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<{ name: string; sku: string; category: string; description: string; specifications: string | null; unitPrice: number; imageUrl: string | null; status: 'active' | 'inactive' }>) =>
    api<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: number) => api<void>(`/products/${id}`, { method: 'DELETE' }),
  bulkDelete: (productIds: number[]) =>
    api<{ deleted: number }>('/products/bulk-delete', { method: 'POST', body: JSON.stringify({ productIds }) }),
  bulkUpdateCategory: (productIds: number[], category: string) =>
    api<{ updated: number }>('/products/bulk-category', { method: 'PATCH', body: JSON.stringify({ productIds, category }) }),
};

export type InventoryStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface InventoryListItem {
  id: number;
  productId: number;
  quantity: number;
  lowStockThreshold: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  status?: InventoryStatus;
  isOverstocked?: boolean;
  product?: Product;
}

export interface InventoryMovementRow {
  id: number;
  productId: number;
  type: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
  product?: { id: number; name: string; sku: string | null };
  user?: { id: number; fullName: string; email: string } | null;
}

export const inventory = {
  summary: () =>
    api<{ totalProducts: number; totalValue: number; lowStockCount: number; outOfStockCount: number; overstockedCount: number }>('/inventory/summary'),
  list: (params?: { page?: number; limit?: number; status?: string; search?: string; category?: string; minPrice?: number; maxPrice?: number; minQty?: number; maxQty?: number }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.status) sp.set('status', params.status);
    if (params?.search) sp.set('search', params.search ?? '');
    if (params?.category) sp.set('category', params.category);
    if (params?.minPrice != null) sp.set('minPrice', String(params.minPrice));
    if (params?.maxPrice != null) sp.set('maxPrice', String(params.maxPrice));
    if (params?.minQty != null) sp.set('minQty', String(params.minQty));
    if (params?.maxQty != null) sp.set('maxQty', String(params.maxQty));
    return api<{ data: InventoryListItem[]; pagination: Pagination; lowStockCount: number; outOfStockCount: number }>(`/inventory?${sp}`);
  },
  lowStock: () => api<{ data: InventoryListItem[] }>('/inventory/low-stock'),
  movements: (params?: { page?: number; limit?: number; type?: string; productId?: number }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.type) sp.set('type', params.type);
    if (params?.productId) sp.set('productId', String(params.productId));
    return api<{ data: InventoryMovementRow[]; pagination: Pagination }>(`/inventory/movements?${sp}`);
  },
  update: (productId: number, body: { quantity?: number; lowStockThreshold?: number; reorderLevel?: number; reorderQuantity?: number; movementNotes?: string }) =>
    api<InventoryListItem>(`/inventory/${productId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  bulkAdjust: (items: Array<{ productId: number; quantityDelta: number; notes?: string }>) =>
    api<{ results: Array<{ productId: number; success: boolean; quantity?: number; error?: string }> }>('/inventory/bulk-adjust', { method: 'POST', body: JSON.stringify({ items }) }),
};

export const pos = {
  createTransaction: (items: Array<{ productId: number; quantity: number }>) =>
    api<SaleTransaction>('/pos/transaction', { method: 'POST', body: JSON.stringify({ items }) }),
  /** Recent sales for Current sale chart dropdown. */
  recentTransactions: (params?: { limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set('limit', String(params.limit));
    return api<{ data: SaleTransaction[] }>(`/pos/transactions?${sp}`);
  },
};

export const orders = {
  list: (params?: { page?: number; limit?: number; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.status) sp.set('status', params.status);
    return api<{ data: OnlineOrder[]; pagination: Pagination }>(`/orders?${sp}`);
  },
  pending: () => api<{ data: OnlineOrder[] }>('/orders/pending'),
  get: (id: number) => api<OnlineOrder>(`/orders/${id}`),
  create: (items: Array<{ productId: number; quantity: number }>) =>
    api<OnlineOrder>('/orders', { method: 'POST', body: JSON.stringify({ items }) }),
  approve: (id: number, action: 'approve' | 'reject') =>
    api<OnlineOrder>(`/orders/${id}/approve`, { method: 'PATCH', body: JSON.stringify({ action }) }),
};

export type AnalyticsBatch = {
  sales: { data: SaleTransaction[]; summary: { totalRevenue: number; totalTransactions: number } };
  inventory: { data: InventoryItem[]; lowStockCount: number; lowStockItems: InventoryItem[] };
  bestSelling: { data: Array<{ product: Product; quantity: number }> };
  revenueTrends: { data: Array<{ date: string; revenue: number }> };
  dailyUnits: { data: Array<{ date: string; units: number }> };
  salesByCategory: { data: Array<{ category: string; revenue: number; percentage: number }> };
};

export const reports = {
  /** Latest POS transactions for dashboard Live widget (includes cashier). */
  latestPosTransactions: (params?: { limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set('limit', String(params.limit ?? 10));
    return api<{ data: SaleTransaction[] }>(`/reports/latest-pos-transactions?${sp}`);
  },
  /** Single request for the full Analytics page (avoids rate limit from 6 separate calls). */
  analytics: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    return api<AnalyticsBatch>(`/reports/analytics?${sp}`);
  },
  sales: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    return api<{ data: SaleTransaction[]; summary: { totalRevenue: number; totalTransactions: number } }>(`/reports/sales?${sp}`);
  },
  inventory: () => api<{ data: InventoryItem[]; lowStockCount: number; lowStockItems: InventoryItem[] }>('/reports/inventory'),
  bestSelling: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    return api<{ data: Array<{ productId: number; product: Product; quantity: number }> }>(`/reports/best-selling?${sp}`);
  },
  revenueTrends: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    return api<{ data: Array<{ date: string; revenue: number }> }>(`/reports/revenue-trends?${sp}`);
  },
  dailyUnits: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    return api<{ data: Array<{ date: string; units: number }> }>(`/reports/daily-units?${sp}`);
  },
  salesByCategory: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    return api<{ data: Array<{ category: string; revenue: number; percentage: number }> }>(`/reports/sales-by-category?${sp}`);
  },
};

export const analytics = {
  forecastSummary: () =>
    api<{
      predictedRevenue7d: number;
      predictedRevenue30d: number;
      predictedSalesGrowthPct: number;
      predictedStockOutCount: number;
      previousPeriodRevenue: number;
    }>('/analytics/forecast-summary'),
  salesForecast: (params?: { range?: string; startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.range) sp.set('range', params.range);
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    return api<{
      data: Array<{ date: string; revenue: number; forecast?: boolean }>;
      historicalCount: number;
    }>(`/analytics/sales-forecast?${sp}`);
  },
  stockDepletion: () =>
    api<{
      data: Array<{
        productId: number;
        productName: string;
        currentQuantity: number;
        avgDailySales: number;
        estimatedDaysLeft: number | null;
        riskLevel: 'Safe' | 'Low' | 'Critical';
      }>;
    }>('/analytics/stock-depletion'),
  reorderRecommendations: () =>
    api<{
      data: Array<{
        productId: number;
        productName: string;
        suggestedReorderQuantity: number;
        recommendedTimeframe: string;
        reason: string;
      }>;
    }>('/analytics/reorder-recommendations'),
  slowMoving: (params?: { days?: number }) => {
    const sp = new URLSearchParams();
    if (params?.days) sp.set('days', String(params.days));
    return api<{
      data: Array<{ productId: number; productName: string; daysSinceLastSale: number; currentQuantity: number }>;
      days: number;
    }>(`/analytics/slow-moving?${sp}`);
  },
};

export type BusinessReport = {
  analysisPeriod: { startDate: string; endDate: string };
  stats: {
    daysOfInventory: number;
    avgDailyDemand: number;
    stockValue: number;
    activeRecommendations: number;
  };
  insights: Array<{ title: string; text: string; impact: 'High' | 'Medium' | 'Low'; confidence: number }>;
  forecast: {
    expectedSalesVolume: number;
    salesVolumeChangePercent: number;
    projectedRevenue: number;
    revenueChangePercent: number;
    reorderRequirementsCount: number;
  };
  recommendations: Array<{ title: string; description: string }>;
};

export const ai = {
  runPredict: () => api<{ message: string; data: unknown[] }>('/ai/predict', { method: 'POST' }),
  predictions: () => api<{ data: AiPrediction[] }>('/ai/predictions'),
  businessReport: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const q = sp.toString();
    return api<BusinessReport>(`/ai/business-report${q ? `?${q}` : ''}`);
  },
  chat: (message: string) => api<{ reply: string }>('/ai/chat', { method: 'POST', body: JSON.stringify({ message }) }),
};

export const config = {
  get: () => api<Record<string, string>>('/config'),
  update: (body: Record<string, string>) => api<Record<string, string>>('/config', { method: 'PUT', body: JSON.stringify(body) }),
};

export const users = {
  list: (params?: { page?: number; limit?: number; search?: string; category?: 'all' | 'employee' | 'customer' }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.search) sp.set('search', params.search ?? '');
    if (params?.category && params.category !== 'all') sp.set('category', params.category);
    return api<{ data: User[]; pagination: Pagination }>(`/users?${sp}`);
  },
  get: (id: number) => api<User>(`/users/${id}`),
  create: (body: { email: string; password: string; fullName: string; roleName: 'ADMIN' | 'CASHIER'; isActive?: boolean }) =>
    api<User>('/users', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<{ fullName: string; isActive: boolean; roleName: string; password: string; forcePasswordChange: boolean }>) =>
    api<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: number) => api<void>(`/users/${id}`, { method: 'DELETE' }),
};

export const notifications = {
  unreadCount: () => api<{ count: number }>('/notifications/unread-count'),
  list: (params?: { page?: number; limit?: number; unread?: boolean; riskLevel?: string; startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.unread) sp.set('unread', 'true');
    if (params?.riskLevel) sp.set('riskLevel', params.riskLevel);
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    return api<{ data: Notification[]; pagination: Pagination }>(`/notifications?${sp}`);
  },
  markRead: (id: number) => api<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => api<{ ok: boolean }>('/notifications/read-all', { method: 'PATCH' }),
  delete: (id: number) => api<{ ok: boolean }>(`/notifications/${id}`, { method: 'DELETE' }),
  deleteOld: (before?: string) => {
    const sp = before ? `?before=${encodeURIComponent(before)}` : '';
    return api<{ deleted: number }>(`/notifications/old${sp}`, { method: 'DELETE' });
  },
};

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: string;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  contactNumber?: string | null;
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
  imageUrl?: string | null;
  status?: string;
  inventory?: InventoryItem;
}

export interface InventoryItem {
  id: number;
  productId: number;
  quantity: number;
  lowStockThreshold: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  product?: Product;
  isLowStock?: boolean;
  status?: InventoryStatus;
}

export interface SaleTransaction {
  id: number;
  total: number;
  createdAt: string;
  user?: { id: number; fullName: string; email?: string };
  items: Array<{ productId: number; quantity: number; unitPrice: number; subtotal: number; product?: Product }>;
}

export interface OnlineOrder {
  id: number;
  userId: number;
  status: string;
  total: number;
  paymentMethod?: string | null;
  createdAt: string;
  user?: User;
  items: Array<{ productId: number; quantity: number; unitPrice: number; subtotal: number; product?: Product }>;
}

export interface AiPrediction {
  id: number;
  productId: number;
  product: Product;
  predictedDemand: number;
  suggestedRestock: number;
  riskOfStockout: string | null;
  generatedAt: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  riskLevel?: string | null;
  read: boolean;
  createdAt: string;
  productId?: number | null;
  productName?: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
