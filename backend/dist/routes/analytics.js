import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { prisma } from '../lib/prisma.js';
const router = Router();
const DEFAULT_LEAD_DAYS = 7;
const FORECAST_HORIZON_DAYS = 30;
router.use(authenticate);
router.use(requireRoles('OWNER', 'ADMIN'));
function parseDate(value, fallback) {
    if (!value || typeof value !== 'string')
        return fallback;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? fallback : d;
}
function endOfDay(d) {
    const out = new Date(d);
    out.setUTCHours(23, 59, 59, 999);
    return out;
}
/** Get daily revenue totals for date range (from DB). */
async function getDailyRevenue(start, end) {
    const sales = await prisma.saleTransaction.findMany({
        where: { createdAt: { gte: start, lte: endOfDay(end) } },
        select: { createdAt: true, total: true },
    });
    const byDay = new Map();
    for (const s of sales) {
        const key = s.createdAt.toISOString().slice(0, 10);
        byDay.set(key, (byDay.get(key) ?? 0) + s.total);
    }
    const result = [];
    const curr = new Date(start);
    while (curr <= end) {
        const key = curr.toISOString().slice(0, 10);
        result.push({ date: key, revenue: byDay.get(key) ?? 0 });
        curr.setDate(curr.getDate() + 1);
    }
    return result.sort((a, b) => a.date.localeCompare(b.date));
}
/** Simple linear regression slope for trend. */
function linearTrend(data) {
    const n = data.length;
    if (n < 2)
        return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += data[i];
        sumXY += i * data[i];
        sumX2 += i * i;
    }
    const denom = n * sumX2 - sumX * sumX;
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}
/** Forecast next N days using average of last period + optional trend. */
function forecastRevenue(historical, days) {
    if (historical.length === 0)
        return 0;
    const values = historical.map((d) => d.revenue);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const trend = linearTrend(values);
    let total = 0;
    for (let i = 0; i < days; i++) {
        total += Math.max(0, avg + trend * (values.length + i));
    }
    return total;
}
/** Forecast summary: 7d revenue, 30d revenue, growth %, predicted stock-out count. */
router.get('/forecast-summary', async (_req, res, next) => {
    try {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 60);
        const daily = await getDailyRevenue(start, end);
        const last30 = daily.slice(-30);
        const prev30 = daily.slice(-60, -30);
        const pred7 = forecastRevenue(last30, 7);
        const pred30 = forecastRevenue(last30, 30);
        const actualPrev30 = prev30.reduce((s, d) => s + d.revenue, 0);
        const growthPct = actualPrev30 > 0 ? ((pred30 - actualPrev30) / actualPrev30) * 100 : (pred30 > 0 ? 100 : 0);
        const inv = await prisma.inventory.findMany({ include: { product: true } });
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const soldByProduct = await prisma.saleItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true },
            where: { sale: { createdAt: { gte: thirtyDaysAgo } } },
        });
        const soldMap = new Map(soldByProduct.map((s) => [s.productId, s._sum.quantity ?? 0]));
        let stockOutCount = 0;
        for (const i of inv) {
            const sold = soldMap.get(i.productId) ?? 0;
            const avgDaily = sold / 30;
            if (avgDaily <= 0)
                continue;
            const daysLeft = i.quantity / avgDaily;
            if (daysLeft < DEFAULT_LEAD_DAYS || i.quantity === 0)
                stockOutCount++;
        }
        res.json({
            predictedRevenue7d: Math.round(pred7 * 100) / 100,
            predictedRevenue30d: Math.round(pred30 * 100) / 100,
            predictedSalesGrowthPct: Math.round(growthPct * 10) / 10,
            predictedStockOutCount: stockOutCount,
            previousPeriodRevenue: actualPrev30,
        });
    }
    catch (e) {
        next(e);
    }
});
/** Sales forecast chart: historical + forecasted series. range=30|90|custom + startDate/endDate for custom. */
router.get('/sales-forecast', async (req, res, next) => {
    try {
        const range = req.query.range || '30';
        let start;
        const end = new Date();
        if (range === '90') {
            start = new Date();
            start.setDate(start.getDate() - 90);
        }
        else if (range === 'custom') {
            const startStr = req.query.startDate;
            const endStr = req.query.endDate;
            start = parseDate(startStr, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
            const endParsed = parseDate(endStr, end);
            if (endParsed < end)
                end.setTime(endParsed.getTime());
        }
        else {
            start = new Date();
            start.setDate(start.getDate() - 30);
        }
        const historical = await getDailyRevenue(start, end);
        const values = historical.map((d) => d.revenue);
        const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        const trend = linearTrend(values);
        const lastDate = historical.length ? historical[historical.length - 1].date : end.toISOString().slice(0, 10);
        const forecasted = [];
        for (let i = 1; i <= FORECAST_HORIZON_DAYS; i++) {
            const d = new Date(lastDate);
            d.setDate(d.getDate() + i);
            const key = d.toISOString().slice(0, 10);
            forecasted.push({
                date: key,
                revenue: Math.max(0, avg + trend * (values.length + i - 1)),
                forecast: true,
            });
        }
        const combined = [
            ...historical.map((d) => ({ ...d, forecast: false })),
            ...forecasted,
        ];
        res.json({
            data: combined,
            historicalCount: historical.length,
        });
    }
    catch (e) {
        next(e);
    }
});
/** Stock depletion: avg daily sales, days left, risk level per product. */
router.get('/stock-depletion', async (_req, res, next) => {
    try {
        const inv = await prisma.inventory.findMany({ include: { product: true } });
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const soldByProduct = await prisma.saleItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true },
            where: { sale: { createdAt: { gte: thirtyDaysAgo } } },
        });
        const soldMap = new Map(soldByProduct.map((s) => [s.productId, s._sum.quantity ?? 0]));
        const result = inv.map((i) => {
            const sold = soldMap.get(i.productId) ?? 0;
            const avgDaily = sold / 30;
            const daysLeft = avgDaily > 0 ? i.quantity / avgDaily : (i.quantity > 0 ? 999 : 0);
            let riskLevel = 'Safe';
            if (i.quantity === 0 || daysLeft < 0)
                riskLevel = 'Critical';
            else if (daysLeft < 7)
                riskLevel = 'Critical';
            else if (daysLeft < 14)
                riskLevel = 'Low';
            return {
                productId: i.productId,
                productName: i.product.name,
                currentQuantity: i.quantity,
                avgDailySales: Math.round(avgDaily * 100) / 100,
                estimatedDaysLeft: daysLeft === 999 ? null : Math.round(daysLeft * 10) / 10,
                riskLevel,
            };
        });
        res.json({ data: result.sort((a, b) => (a.estimatedDaysLeft ?? 0) - (b.estimatedDaysLeft ?? 0)) });
    }
    catch (e) {
        next(e);
    }
});
/** Reorder recommendations for at-risk products. */
router.get('/reorder-recommendations', async (_req, res, next) => {
    try {
        const inv = await prisma.inventory.findMany({ include: { product: true } });
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const soldByProduct = await prisma.saleItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true },
            where: { sale: { createdAt: { gte: thirtyDaysAgo } } },
        });
        const soldMap = new Map(soldByProduct.map((s) => [s.productId, s._sum.quantity ?? 0]));
        const result = [];
        for (const i of inv) {
            const sold = soldMap.get(i.productId) ?? 0;
            const avgDaily = sold / 30;
            const daysLeft = avgDaily > 0 ? i.quantity / avgDaily : 999;
            if (daysLeft >= 14 && i.quantity > 0)
                continue;
            const suggested = Math.ceil(avgDaily * (DEFAULT_LEAD_DAYS + 7)) || i.reorderQuantity;
            const timeframe = daysLeft < 0 || i.quantity === 0 ? 'Immediately' : daysLeft < 7 ? 'Within 3 days' : 'Within 1 week';
            const reason = avgDaily > 0
                ? `Sales velocity: ${avgDaily.toFixed(1)} units/day. Stock lasting ${daysLeft < 0 ? '0' : daysLeft.toFixed(0)} days.`
                : 'Low/no recent sales; reorder to meet reorder level.';
            result.push({
                productId: i.productId,
                productName: i.product.name,
                suggestedReorderQuantity: Math.max(suggested, i.reorderQuantity),
                recommendedTimeframe: timeframe,
                reason,
            });
        }
        res.json({ data: result });
    }
    catch (e) {
        next(e);
    }
});
/** Slow moving / dead stock: products not sold in last 30 or 60 days. */
router.get('/slow-moving', async (req, res, next) => {
    try {
        const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
        const since = new Date();
        since.setDate(since.getDate() - days);
        const itemsWithSale = await prisma.saleItem.findMany({
            where: { sale: { createdAt: { gte: new Date(0) } } },
            select: { productId: true, sale: { select: { createdAt: true } } },
        });
        const lastSaleByProduct = new Map();
        for (const s of itemsWithSale) {
            const existing = lastSaleByProduct.get(s.productId);
            if (!existing || s.sale.createdAt > existing) {
                lastSaleByProduct.set(s.productId, s.sale.createdAt);
            }
        }
        const soldInPeriodIds = new Set((await prisma.saleItem.findMany({
            where: { sale: { createdAt: { gte: since } } },
            select: { productId: true },
            distinct: ['productId'],
        })).map((s) => s.productId));
        const inv = await prisma.inventory.findMany({ include: { product: true } });
        const now = Date.now();
        const result = inv
            .filter((i) => !soldInPeriodIds.has(i.productId))
            .map((i) => {
            const lastSale = lastSaleByProduct.get(i.productId);
            const daysSince = lastSale ? Math.floor((now - lastSale.getTime()) / 86400000) : days;
            return {
                productId: i.productId,
                productName: i.product.name,
                daysSinceLastSale: daysSince,
                currentQuantity: i.quantity,
            };
        });
        res.json({ data: result, days });
    }
    catch (e) {
        next(e);
    }
});
export const analyticsRouter = router;
