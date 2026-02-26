export async function createInventoryMovement(prisma, opts) {
    return prisma.inventoryMovement.create({
        data: {
            productId: opts.productId,
            type: opts.type,
            quantity: opts.quantity,
            userId: opts.userId ?? null,
            notes: opts.notes ?? null,
        },
    });
}
