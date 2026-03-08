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
router.use(requireRoles('OWNER', 'CASHIER'));

/** Recent sales for the Current sale chart dropdown (auto-loaded on POS page). */
router.get('/transactions', async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
    const sales = await prisma.saleTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        items: { include: { product: true } },
      },
    });
    res.json({ data: sales });
  } catch (e) {
    next(e);
  }
});

router.post(
  '/transaction',
  body('items').isArray(),
  body('items.*.productId').isInt(),
  body('items.*.quantity').isFloat({ min: 0.001 }),
  body('items.*.unitName').optional().trim(),
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
      const items = req.body.items as Array<{ productId: number; quantity: number; unitName?: string }>;
      const productIds = [...new Set(items.map((i) => i.productId))];
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { inventory: true, productUnits: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));
      let total = 0;
      const saleItems: Array<{ productId: number; productUnitId?: number; unitName?: string; quantity: number; unitPrice: number; subtotal: number }> = [];
      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) throw new AppError(400, `Product ${item.productId} not found`);
        const qty = Number(item.quantity);
        const unitName = typeof item.unitName === 'string' && item.unitName.trim() ? item.unitName.trim() : null;

        let unitPrice: number;
        let productUnitId: number | null = null;

        if (unitName && product.productUnits && product.productUnits.length > 0) {
          const pu = product.productUnits.find((u) => u.unitName.toLowerCase() === unitName.toLowerCase());
          if (!pu) throw new AppError(400, `Unit "${unitName}" not found for ${product.name}`);
          if (pu.stock < qty) throw new AppError(400, `Insufficient stock for ${product.name} (${unitName}). Available: ${pu.stock}`);
          unitPrice = pu.price;
          productUnitId = pu.id;
        } else {
          const inv = product.inventory;
          if (!inv || inv.quantity < qty) {
            throw new AppError(400, `Insufficient stock for ${product.name}. Available: ${inv?.quantity ?? 0}`);
          }
          if (product.minOrderQuantity != null && qty < product.minOrderQuantity) {
            throw new AppError(400, `Minimum order for ${product.name} is ${product.minOrderQuantity} ${product.saleUnit || 'units'}`);
          }
          if (product.quantityStep != null && product.quantityStep > 0) {
            const remainder = Math.abs((qty / product.quantityStep) - Math.round(qty / product.quantityStep));
            if (remainder > 0.001) {
              throw new AppError(400, `Quantity for ${product.name} must be in steps of ${product.quantityStep} ${product.saleUnit || 'units'}`);
            }
          }
          unitPrice = product.unitPrice;
        }

        const subtotal = unitPrice * qty;
        total += subtotal;
        saleItems.push({
          productId: product.id,
          productUnitId: productUnitId ?? undefined,
          unitName: unitName ?? undefined,
          quantity: qty,
          unitPrice,
          subtotal,
        });
      }
      const userId = req.user!.id;
      const sale = await prisma.saleTransaction.create({
        data: {
          userId,
          total,
          items: {
            create: saleItems.map((si) => ({
              productId: si.productId,
              productUnitId: si.productUnitId ?? null,
              unitName: si.unitName ?? null,
              quantity: si.quantity,
              unitPrice: si.unitPrice,
              subtotal: si.subtotal,
            })),
          },
        },
        include: { items: { include: { product: true, productUnit: true } } },
      });
      for (const item of saleItems) {
        if (item.productUnitId != null) {
          await prisma.productUnit.update({
            where: { id: item.productUnitId },
            data: { stock: { decrement: item.quantity } },
          });
        } else {
          await prisma.inventory.update({
            where: { productId: item.productId },
            data: { quantity: { decrement: item.quantity } },
          });
        }
        await createInventoryMovement(prisma, {
          productId: item.productId,
          type: 'STOCK_OUT',
          quantity: -item.quantity,
          userId,
          notes: item.unitName ? `POS sale (${item.unitName})` : 'POS sale',
        });
      }
      const afterSale = await prisma.inventory.findMany({
        where: { productId: { in: productIds } },
        include: { product: true },
      });
      const lowNow = afterSale.filter((i) => i.quantity <= i.lowStockThreshold);
      if (lowNow.length > 0) {
        const adminUsers = await prisma.user.findMany({
          where: { role: { name: { in: ['ADMIN', 'OWNER'] } }, isActive: true },
          select: { id: true },
        });
        for (const inv of lowNow) {
          const title = 'Low stock';
          const message = `${inv.product.name} is low (${inv.quantity} left, threshold ${inv.lowStockThreshold}). Consider reordering.`;
          for (const u of adminUsers) {
            await createNotification(prisma, u.id, title, message, 'LOW_STOCK');
          }
        }
      }
      res.status(201).json(sale);
    } catch (e) {
      next(e);
    }
  }
);

export const posRouter = router;
