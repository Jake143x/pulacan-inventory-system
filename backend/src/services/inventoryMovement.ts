import type { PrismaClient } from '@prisma/client';

export type MovementType = 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';

export async function createInventoryMovement(
  prisma: PrismaClient,
  opts: {
    productId: number;
    type: MovementType;
    quantity: number; // positive for IN, negative for OUT, signed for ADJUSTMENT
    userId?: number | null;
    notes?: string | null;
  }
) {
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
