import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

function parseReportDate(value: string | undefined, fallback: Date): Date {
  if (!value || typeof value !== 'string') return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/** Parse end date as end of day (23:59:59.999) so "today" includes full day in UTC. */
function parseReportDateEnd(value: string | undefined, fallback: Date): Date {
  if (!value || typeof value !== 'string') return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

router.use(authenticate);
router.use(requireRoles('OWNER', 'ADMIN'));

/** Single batch endpoint for Analytics page — one request instead of six to avoid rate limit. */
router.get('/analytics', async (req, res, next) => {
  try {
    const start = req.query.startDate as string;
    const end = req.query.endDate as string;
    const startDate = parseReportDate(start, new Date(0));
    const endDate = parseReportDateEnd(end, new Date());

    const [sales, inv, saleItemsForPeriod, saleItemsDaily, saleItemsCategory] = await Promise.all([
      prisma.saleTransaction.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inventory.findMany({ include: { product: true } }),
      prisma.saleItem.findMany({
        where: { sale: { createdAt: { gte: startDate, lte: endDate } } },
        include: { product: true, sale: true },
      }),
      prisma.saleItem.findMany({
        where: { sale: { createdAt: { gte: startDate, lte: endDate } } },
        include: { sale: true },
      }),
      prisma.saleItem.findMany({
        where: { sale: { createdAt: { gte: startDate, lte: endDate } } },
        include: { product: true },
      }),
    ]);

    const totalRevenue = sales.reduce((s, t) => s + t.total, 0);
    const lowStock = inv.filter((i) => i.quantity <= i.lowStockThreshold);

    const byProduct = new Map<number, { product: (typeof saleItemsForPeriod)[0]['product']; quantity: number }>();
    for (const item of saleItemsForPeriod) {
      const existing = byProduct.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        byProduct.set(item.productId, { product: item.product, quantity: item.quantity });
      }
    }
    const bestSelling = [...byProduct.entries()]
      .map(([, v]) => v)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);

    const byDayRevenue = new Map<string, number>();
    for (const s of sales) {
      const key = s.createdAt.toISOString().slice(0, 10);
      byDayRevenue.set(key, (byDayRevenue.get(key) ?? 0) + s.total);
    }
    const revenueTrends = [...byDayRevenue.entries()]
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const byDayUnits = new Map<string, number>();
    for (const item of saleItemsDaily) {
      const key = item.sale.createdAt.toISOString().slice(0, 10);
      byDayUnits.set(key, (byDayUnits.get(key) ?? 0) + item.quantity);
    }
    const dailyUnits = [...byDayUnits.entries()]
      .map(([date, units]) => ({ date, units }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const byCategory = new Map<string, number>();
    for (const item of saleItemsCategory) {
      const cat = item.product?.category?.trim() || 'Uncategorized';
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + item.subtotal);
    }
    const catTotal = [...byCategory.values()].reduce((a, b) => a + b, 0);
    const salesByCategory = [...byCategory.entries()]
      .map(([category, revenue]) => ({
        category,
        revenue,
        percentage: catTotal > 0 ? Math.round((revenue / catTotal) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      sales: {
        data: sales,
        summary: { totalRevenue, totalTransactions: sales.length },
      },
      inventory: { data: inv, lowStockCount: lowStock.length, lowStockItems: lowStock },
      bestSelling: { data: bestSelling },
      revenueTrends: { data: revenueTrends },
      dailyUnits: { data: dailyUnits },
      salesByCategory: { data: salesByCategory },
    });
  } catch (e) {
    console.error('[reports/analytics]', e);
    next(e);
  }
});

router.get('/sales', async (req, res, next) => {
  try {
    const start = req.query.startDate as string;
    const end = req.query.endDate as string;
    const startDate = parseReportDate(start, new Date(0));
    const endDate = parseReportDateEnd(end, new Date());
    const sales = await prisma.saleTransaction.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const totalRevenue = sales.reduce((s, t) => s + t.total, 0);
    const totalTransactions = sales.length;
    res.json({
      data: sales,
      summary: { totalRevenue, totalTransactions },
    });
  } catch (e) {
    console.error('[reports/sales]', e);
    next(e);
  }
});

/** Latest POS transactions for dashboard Live widget (includes cashier). */
router.get('/latest-pos-transactions', async (req, res, next) => {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
    const sales = await prisma.saleTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    res.json({ data: sales });
  } catch (e) {
    next(e);
  }
});

router.get('/inventory', async (_req, res, next) => {
  try {
    const inv = await prisma.inventory.findMany({
      include: { product: true },
    });
    const lowStock = inv.filter((i) => i.quantity <= i.lowStockThreshold);
    res.json({
      data: inv,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock,
    });
  } catch (e) {
    console.error('[reports/inventory]', e);
    next(e);
  }
});

router.get('/best-selling', async (req, res, next) => {
  try {
    const start = req.query.startDate as string;
    const end = req.query.endDate as string;
    const startDate = parseReportDate(start, new Date(0));
    const endDate = parseReportDateEnd(end, new Date());
    const items = await prisma.saleItem.findMany({
      where: {
        sale: {
          createdAt: { gte: startDate, lte: endDate },
        },
      },
      include: { product: true },
    });
    const byProduct = new Map<number, { product: typeof items[0]['product']; quantity: number }>();
    for (const item of items) {
      const existing = byProduct.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        byProduct.set(item.productId, { product: item.product, quantity: item.quantity });
      }
    }
    const best = [...byProduct.entries()]
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);
    res.json({ data: best });
  } catch (e) {
    console.error('[reports/best-selling]', e);
    next(e);
  }
});

