export async function createNotification(prisma, userId, title, message, type, opts) {
    return prisma.notification.create({
        data: { userId, title, message, type, productId: opts?.productId, riskLevel: opts?.riskLevel },
    });
}
/** Create the same notification for all ADMIN and OWNER users (e.g. low stock, demand forecast). */
export async function createNotificationForAdmins(prisma, title, message, type) {
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
export async function createNotificationForCashiers(prisma, title, message, type) {
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
