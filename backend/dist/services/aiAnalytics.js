/**
 * AI simulation: demand prediction based on historical sales.
 * Uses simple moving average and trend to suggest restock and stockout risk.
 */
export async function runDemandPrediction(prisma, daysAhead = 7) {
    const products = await prisma.product.findMany({ include: { inventory: true } });
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30);
    const saleItems = await prisma.saleItem.findMany({
        where: {
            sale: {
                createdAt: { gte: periodStart, lte: periodEnd },
            },
        },
    });
    const dailyByProduct = new Map();
    for (let d = 0; d < 30; d++) {
        const day = new Date(periodStart);
        day.setDate(day.getDate() + d);
        const dayStr = day.toISOString().slice(0, 10);
        for (const item of saleItems) {
            const sale = await prisma.saleTransaction.findFirst({
                where: {
                    id: item.saleId,
                    createdAt: { gte: new Date(dayStr), lt: new Date(dayStr + 'T23:59:59.999Z') },
                },
            });
            if (sale) {
                const arr = dailyByProduct.get(item.productId) ?? [];
                while (arr.length <= d)
                    arr.push(0);
                arr[d] = (arr[d] ?? 0) + item.quantity;
                dailyByProduct.set(item.productId, arr);
            }
        }
    }
    // Simpler: aggregate total sold per product in last 30 days
    const soldByProduct = new Map();
    for (const item of saleItems) {
        soldByProduct.set(item.productId, (soldByProduct.get(item.productId) ?? 0) + item.quantity);
    }
    const predictions = [];
    for (const product of products) {
        const sold30 = soldByProduct.get(product.id) ?? 0;
        const avgDaily = sold30 / 30;
        const predictedDemand = Math.round(avgDaily * daysAhead * 100) / 100;
        const inv = product.inventory;
        const currentStock = inv?.quantity ?? 0;
        const threshold = inv?.lowStockThreshold ?? 10;
        let riskOfStockout = 'LOW';
        if (currentStock < threshold)
            riskOfStockout = 'HIGH';
        else if (currentStock < predictedDemand + threshold)
            riskOfStockout = 'MEDIUM';
        const suggestedRestock = Math.max(0, Math.ceil(predictedDemand + threshold - currentStock));
        predictions.push({
            productId: product.id,
            predictedDemand,
            suggestedRestock,
            riskOfStockout,
        });
    }
    const periodEndDate = new Date();
    periodEndDate.setDate(periodEndDate.getDate() + daysAhead);
    for (const p of predictions) {
        await prisma.aiPrediction.create({
            data: {
                productId: p.productId,
                predictedDemand: p.predictedDemand,
                suggestedRestock: p.suggestedRestock,
                riskOfStockout: p.riskOfStockout,
                periodStart: new Date(periodStart),
                periodEnd: periodEndDate,
            },
        });
    }
    return predictions;
}
export async function getLatestPredictions(prisma) {
    const latest = await prisma.aiPrediction.findMany({
        orderBy: { generatedAt: 'desc' },
        take: 1000,
        include: { product: true },
    });
    const byProduct = new Map();
    for (const p of latest) {
        if (!byProduct.has(p.productId))
            byProduct.set(p.productId, p);
    }
    return [...byProduct.values()];
}
