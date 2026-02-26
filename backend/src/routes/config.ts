import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const GCASH_QR_KEY = 'GCASH_QR_URL';

/** Public: used by customer app to show GCash QR when customer selects GCash payment. */
router.get('/public', async (_req, res, next) => {
  try {
    const row = await prisma.systemConfig.findUnique({
      where: { key: GCASH_QR_KEY },
    });
    const gcashQrUrl = row?.value?.trim() || null;
    res.json({ gcashQrUrl });
  } catch (e) {
    next(e);
  }
});

router.use(authenticate);
router.use(requireRoles('OWNER', 'ADMIN'));

router.get('/', async (_req, res, next) => {
  try {
    const configs = await prisma.systemConfig.findMany();
    const map: Record<string, string> = {};
    for (const c of configs) map[c.key] = c.value;
    res.json(map);
  } catch (e) {
    next(e);
  }
});

router.put(
  '/',
  body().isObject(),
  body('LOW_STOCK_THRESHOLD').optional().isString(),
  body(GCASH_QR_KEY).optional().isString(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, 'Invalid config');
      const updates = req.body as Record<string, string>;
      for (const [key, value] of Object.entries(updates)) {
        if (typeof value !== 'string') continue;
        await prisma.systemConfig.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }
      const configs = await prisma.systemConfig.findMany();
      const map: Record<string, string> = {};
      for (const c of configs) map[c.key] = c.value;
      res.json(map);
    } catch (e) {
      next(e);
    }
  }
);

export const configRouter = router;
