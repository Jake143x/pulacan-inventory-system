import { PrismaClient } from '@prisma/client';

export type RiskLevel = 'Out of Stock' | 'Critical' | 'Low' | 'Safe' | 'No Data' | 'Overstock';

/** Compute current risk level for one inventory item (matches frontend Predicted Inventory Risks logic). */
export function computeRiskLevel(
  quantity: number,
  avgDailyUnits: number,
  reorderQuantity: number
): RiskLevel {
  if (quantity === 0) return 'Out of Stock';
  if (quantity > reorderQuantity) return 'Overstock';
  if (avgDailyUnits === 0) return 'No Data';
  const daysLeft = Math.floor(quantity / avgDailyUnits);
  if (daysLeft < 7) return 'Critical';
  if (daysLeft <= 14) return 'Low';
  return 'Safe';
}

/** Returns true if we should create a notification when transitioning from previousRisk to currentRisk. */
export function shouldNotifyRiskChange(previousRisk: RiskLevel | null, currentRisk: RiskLevel): boolean {
  if (previousRisk === currentRisk) return false;
  if (previousRisk === null) {
    return currentRisk !== 'Safe';
  }
  if (currentRisk === 'Out of Stock') return true;
  if (currentRisk === 'Critical' && (previousRisk === 'Safe' || previousRisk === 'Low')) return true;
  if (currentRisk === 'Low' && previousRisk === 'Safe') return true;
  if (currentRisk === 'Overstock') return true;
  if (currentRisk === 'No Data') return true;
  return false;
}

export function riskToNotificationType(risk: RiskLevel): string {
  if (risk === 'Out of Stock') return 'OutOfStock';
  if (risk === 'Critical') return 'Critical';
  if (risk === 'Low') return 'Low';
  if (risk === 'Overstock') return 'Overstock';
  if (risk === 'No Data') return 'NoData';
  return 'Safe';
}

/** Build short message for notification. */
export function riskMessage(productName: string, risk: RiskLevel): string {
  switch (risk) {
    case 'Out of Stock':
      return `${productName} is out of stock.`;
    case 'Critical':
      return `${productName}: less than 7 days of stock left.`;
    case 'Low':
      return `${productName}: low stock (7–14 days).`;
    case 'Overstock':
      return `${productName} is overstocked.`;
    case 'No Data':
      return `${productName}: no sales in 30+ days.`;
    default:
      return `${productName}: ${risk}.`;
  }
}

/** Evaluate all products, update snapshots, and create notifications only when risk changes. */
export async function evaluateRiskAndNotify(prisma: PrismaClient): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const inv = await prisma.inventory.findMany({
    include: { product: true },
  });
  const soldByProduct = await prisma.saleItem.groupBy({
    by: ['productId'],
    _sum: { quantity: true },
    where: { sale: { createdAt: { gte: thirtyDaysAgo } } },
  });
  const soldMap = new Map(soldByProduct.map((s) => [s.productId, s._sum.quantity ?? 0]));

  const adminUsers = await prisma.user.findMany({
    where: { role: { name: { in: ['ADMIN', 'OWNER'] } }, isActive: true },
    select: { id: true },
  });

  for (const i of inv) {
    const sold = soldMap.get(i.productId) ?? 0;
    const avgDaily = sold / 30;
    const reorderQty = i.reorderQuantity ?? 100;
    const currentRisk = computeRiskLevel(i.quantity, avgDaily, reorderQty);

    const snapshot = await prisma.productRiskSnapshot.findUnique({
      where: { productId: i.productId },
    });
    const previousRisk: RiskLevel | null = snapshot ? (snapshot.riskLevel as RiskLevel) : null;

    if (!shouldNotifyRiskChange(previousRisk, currentRisk)) {
      await upsertSnapshot(prisma, i.productId, currentRisk);
      continue;
    }

    const type = riskToNotificationType(currentRisk);
    const message = riskMessage(i.product.name, currentRisk);
    const title = `${currentRisk}: ${i.product.name}`;

    for (const u of adminUsers) {
      await prisma.notification.create({
        data: {
          userId: u.id,
          productId: i.productId,
          title,
          message,
          type,
          riskLevel: currentRisk,
        },
      });
    }

    await upsertSnapshot(prisma, i.productId, currentRisk);
  }
}

async function upsertSnapshot(prisma: PrismaClient, productId: number, riskLevel: string): Promise<void> {
  await prisma.productRiskSnapshot.upsert({
    where: { productId },
    create: { productId, riskLevel },
    update: { riskLevel },
  });
}
