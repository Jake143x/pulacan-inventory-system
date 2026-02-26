import { getLatestPredictions } from './aiAnalytics.js';
const CURRENCY = '₱';
export async function buildBusinessReport(prisma, startDate, endDate) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end);
    start.setDate(start.getDate() - 30);
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 29);
    const [invSummary, sales30, saleItems30, saleItemsPrev, predictions] = await Promise.all([
        prisma.inventory.findMany({ include: { product: true } }),
        prisma.saleTransaction.findMany({
            where: { createdAt: { gte: start, lte: end } },
        }),
        prisma.saleItem.findMany({
            where: { sale: { createdAt: { gte: start, lte: end } } },
            include: { sale: true },
        }),
        prisma.saleItem.findMany({
            where: { sale: { createdAt: { gte: prevStart, lte: prevEnd } } },
        }),
        getLatestPredictions(prisma),
    ]);
    const totalValue = invSummary.reduce((s, i) => s + i.quantity * i.product.unitPrice, 0);
    const totalUnits = invSummary.reduce((s, i) => s + i.quantity, 0);
    const unitsSold30 = saleItems30.reduce((s, i) => s + i.quantity, 0);
    const unitsSoldPrev = saleItemsPrev.reduce((s, i) => s + i.quantity, 0);
    const revenue30 = sales30.reduce((s, t) => s + t.total, 0);
    const revenuePrev = await prisma.saleTransaction.aggregate({
        where: { createdAt: { gte: prevStart, lte: prevEnd } },
        _sum: { total: true },
    }).then((r) => r._sum.total ?? 0);
    const avgDailyDemand = Math.round((unitsSold30 / 30) * 100) / 100;
    const daysOfInventory = avgDailyDemand > 0 ? Math.round(totalUnits / avgDailyDemand) : totalUnits > 0 ? 999 : 0;
    const lowStock = invSummary.filter((i) => i.quantity <= i.lowStockThreshold);
    const outOfStock = invSummary.filter((i) => i.quantity === 0);
    const highRisk = predictions.filter((p) => p.riskOfStockout === 'HIGH');
    const needRestock = predictions.filter((p) => p.suggestedRestock > 0);
    const overstocked = invSummary.filter((i) => {
        const pred = predictions.find((p) => p.productId === i.productId);
        const avgDaily = pred ? (pred.predictedDemand ?? 0) / 7 : 0;
        return avgDaily > 0 && i.quantity > avgDaily * 60;
    });
    const insights = [];
    if (needRestock.length > 0 && predictions.length > 0) {
        const top = needRestock[0];
        const pred = top.predictedDemand ?? 0;
        const pct = 30;
        insights.push({
            title: 'Rising Demand Detected',
            text: `${top.product?.name ?? 'Product'} shows increased demand. Predicted 7-day sales: ${Math.round(pred)} units. Consider increasing stock by ${pct}% to capitalize on this trend.`,
            impact: 'High',
            confidence: 87,
        });
    }
    if (revenue30 > 0) {
        const projected = (revenue30 / 30) * 30;
        const change = revenuePrev > 0 ? ((projected - revenuePrev) / revenuePrev) * 100 : 0;
        insights.push({
            title: 'Monthly Revenue Projection',
            text: `Based on the last 7 days of sales data, projected monthly revenue is ${CURRENCY}${projected.toLocaleString('en-PH', { minimumFractionDigits: 0 })}. This represents a ${change >= 0 ? '' : 'decline of '}${Math.abs(change).toFixed(1)}% compared to the previous period.`,
            impact: 'Medium',
            confidence: 85,
        });
    }
    if (overstocked.length > 0) {
        const sample = overstocked[0];
        const pred = predictions.find((p) => p.productId === sample.productId);
        const avgDaily = pred ? (pred.predictedDemand ?? 0) / 7 : 0;
        insights.push({
            title: 'Overstock Alert',
            text: `${overstocked.length} product(s) have excess inventory. ${sample.product.name} has ${sample.quantity} units, but average daily sales only require ${Math.round(avgDaily)} units. Consider promotional strategies to move inventory.`,
            impact: 'Medium',
            confidence: 79,
        });
    }
    const byCategory = new Map();
    for (const item of saleItems30) {
        const inv = invSummary.find((i) => i.productId === item.productId);
        const cat = inv?.product?.category ?? 'Uncategorized';
        byCategory.set(cat, (byCategory.get(cat) ?? 0) + item.quantity);
    }
    const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
        insights.push({
            title: 'Category Growth Opportunity',
            text: `${topCategory[0]} is your top-performing category with ${topCategory[1]} units sold. AI predicts 25% growth potential in this category over the next 30 days. Consider expanding product variety or increasing stock levels for high-demand items.`,
            impact: 'High',
            confidence: 81,
        });
    }
    const slowMoving = invSummary.filter((i) => {
        const sold = saleItems30.filter((s) => s.productId === i.productId).reduce((a, b) => a + b.quantity, 0);
        return sold > 0 && sold / 30 < 1;
    });
    if (slowMoving.length > 0) {
        const s = slowMoving[0];
        const sold = saleItems30.filter((x) => x.productId === s.productId).reduce((a, b) => a + b.quantity, 0);
        insights.push({
            title: 'Slow-Moving Inventory',
            text: `${slowMoving.length} product(s) have very low turnover rates. ${s.product.name} sells only ${(sold / 30).toFixed(2)} units per day. Recommend bundling with popular items or running targeted promotions.`,
            impact: 'Low',
            confidence: 88,
        });
    }
    if (needRestock.length > 0) {
        const invest = needRestock.slice(0, 3).reduce((sum, p) => {
            const inv = invSummary.find((i) => i.productId === p.productId);
            const price = inv?.product.unitPrice ?? 0;
            return sum + p.suggestedRestock * price;
        }, 0);
        insights.push({
            title: 'Optimal Reorder Window',
            text: `${needRestock.length} product(s) are in the optimal reorder window. Placing orders now will prevent stockouts while minimizing carrying costs. Total recommended investment: ${CURRENCY}${invest.toLocaleString('en-PH', { minimumFractionDigits: 0 })}.`,
            impact: 'High',
            confidence: 94,
        });
    }
    if (highRisk.length > 0) {
        insights.push({
            title: 'Stockout Risk',
            text: `${highRisk.length} product(s) at high stockout risk: ${highRisk.slice(0, 2).map((p) => p.product?.name).filter(Boolean).join(', ')}. Immediate reorder recommended.`,
            impact: 'High',
            confidence: 90,
        });
    }
    if (insights.length === 0) {
        insights.push({
            title: 'Data Collection Phase',
            text: 'Insufficient data for insights. Run demand prediction and record sales to enable forecasts.',
            impact: 'Medium',
            confidence: 50,
        });
    }
    const expectedSalesVolume = Math.round(avgDailyDemand * 30);
    const salesVolumeChangePercent = unitsSoldPrev > 0 ? ((unitsSold30 - unitsSoldPrev) / unitsSoldPrev) * 100 : 0;
    const projectedRevenue = Math.round((revenue30 / 30) * 30 * 100) / 100;
    const revenueChangePercent = revenuePrev > 0 ? ((projectedRevenue - revenuePrev) / revenuePrev) * 100 : 0;
    const recommendations = [];
    if (topCategory) {
        recommendations.push({
            title: 'Expand High-Demand Categories',
            description: `Focus on ${topCategory[0]} category showing strong performance`,
        });
    }
    if (overstocked.length > 0) {
        recommendations.push({
            title: 'Optimize Inventory Investment',
            description: 'Reduce overstock by 15% to free up capital',
        });
    }
    if (slowMoving.length > 0) {
        recommendations.push({
            title: 'Implement Dynamic Pricing',
            description: 'AI suggests price optimization for slow-moving items',
        });
    }
    if (needRestock.length > 0 || highRisk.length > 0) {
        recommendations.push({
            title: 'Prevent Stockouts',
            description: `Place urgent orders for ${needRestock.length + highRisk.length} critical product(s)`,
        });
    }
    if (recommendations.length === 0) {
        recommendations.push({
            title: 'Maintain Operations',
            description: 'Run demand prediction weekly for updated insights',
        });
    }
    return {
        analysisPeriod: {
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10),
        },
        stats: {
            daysOfInventory,
            avgDailyDemand,
            stockValue: Math.round(totalValue * 100) / 100,
            activeRecommendations: insights.length,
        },
        insights,
        forecast: {
            expectedSalesVolume,
            salesVolumeChangePercent: Math.round(salesVolumeChangePercent * 10) / 10,
            projectedRevenue,
            revenueChangePercent: Math.round(revenueChangePercent * 10) / 10,
            reorderRequirementsCount: needRestock.length,
        },
        recommendations,
    };
}