router.get('/revenue-trends', async (req, res, next) => {
  try {
    const start = req.query.startDate as string;
    const end = req.query.endDate as string;
    const startDate = parseReportDate(start, new Date(0));
    const endDate = parseReportDateEnd(end, new Date());
    const sales = await prisma.saleTransaction.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      orderBy: { createdAt: 'asc' },
    });
    const byDay = new Map<string, number>();
    for (const s of sales) {
      const key = s.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + s.total);
    }
    const trends = [...byDay.entries()].map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date));
    res.json({ data: trends });
  } catch (e) {
    console.error('[reports/revenue-trends]', e);
    next(e);
  }
});

/** Daily units sold for "Sales Volume" chart (by date). */
router.get('/daily-units', async (req, res, next) => {
  try {
    const start = req.query.startDate as string;
    const end = req.query.endDate as string;
    const startDate = parseReportDate(start, new Date(0));
    const endDate = parseReportDateEnd(end, new Date());
    const items = await prisma.saleItem.findMany({
      where: {
        sale: { createdAt: { gte: startDate, lte: endDate } },
      },
      include: { sale: true },
    });
    const byDay = new Map<string, number>();
    for (const item of items) {
      const key = item.sale.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + item.quantity);
    }
    const data = [...byDay.entries()]
      .map(([date, units]) => ({ date, units }))
      .sort((a, b) => a.date.localeCompare(b.date));
    res.json({ data });
  } catch (e) {
    console.error('[reports/daily-units]', e);
    next(e);
  }
});

/** Revenue by product category for "Sales by Category" pie chart. */
router.get('/sales-by-category', async (req, res, next) => {
  try {
    const start = req.query.startDate as string;
    const end = req.query.endDate as string;
    const startDate = parseReportDate(start, new Date(0));
    const endDate = parseReportDateEnd(end, new Date());
    const items = await prisma.saleItem.findMany({
      where: {
        sale: { createdAt: { gte: startDate, lte: endDate } },
      },
      include: { product: true },
    });
    const byCategory = new Map<string, number>();
    for (const item of items) {
      const cat = item.product?.category?.trim() || 'Uncategorized';
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + item.subtotal);
    }
    const total = [...byCategory.values()].reduce((a, b) => a + b, 0);
    const data = [...byCategory.entries()]
      .map(([category, revenue]) => ({
        category,
        revenue,
        percentage: total > 0 ? Math.round((revenue / total) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
    res.json({ data });
  } catch (e) {
    console.error('[reports/sales-by-category]', e);
    next(e);
  }
});

export const reportsRouter = router;
