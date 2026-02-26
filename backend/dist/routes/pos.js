import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
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
    }
    catch (e) {
        next(e);
    }
});
router.post('/transaction', body('items').isArray(), body('items.*.productId').isInt(), body('items.*.quantity').isInt({ min: 1 }), async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
        const items = req.body.items;
        const productIds = [...new Set(items.map((i) => i.productId))];
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            include: { inventory: true },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));
        let total = 0;
        const saleItems = [];
        for (const item of items) {
            const product = productMap.get(item.productId);
            if (!product)
                throw new AppError(400, `Product ${item.productId} not found`);
            const inv = product.inventory;
            if (!inv || inv.quantity < item.quantity) {
                throw new AppError(400, `Insufficient stock for ${product.name}. Available: ${inv?.quantity ?? 0}`);
            }
            const unitPrice = product.unitPrice;
            const subtotal = unitPrice * item.quantity;
            total += subtotal;
            saleItems.push({ productId: product.id, quantity: item.quantity, unitPrice, subtotal });
        }
        const userId = req.user.id;
        const sale = await prisma.saleTransaction.create({
            data: {
                userId,
                total,
                items: {
                    create: saleItems,
                },
            },
            include: { items: { include: { product: true } } },
        });
        for (const item of saleItems) {
            await prisma.inventory.update({
                where: { productId: item.productId },
                data: { quantity: { decrement: item.quantity } },
            });
            await createInventoryMovement(prisma, {
                productId: item.productId,
                type: 'STOCK_OUT',
                quantity: -item.quantity,
                userId,
                notes: 'POS sale',
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
    }
    catch (e) {
        next(e);
    }
});
export const posRouter = router;
