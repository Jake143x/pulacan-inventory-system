import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { AppError } from '../middleware/errorHandler.js';
import { runDemandPrediction, getLatestPredictions } from '../services/aiAnalytics.js';
import { chat } from '../services/chatbot.js';
import { buildBusinessReport } from '../services/businessReport.js';
import { createNotificationForAdmins } from '../services/notifications.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.use(authenticate);

router.post('/predict', requireRoles('OWNER', 'ADMIN'), async (_req, res, next) => {
  try {
    const predictions = await runDemandPrediction(prisma, 7);
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
      const reply = await chat(req.user!.id, message, req.user!.roleName);
      res.json({ reply });
    } catch (e) {
      next(e);
    }
  }
);

export const aiRouter = router;
