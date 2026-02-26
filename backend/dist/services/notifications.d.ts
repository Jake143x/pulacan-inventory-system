import { PrismaClient } from '@prisma/client';
export declare function createNotification(prisma: PrismaClient, userId: number, title: string, message: string, type: string, opts?: {
    productId?: number;
    riskLevel?: string;
}): Promise<{
    id: number;
    createdAt: Date;
    updatedAt: Date;
    userId: number | null;
    productId: number | null;
    title: string;
    message: string;
    type: string;
    riskLevel: string | null;
    read: boolean;
}>;
/** Create the same notification for all ADMIN and OWNER users (e.g. low stock, demand forecast). */
export declare function createNotificationForAdmins(prisma: PrismaClient, title: string, message: string, type: string): Promise<void>;
/** Create the same notification for all CASHIER users (e.g. customer inquiry / connect request). */
export declare function createNotificationForCashiers(prisma: PrismaClient, title: string, message: string, type: string): Promise<void>;
