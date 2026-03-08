import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { AppError } from '../middleware/errorHandler.js';
import { runDemandPrediction, getLatestPredictions } from '../services/aiAnalytics.js';
import { chat } from '../services/chatbot.js';
import { chatViaPythonAi } from '../services/pythonAiClient.js';
import { buildBusinessReport } from '../services/businessReport.js';
import { createNotificationForAdmins } from '../services/notifications.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const DEFAULT_FORECAST_DAYS = 7;
const MIN_FORECAST_DAYS = 1;
const MAX_FORECAST_DAYS = 365;

function parseForecastDays(queryDays: unknown): number {
  if (queryDays == null || queryDays === '') return DEFAULT_FORECAST_DAYS;
  const n = parseInt(String(queryDays), 10);
  if (Number.isNaN(n) || n < MIN_FORECAST_DAYS) return DEFAULT_FORECAST_DAYS;
  return Math.min(n, MAX_FORECAST_DAYS);
}

/** Internal forecast for AI service: no auth if X-AI-Service-Key matches AI_SERVICE_KEY. */
router.get('/forecast/internal', async (req, res, next) => {
  try {
    const key = process.env.AI_SERVICE_KEY;
    const provided = req.headers['x-ai-service-key'] as string | undefined;
    if (!key || provided !== key) {
      res.status(401).json({ error: 'Unauthorized: valid X-AI-Service-Key required' });
      return;
    }
    const days = parseForecastDays(req.query.days);
    await runDemandPrediction(prisma, days);
    const data = await getLatestPredictions(prisma, { includeInventory: true });
    res.json({ data, forecastRangeDays: days });
  } catch (e) {
    next(e);
  }
});

router.use(authenticate);

router.post('/predict', requireRoles('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const days = parseForecastDays(req.body?.days ?? req.query.days) || DEFAULT_FORECAST_DAYS;
    const predictions = await runDemandPrediction(prisma, days);
    const highRisk = predictions.filter((p) => p.riskOfStockout === 'HIGH');
    const needReorder = predictions.filter((p) => p.suggestedRestock > 0);
    const title = 'Demand forecast updated';
    const message =
      highRisk.length > 0 || needReorder.length > 0
        ? `AI algorithm run complete: ${highRisk.length} item(s) at high risk of stockout, ${needReorder.length} suggested for reorder. Check Reports or ask the Assistant: "What should I reorder?" or "Which items are low stock?"`
        : `Demand forecast updated. No reorder needed right now. Ask the Assistant for "Demand forecast" or "Sales forecast" anytime.`;
    await createNotificationForAdmins(prisma, title, message, 'DEMAND_FORECAST');
    res.json({ message: 'Predictions generated', data: predictions });
  } catch (e) {
    next(e);
  }
});

/** GET /api/ai/forecast?days=N — Run demand prediction for N days and return results with product name, predicted demand, current stock, reorder recommendation. */
router.get('/forecast', requireRoles('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const days = parseForecastDays(req.query.days);
    await runDemandPrediction(prisma, days);
    const data = await getLatestPredictions(prisma, { includeInventory: true });
    res.json({ data, forecastRangeDays: days });
  } catch (e) {
    next(e);
  }
});

router.get('/predictions', requireRoles('OWNER', 'ADMIN'), async (_req, res, next) => {
  try {
    const data = await getLatestPredictions(prisma);
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

router.get('/business-report', requireRoles('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const report = await buildBusinessReport(prisma, startDate, endDate);
    res.json(report);
  } catch (e) {
    next(e);
  }
});

router.post(
  '/chat',
  body('message').trim().notEmpty(),
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, 'Message is required');
      const message = req.body.message as string;
      const pythonReply = await chatViaPythonAi(message);
      const reply =
        pythonReply != null
          ? pythonReply
          : await chat(req.user!.id, message, req.user!.roleName);
      res.json({ reply });
    } catch (e) {
      next(e);
    }
  }
);

export const aiRouter = router;
