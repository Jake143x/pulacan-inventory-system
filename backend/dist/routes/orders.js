import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { AppError } from '../middleware/errorHandler.js';
import { createNotification } from '../services/notifications.js';
import { prisma } from '../lib/prisma.js';
const router = Router();
const PAYMENT_METHODS = ['GCASH', 'DEBIT_CARD', 'CASH_ON_DELIVERY'];
// Customer: place order (pending approval), view own orders. Shipping address required at checkout.
router.post('/', authenticate, body('items').isArray(), body('items.*.productId').isInt(), body('items.*.quantity').isInt({ min: 1 }), body('paymentMethod').optional().isIn(PAYMENT_METHODS), body('streetAddress').trim().notEmpty().withMessage('Street address is required').isLength({ max: 200 }), body('barangay').trim().notEmpty().withMessage('Barangay is required').isLength({ max: 100 }), body('city').trim().notEmpty().withMessage('City is required').isLength({ max: 100 }), body('province').trim().notEmpty().withMessage('Province is required').isLength({ max: 100 }), body('zipCode').trim().notEmpty().withMessage('ZIP code is required').isLength({ max: 20 }), body('landmark').optional().trim().isLength({ max: 200 }), async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
        const userId = req.user.id;
        const items = req.body.items;
        const paymentMethod = PAYMENT_METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : null;
        const streetAddress = req.body.streetAddress?.trim();
        const barangay = req.body.barangay?.trim();
        const city = req.body.city?.trim();
        const province = req.body.province?.trim();
        const zipCode = req.body.zipCode?.trim();
        const landmark = req.body.landmark?.trim() || null;
        const productIds = [...new Set(items.map((i) => i.productId))];
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            include: { inventory: true },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));
        let total = 0;
        const orderItems = [];
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
            orderItems.push({ productId: product.id, quantity: item.quantity, unitPrice, subtotal });
        }
        // Cash and Debit = paid on the spot → auto-approve. GCash = pay later/scan → pending approval.
        const autoApprove = paymentMethod === 'CASH_ON_DELIVERY' || paymentMethod === 'DEBIT_CARD';
        const status = autoApprove ? 'APPROVED' : 'PENDING_APPROVAL';
        const order = await prisma.onlineOrder.create({
            data: {
                userId,
                status,
                total,
                paymentMethod,
                streetAddress,
                barangay,
                city,
                province,
                zipCode,
                landmark,
                items: { create: orderItems },
            },
            include: { items: { include: { product: true } } },
        });
        if (autoApprove) {
            for (const item of orderItems) {
                await prisma.inventory.update({
                    where: { productId: item.productId },
                    data: { quantity: { decrement: item.quantity } },
                });
            }
            await createNotification(prisma, userId, 'Order Approved', `Your order #${order.id} has been approved.`, 'ORDER_APPROVED');
        }
        res.status(201).json(order);
    }
    catch (e) {
        next(e);
    }
});
router.get('/', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const role = req.user.roleName;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
        const status = req.query.status || '';
        if (role === 'CUSTOMER') {
            const where = { userId };
            if (status)
                where.status = status;
            const [orders, total] = await Promise.all([
                prisma.onlineOrder.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    include: { items: { include: { product: true } } },
                    orderBy: { createdAt: 'desc' },
                }),
                prisma.onlineOrder.count({ where }),
            ]);
            return res.json({
                data: orders,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            });
        }
        if (role === 'CASHIER' || role === 'OWNER') {
            const where = status ? { status } : {};
            const [orders, total] = await Promise.all([
                prisma.onlineOrder.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    include: { user: { select: { id: true, email: true, fullName: true } }, items: { include: { product: true } } },
                    orderBy: { createdAt: 'desc' },
                }),
                prisma.onlineOrder.count({ where }),
            ]);
            return res.json({
                data: orders,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            });
        }
        return next(new AppError(403, 'Cannot list orders'));
    }
    catch (e) {
        next(e);
    }
});
router.get('/pending', authenticate, requireRoles('CASHIER', 'OWNER'), async (_req, res, next) => {
    try {
        const orders = await prisma.onlineOrder.findMany({
            where: { status: 'PENDING_APPROVAL' },
            include: { user: { select: { id: true, email: true, fullName: true } }, items: { include: { product: true } } },
            orderBy: { createdAt: 'asc' },
        });
        res.json({ data: orders });
    }
    catch (e) {
        next(e);
    }
});
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const order = await prisma.onlineOrder.findUnique({
            where: { id },
            include: { user: { select: { id: true, email: true, fullName: true } }, items: { include: { product: true } } },
        });
        if (!order)
            throw new AppError(404, 'Order not found');
        if (req.user.roleName === 'CUSTOMER' && order.userId !== req.user.id) {
            throw new AppError(403, 'Access denied');
        }
        res.json(order);
    }
    catch (e) {
        next(e);
    }
});
// Customer: delete own order (cancel if pending, or remove from list if approved/rejected)
router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const userId = req.user.id;
        if (req.user.roleName !== 'CUSTOMER') {
            return next(new AppError(403, 'Only customers can delete orders from this endpoint'));
        }
        const order = await prisma.onlineOrder.findUnique({
            where: { id },
        });
        if (!order)
            throw new AppError(404, 'Order not found');
        if (order.userId !== userId)
            throw new AppError(403, 'Access denied');
        await prisma.onlineOrder.delete({ where: { id } });
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
router.patch('/:id/approve', authenticate, requireRoles('CASHIER', 'OWNER'), body('action').isIn(['approve', 'reject']), async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            throw new AppError(400, 'Invalid action');
        const id = Number(req.params.id);
        const action = req.body.action;
        const order = await prisma.onlineOrder.findUnique({
            where: { id },
            include: { items: true, user: true },
        });
        if (!order)
            throw new AppError(404, 'Order not found');
        if (order.status !== 'PENDING_APPROVAL')
            throw new AppError(400, 'Order already processed');
        if (action === 'approve') {
            for (const item of order.items) {
                await prisma.inventory.update({
                    where: { productId: item.productId },
                    data: { quantity: { decrement: item.quantity } },
                });
            }
            await prisma.onlineOrder.update({
                where: { id },
                data: { status: 'APPROVED' },
            });
            await createNotification(prisma, order.userId, 'Order Approved', `Your order #${id} has been approved.`, 'ORDER_APPROVED');
        }
        else {
            await prisma.onlineOrder.update({
                where: { id },
                data: { status: 'REJECTED' },
            });
            await createNotification(prisma, order.userId, 'Order Rejected', `Your order #${id} has been rejected.`, 'ORDER_REJECTED');
        }
        const updated = await prisma.onlineOrder.findUnique({
            where: { id },
            include: { items: { include: { product: true } } },
        });
        res.json(updated);
    }
    catch (e) {
        next(e);
    }
});
export const ordersRouter = router;
