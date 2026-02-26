import { PrismaClient } from '@prisma/client';

export async function createNotification(
  prisma: PrismaClient,
  userId: number,
  title: string,
  message: string,
  type: string,
  opts?: { productId?: number; riskLevel?: string }
) {
  return prisma.notification.create({
    data: { userId, title, message, type, productId: opts?.productId, riskLevel: opts?.riskLevel },
  });
}

/** Create the same notification for all ADMIN and OWNER users (e.g. low stock, demand forecast). */
export async function createNotificationForAdmins(
  prisma: PrismaClient,
  title: string,
  message: string,
  type: string
) {
  const adminUsers = await prisma.user.findMany({
    where: { role: { name: { in: ['ADMIN', 'OWNER'] } }, isActive: true },
    select: { id: true },
  });
  for (const u of adminUsers) {
    await prisma.notification.create({
      data: { userId: u.id, title, message, type },
    });
  }
}

/** Create the same notification for all CASHIER users (e.g. customer inquiry / connect request). */
export async function createNotificationForCashiers(
  prisma: PrismaClient,
  title: string,
  message: string,
  type: string
) {
  const cashiers = await prisma.user.findMany({
    where: { role: { name: 'CASHIER' }, isActive: true },
    select: { id: true },
  });
  for (const u of cashiers) {
    await prisma.notification.create({
      data: { userId: u.id, title, message, type },
    });
  }
}
