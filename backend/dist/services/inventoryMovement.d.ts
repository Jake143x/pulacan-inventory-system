import type { PrismaClient } from '@prisma/client';
export type MovementType = 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';
export declare function createInventoryMovement(prisma: PrismaClient, opts: {
    productId: number;
    type: MovementType;
    quantity: number;
    userId?: number | null;
    notes?: string | null;
}): Promise<{
    id: number;
    createdAt: Date;
    userId: number | null;
    productId: number;
    quantity: number;
    type: string;
    notes: string | null;
}>;
