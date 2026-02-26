import { PrismaClient } from '@prisma/client';
/**
 * AI simulation: demand prediction based on historical sales.
 * Uses simple moving average and trend to suggest restock and stockout risk.
 */
export declare function runDemandPrediction(prisma: PrismaClient, daysAhead?: number): Promise<{
    productId: number;
    predictedDemand: number;
    suggestedRestock: number;
    riskOfStockout: string;
}[]>;
export declare function getLatestPredictions(prisma: PrismaClient): Promise<({
    product: {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        category: string | null;
        status: string;
        sku: string | null;
        specifications: string | null;
        unitPrice: number;
        imageUrl: string | null;
    };
} & {
    id: number;
    productId: number;
    predictedDemand: number;
    suggestedRestock: number;
    riskOfStockout: string | null;
    generatedAt: Date;
    periodStart: Date;
    periodEnd: Date;
})[]>;
