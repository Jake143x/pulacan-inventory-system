import { runDemandPrediction } from './aiAnalytics.js';
import { createNotificationForAdmins } from './notifications.js';
import { evaluateRiskAndNotify } from './riskNotifications.js';
import { prisma } from '../lib/prisma.js';

const DAILY_MS = 24 * 60 * 60 * 1000;
const RISK_CHECK_MS = 15 * 60 * 1000; // 15 minutes
const INITIAL_DELAY_MS = 60 * 1000; // Run first time 1 minute after server start

/**
 * Run the AI demand-prediction algorithm and notify all admins with a summary.
 * Used by the daily scheduled job and can be called manually.
 */
export async function runScheduledAIAndNotify(): Promise<void> {
  try {
    const predictions = await runDemandPrediction(prisma, 7);
    const highRisk = predictions.filter((p) => p.riskOfStockout === 'HIGH');
    const needReorder = predictions.filter((p) => p.suggestedRestock > 0);
    const title = 'Daily demand forecast';
    const message =
      highRisk.length > 0 || needReorder.length > 0
        ? `AI algorithm: ${highRisk.length} item(s) at high risk of stockout, ${needReorder.length} suggested for reorder. Check Reports or Assistant: "What should I reorder?" or "Which items are low stock?"`
        : `Daily demand forecast completed. No reorder needed right now. Ask Assistant for "Demand forecast" or "Sales forecast" anytime.`;
    await createNotificationForAdmins(prisma, title, message, 'DEMAND_FORECAST');
  } catch (e) {
    console.error('Scheduled AI run failed:', e);
  }
}

/** Run risk evaluation and create notifications only when risk level changes. */
async function runScheduledRiskCheck(): Promise<void> {
  try {
    await evaluateRiskAndNotify(prisma);
  } catch (e) {
    console.error('Scheduled risk check failed:', e);
  }
}

export function startScheduledAI(): void {
  setTimeout(() => {
    runScheduledAIAndNotify();
    setInterval(runScheduledAIAndNotify, DAILY_MS);
  }, INITIAL_DELAY_MS);
  setTimeout(() => {
    runScheduledRiskCheck();
    setInterval(runScheduledRiskCheck, RISK_CHECK_MS);
  }, INITIAL_DELAY_MS + 10 * 1000);
}
