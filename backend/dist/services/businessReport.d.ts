import { PrismaClient } from '@prisma/client';
export type InsightImpact = 'High' | 'Medium' | 'Low';
export type BusinessReport = {
    analysisPeriod: {
        startDate: string;
        endDate: string;
    };
    stats: {
        daysOfInventory: number;
        avgDailyDemand: number;
        stockValue: number;
        activeRecommendations: number;
    };
    insights: Array<{
        title: string;
        text: string;
        impact: InsightImpact;
        confidence: number;
    }>;
    forecast: {
        expectedSalesVolume: number;
        salesVolumeChangePercent: number;
        projectedRevenue: number;
        revenueChangePercent: number;
        reorderRequirementsCount: number;
    };
    recommendations: Array<{
        title: string;
        description: string;
    }>;
};
export declare function buildBusinessReport(prisma: PrismaClient, startDate?: string, endDate?: string): Promise<BusinessReport>;
