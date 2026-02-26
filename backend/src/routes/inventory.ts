import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { AppError } from '../middleware/errorHandler.js';
import { createNotification } from '../services/notifications.js';
import { createInventoryMovement } from '../services/inventoryMovement.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.use(authenticate);
router.use(requireRoles('OWNER', 'ADMIN'));

/** Status: qty > reorderLevel = in stock, 0 < qty <= reorderLevel = low, qty = 0 = out. Overstocked: qty > reorderQuantity. */
function getStatus(inv: { quantity: number; reorderLevel?: number | null; lowStockThreshold?: number }): 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' {
  if (inv.quantity === 0) return 'OUT_OF_STOCK';
  const level = inv.reorderLevel ?? inv.lowStockThreshold ?? 10;
  if (inv.quantity <= level) return 'LOW_STOCK';
  return 'IN_STOCK';
}
function isOverstocked(inv: { quantity: number; reorderQuantity?: number | null }): boolean {
  const rq = inv.reorderQuantity ?? 100;
  return inv.quantity > rq;
}

/** Summary: Total Products, Total Inventory Value, Low Stock, Out of Stock, Overstocked. */
router.get('/summary', async (_req, res, next) => {
  try {
    const all = await prisma.inventory.findMany({ include: { product: true } });
    const totalProducts = all.length;
    const totalValue = all.reduce((sum, i) => sum + i.quantity * i.product.unitPrice, 0);
    const lowStockCount = all.filter((i) => getStatus(i) === 'LOW_STOCK').length;
    const outOfStockCount = all.filter((i) => getStatus(i) === 'OUT_OF_STOCK').length;
    const overstockedCount = all.filter((i) => isOverstocked(i)).length;
    res.json({
      totalProducts,
      totalValue,
      lowStockCount,
      outOfStockCount,
      overstockedCount,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const statusFilter = (req.query.status as string)?.toLowerCase() || '';
    const category = (req.query.category as string)?.trim() || '';
    const search = (req.query.search as string)?.trim()?.toLowerCase() || '';
    const minPrice = req.query.minPrice != null ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice != null ? Number(req.query.maxPrice) : undefined;
    const minQty = req.query.minQty != null ? Number(req.query.minQty) : undefined;
    const maxQty = req.query.maxQty != null ? Number(req.query.maxQty) : undefined;
    const all = await prisma.inventory.findMany({
      include: { product: true },
      orderBy: { quantity: 'asc' },
    });
    let withStatus = all.map((i) => ({ ...i, status: getStatus(i), isOverstocked: isOverstocked(i) }));
    if (category) withStatus = withStatus.filter((i) => i.product.category === category);
    if (search) withStatus = withStatus.filter((i) => (i.product.name?.toLowerCase().includes(search) || i.product.sku?.toLowerCase().includes(search)));
    if (minPrice != null && !Number.isNaN(minPrice)) withStatus = withStatus.filter((i) => i.product.unitPrice >= minPrice);
    if (maxPrice != null && !Number.isNaN(maxPrice)) withStatus = withStatus.filter((i) => i.product.unitPrice <= maxPrice);
    if (minQty != null && !Number.isNaN(minQty)) withStatus = withStatus.filter((i) => i.quantity >= minQty);
    if (maxQty != null && !Number.isNaN(maxQty)) withStatus = withStatus.filter((i) => i.quantity <= maxQty);
    const filtered =
      statusFilter === 'low' || statusFilter === 'low_stock'
        ? withStatus.filter((i) => i.status === 'LOW_STOCK')
        : statusFilter === 'out' || statusFilter === 'out_of_stock'
          ? withStatus.filter((i) => i.status === 'OUT_OF_STOCK')
          : statusFilter === 'in' || statusFilter === 'in_stock'
            ? withStatus.filter((i) => i.status === 'IN_STOCK')
            : withStatus;
    const total = filtered.length;
    const data = filtered.slice(skip, skip + limit);
    res.json({
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      lowStockCount: withStatus.filter((i) => i.status === 'LOW_STOCK').length,
      outOfStockCount: withStatus.filter((i) => i.status === 'OUT_OF_STOCK').length,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/low-stock', async (_req, res, next) => {
  try {
    const items = await prisma.inventory.findMany({
      where: {},
      include: { product: true },
    });
    const low = items.filter((i) => getStatus(i) === 'LOW_STOCK');
    res.json({ data: low });
  } catch (e) {
    next(e);
  }
});

/** Inventory movement ledger: Date, Product, Type, Quantity, User, Notes. */
router.get('/movements', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const type = (req.query.type as string)?.trim() || '';
    const productId = req.query.productId ? Number(req.query.productId) : undefined;
    const where: { type?: string; productId?: number } = {};
    if (type && ['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT'].includes(type)) where.type = type;
    if (productId) where.productId = productId;
    const [rows, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { id: true, name: true, sku: true } }, user: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.inventoryMovement.count({ where }),
    ]);
    res.json({
      data: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/:productId',
  body('quantity').optional().isInt({ min: 0 }),
  body('lowStockThreshold').optional().isInt({ min: 0 }),
  body('reorderLevel').optional().isInt({ min: 0 }),
  body('reorderQuantity').optional().isInt({ min: 0 }),
  body('movementNotes').optional().trim().isString(),
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
      const productId = Number(req.params?.productId);
      if (!productId) throw new AppError(400, 'Invalid product id');
      const { quantity, lowStockThreshold, reorderLevel, reorderQuantity, movementNotes } = req.body;
      const update: Record<string, unknown> = {};
      if (lowStockThreshold !== undefined) update.lowStockThreshold = Number(lowStockThreshold);
      if (reorderLevel !== undefined) update.reorderLevel = Number(reorderLevel);
      if (reorderQuantity !== undefined) update.reorderQuantity = Number(reorderQuantity);
      const before = await prisma.inventory.findUnique({ where: { productId }, include: { product: true } });
      if (!before) throw new AppError(404, 'Inventory not found');
      if (quantity !== undefined) update.quantity = Number(quantity);
      const inv = await prisma.inventory.update({
        where: { productId },
        data: update,
        include: { product: true },
      });
      const qtyDelta = (inv.quantity as number) - before.quantity;
      if (qtyDelta !== 0) {
        const type = qtyDelta > 0 ? 'STOCK_IN' : 'STOCK_OUT';
        await createInventoryMovement(prisma, {
          productId,
          type,
          quantity: qtyDelta,
          userId: req.user?.id ?? undefined,
          notes: movementNotes ?? 'Inventory adjustment',
        });
      }
      const reorderLevelVal = (inv as { reorderLevel?: number }).reorderLevel ?? inv.lowStockThreshold;
      if (getStatus({ ...inv, reorderLevel: reorderLevelVal }) === 'LOW_STOCK') {
        const adminUsers = await prisma.user.findMany({
          where: { role: { name: { in: ['ADMIN', 'OWNER'] } }, isActive: true },
          select: { id: true },
        });
        const title = 'Low stock';
        const message = `${inv.product.name} is low on stock (${inv.quantity} left, reorder level ${reorderLevelVal}). Consider reordering.`;
        for (const u of adminUsers) {
          await createNotification(prisma, u.id, title, message, 'LOW_STOCK');
        }
      }
      res.json(inv);
    } catch (e) {
      next(e);
    }
  }
);

/** Bulk adjust stock: items with productId and quantityDelta (signed). Creates movements. */
router.post(
  '/bulk-adjust',
  body('items').isArray(),
  body('items.*.productId').isInt(),
  body('items.*.quantityDelta').isInt(),
  body('items.*.notes').optional().trim().isString(),
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
      const items = req.body.items as Array<{ productId: number; quantityDelta: number; notes?: string }>;
      const userId = req.user?.id;
      const results: Array<{ productId: number; success: boolean; quantity?: number; error?: string }> = [];
      for (const it of items) {
        try {
          const inv = await prisma.inventory.findUnique({ where: { productId: it.productId }, include: { product: true } });
          if (!inv) {
            results.push({ productId: it.productId, success: false, error: 'Inventory not found' });
            continue;
          }
          const newQty = Math.max(0, inv.quantity + it.quantityDelta);
          const delta = newQty - inv.quantity;
          if (delta === 0) {
            results.push({ productId: it.productId, success: true, quantity: inv.quantity });
            continue;
          }
          await prisma.inventory.update({
            where: { productId: it.productId },
            data: { quantity: newQty },
          });
          const type = delta > 0 ? 'STOCK_IN' : 'STOCK_OUT';
          await createInventoryMovement(prisma, {
            productId: it.productId,
            type,
            quantity: delta,
            userId,
            notes: it.notes ?? 'Bulk adjust',
          });
          results.push({ productId: it.productId, success: true, quantity: newQty });
        } catch (err) {
          results.push({
            productId: it.productId,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
      res.json({ results });
    } catch (e) {
      next(e);
    }
  }
);

export const inventoryRouter = router;
