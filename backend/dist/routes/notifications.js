import { Router } from 'express';
import { query } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
const router = Router();
router.use(authenticate);
router.get('/unread-count', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const count = await prisma.notification.count({
            where: { userId, read: false },
        });
        res.json({ count });
    }
    catch (e) {
        next(e);
    }
});
router.get('/', query('riskLevel').optional().isString(), query('startDate').optional().isISO8601(), query('endDate').optional().isISO8601(), query('unread').optional().isIn(['true', 'false']), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Number(req.query.limit) || 20);
        const unreadOnly = req.query.unread === 'true';
        const riskLevel = req.query.riskLevel?.trim();
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const where = { userId };
        if (unreadOnly)
            where.read = false;
        if (riskLevel)
            where.riskLevel = riskLevel;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [data, total] = await Promise.all([
            prisma.notification.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    userId: true,
                    title: true,
                    message: true,
                    type: true,
                    riskLevel: true,
                    read: true,
                    createdAt: true,
                },
            }),
            prisma.notification.count({ where }),
        ]);
        res.json({
            data: data.map((n) => ({
                id: n.id,
                title: n.title,
                message: n.message,
                type: n.type,
                riskLevel: n.riskLevel,
                read: n.read,
                createdAt: n.createdAt,
                productId: null,
                productName: null,
            })),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
        });
    }
    catch (e) {
        next(e);
    }
});
router.patch('/:id/read', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const userId = req.user.id;
        await prisma.notification.updateMany({
            where: { id, userId },
            data: { read: true },
        });
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
router.patch('/read-all', async (req, res, next) => {
    try {
        const userId = req.user.id;
        await prisma.notification.updateMany({
            where: { userId },
            data: { read: true },
        });
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const userId = req.user.id;
        await prisma.notification.deleteMany({
            where: { id, userId },
        });
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
/** Delete notifications older than the given date (e.g. "older than 30 days"). Admin only. */
router.delete('/old', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const before = req.query.before;
        const beforeDate = before ? new Date(before) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const result = await prisma.notification.deleteMany({
            where: { userId, createdAt: { lt: beforeDate } },
        });
        res.json({ deleted: result.count });
    }
    catch (e) {
        next(e);
    }
});
export const notificationsRouter = router;
