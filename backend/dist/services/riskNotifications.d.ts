import { PrismaClient } from '@prisma/client';
export type RiskLevel = 'Out of Stock' | 'Critical' | 'Low' | 'Safe' | 'No Data' | 'Overstock';
/** Compute current risk level for one inventory item (matches frontend Predicted Inventory Risks logic). */
export declare function computeRiskLevel(quantity: number, avgDailyUnits: number, reorderQuantity: number): RiskLevel;
/** Returns true if we should create a notification when transitioning from previousRisk to currentRisk. */
export declare function shouldNotifyRiskChange(previousRisk: RiskLevel | null, currentRisk: RiskLevel): boolean;
export declare function riskToNotificationType(risk: RiskLevel): string;
/** Build short message for notification. */
export declare function riskMessage(productName: string, risk: RiskLevel): string;
/** Evaluate all products, update snapshots, and create notifications only when risk changes. */
export declare function evaluateRiskAndNotify(prisma: PrismaClient): Promise<void>;
