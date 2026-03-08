import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { runInventoryAiStockCheck, getPurchaseOrderEmailTemplate } from '../services/inventoryAiAlerts.js';

const router = Router();

router.use(authenticate);
router.use(requireRoles('OWNER', 'ADMIN'));

/** GET /api/inventory-ai/alerts — list active AI inventory alerts (Admin/Owner only). */
router.get('/alerts', async (_req, res, next) => {
  try {
    const alerts = await prisma.inventoryAiAlert.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, unitType: true } },
        supplier: { select: { id: true, name: true, email: true } },
      },
    });
    res.json({ data: alerts });
  } catch (e) {
    next(e);
  }
});

/** GET /api/inventory-ai/analytics — dashboard analytics: products at risk, predicted usage, suggested reorder. */
router.get('/analytics', async (_req, res, next) => {
  try {
    const alerts = await prisma.inventoryAiAlert.findMany({
      where: { status: 'active' },
      include: { product: { select: { unitType: true } }, supplier: { select: { name: true } } },
    });
    const productsAtRisk = alerts.length;
    const totalPredictedUsage = alerts.reduce((s, a) => s + a.predictedDemand, 0);
    const totalSuggestedReorder = alerts.reduce((s, a) => s + a.suggestedReorder, 0);
    res.json({
      productsAtRisk,
      totalPredictedUsage: Math.round(totalPredictedUsage * 100) / 100,
      totalSuggestedReorder: Math.round(totalSuggestedReorder * 100) / 100,
      alerts: alerts.map((a) => ({
        id: a.id,
        productName: a.productName,
        currentStock: a.currentStock,
        predictedDemand: a.predictedDemand,
        suggestedReorder: a.suggestedReorder,
        unitType: a.product?.unitType ?? 'piece',
        supplierName: a.supplier?.name ?? null,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/** POST /api/inventory-ai/run — manually trigger AI stock check (Admin/Owner only). */
router.post('/run', async (_req, res, next) => {
  try {
    const result = await runInventoryAiStockCheck(prisma);
    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
});

/** POST /api/inventory-ai/alerts/:id/generate-po — create purchase order from alert and return email template. */
router.post('/alerts/:id/generate-po', async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) throw new AppError(400, 'Invalid alert id');
    const alert = await prisma.inventoryAiAlert.findUnique({
      where: { id },
      include: { product: true, supplier: true },
    });
    if (!alert) throw new AppError(404, 'Alert not found');
    if (alert.status !== 'active') throw new AppError(400, 'Alert already processed');

    const supplierId = alert.supplierId;
    if (!supplierId) throw new AppError(400, 'No supplier assigned to this product. Add a supplier in Products or create a default supplier.');

    const po = await prisma.purchaseOrder.create({
      data: {
        supplierId,
        productId: alert.productId,
        quantity: alert.suggestedReorder,
        status: 'pending',
      },
      include: { supplier: true, product: true },
    });

    await prisma.inventoryAiAlert.update({
      where: { id },
      data: { status: 'po_generated', updatedAt: new Date() },
    });

    const unitType = alert.product?.unitType ?? 'piece';
    const { subject, body } = getPurchaseOrderEmailTemplate({
      productName: alert.productName,
      quantity: alert.suggestedReorder,
      unitType,
      supplierName: alert.supplier?.name ?? undefined,
    });

    res.status(201).json({
      purchaseOrder: {
        id: po.id,
        supplierId: po.supplierId,
        productId: po.productId,
        quantity: po.quantity,
        status: po.status,
        createdAt: po.createdAt,
        supplier: po.supplier,
        product: po.product,
      },
      emailTemplate: { subject, body },
    });
  } catch (e) {
    next(e);
  }
});

/** GET /api/inventory-ai/suppliers — list suppliers (for dropdown / display). */
router.get('/suppliers', async (_req, res, next) => {
  try {
    const list = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: list });
  } catch (e) {
    next(e);
  }
});

/** POST /api/inventory-ai/suppliers — create supplier (Admin/Owner only). */
router.post(
  '/suppliers',
  body('name').trim().notEmpty(),
  body('email').optional().trim().isEmail(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0]?.msg ?? 'Validation failed' });
      }
      const { name, email, contact } = req.body as { name?: string; email?: string; contact?: string };
      const supplier = await prisma.supplier.create({
        data: {
          name: String(name).trim(),
          email: email ? String(email).trim() || null : null,
          contact: contact ? String(contact).trim() || null : null,
        },
      });
      res.status(201).json(supplier);
    } catch (e) {
      next(e);
    }
  }
);

export const inventoryAiRouter = router;
