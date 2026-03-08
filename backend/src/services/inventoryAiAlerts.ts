import { PrismaClient } from '@prisma/client';

const DAYS_LOOKBACK = 30;
const DAYS_FORECAST = 7;
const REORDER_MULTIPLIER = 2;

/**
 * Get total quantity sold per product in the last 30 days (POS SaleItem + approved OnlineOrder OrderItem).
 */
async function getSalesLast30Days(prisma: PrismaClient): Promise<Map<number, number>> {
  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - DAYS_LOOKBACK);

  const [saleItems, orderItems] = await Promise.all([
    prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: periodStart, lte: periodEnd } } },
      select: { productId: true, quantity: true },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: 'APPROVED',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      },
      select: { productId: true, quantity: true },
    }),
  ]);

  const byProduct = new Map<number, number>();
  for (const item of saleItems) {
    byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
  }
  for (const item of orderItems) {
    byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
  }
  return byProduct;
}

/**
 * Run AI stock check: compute average daily sales, predicted 7-day demand, and create/update
 * inventory_ai_alerts when current_stock < predicted_demand.
 * Works for piece, kg, and meter (quantities are floats).
 */
export async function runInventoryAiStockCheck(prisma: PrismaClient): Promise<{ alertsCreated: number; alertsUpdated: number }> {
  const salesByProduct = await getSalesLast30Days(prisma);
  const products = await prisma.product.findMany({
    where: { status: 'active' },
    include: { inventory: true, supplier: true },
  });

  const defaultSupplier = await prisma.supplier.findFirst({ orderBy: { id: 'asc' } });

  let alertsCreated = 0;
  let alertsUpdated = 0;

  for (const product of products) {
    const totalSold30 = salesByProduct.get(product.id) ?? 0;
    const averageDailySales = totalSold30 / DAYS_LOOKBACK;
    const predictedDemand = Math.round(averageDailySales * DAYS_FORECAST * 100) / 100;
    const suggestedReorder = Math.round(predictedDemand * REORDER_MULTIPLIER * 100) / 100;
    const currentStock = product.inventory?.quantity ?? 0;

    if (currentStock >= predictedDemand) continue;
    if (predictedDemand <= 0 && currentStock > 0) continue;

    const supplierId = product.supplierId ?? defaultSupplier?.id ?? null;

    const existing = await prisma.inventoryAiAlert.findFirst({
      where: { productId: product.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await prisma.inventoryAiAlert.update({
        where: { id: existing.id },
        data: {
          productName: product.name,
          currentStock,
          predictedDemand,
          suggestedReorder,
          supplierId,
          updatedAt: new Date(),
        },
      });
      alertsUpdated++;
    } else {
      await prisma.inventoryAiAlert.create({
        data: {
          productId: product.id,
          productName: product.name,
          currentStock,
          predictedDemand,
          suggestedReorder,
          supplierId,
          status: 'active',
        },
      });
      alertsCreated++;
    }
  }

  return { alertsCreated, alertsUpdated };
}

/**
 * Generate supplier email body for a purchase order (template).
 */
export function getPurchaseOrderEmailTemplate(params: {
  productName: string;
  quantity: number;
  unitType: string;
  supplierName?: string;
}): { subject: string; body: string } {
  const unitLabel = params.unitType === 'piece' ? 'pcs' : params.unitType === 'kg' ? 'kg' : 'meters';
  const subject = 'Purchase Order Request';
  const body = `Subject: ${subject}

Product: ${params.productName}
Requested Quantity: ${params.quantity} ${unitLabel}${params.supplierName ? `\nSupplier: ${params.supplierName}` : ''}

Please confirm availability for restocking.`;
  return { subject, body };
}
