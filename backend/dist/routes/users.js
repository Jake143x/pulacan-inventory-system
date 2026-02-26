import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
const router = Router();
router.use(authenticate);
router.use(requireRoles('OWNER', 'ADMIN'));
router.post('/', body('email').isEmail().normalizeEmail(), body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8–128 characters')
    .matches(/\d/)
    .withMessage('Password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain a lowercase letter')
    .matches(/[!@#$%^&*]/)
    .withMessage('Password must contain a special character (!@#$%^&*)'), body('fullName')
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2–100 characters')
    .matches(/^[\p{L}\p{M}\s\-'.]+$/u)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes'), body('roleName').isIn(['ADMIN', 'CASHIER']).withMessage('roleName must be ADMIN or CASHIER'), body('isActive').optional().isBoolean(), async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
        const { email, password, fullName, roleName, isActive } = req.body;
        const role = await prisma.role.findUnique({ where: { name: roleName } });
        if (!role)
            throw new AppError(400, 'Invalid role');
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing)
            throw new AppError(400, 'Email already in use');
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                passwordHash,
                fullName: fullName.trim(),
                roleId: role.id,
                isActive: isActive !== false,
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                role: { select: { name: true } },
            },
        });
        res.status(201).json({
            ...user,
            role: user.role.name,
            lastLoginAt: user.lastLoginAt?.toISOString?.() ?? null,
            createdAt: user.createdAt?.toISOString?.() ?? null,
        });
    }
    catch (e) {
        next(e);
    }
});
router.get('/', async (req, res, next) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const category = req.query.category?.toLowerCase() || 'all';
        const searchWhere = search
            ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { fullName: { contains: search, mode: 'insensitive' } }] }
            : {};
        const roleWhere = category === 'employee'
            ? { role: { name: { in: ['OWNER', 'ADMIN', 'CASHIER'] } } }
            : category === 'customer'
                ? { role: { name: 'CUSTOMER' } }
                : {};
        const where = { ...searchWhere, ...roleWhere };
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    isActive: true,
                    lastLoginAt: true,
                    createdAt: true,
                    role: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);
        res.json({
            data: users.map((u) => {
                const { lastLoginAt: lla, createdAt: ca, role: r, ...rest } = u;
                return { ...rest, role: r.name, lastLoginAt: lla?.toISOString?.() ?? null, createdAt: ca?.toISOString?.() ?? null };
            }),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (e) {
        next(e);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!id)
            throw new AppError(400, 'Invalid user id');
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                fullName: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                role: { select: { name: true } },
            },
        });
        if (!user)
            throw new AppError(404, 'User not found');
        res.json({
            ...user,
            role: user.role.name,
            lastLoginAt: user.lastLoginAt?.toISOString?.() ?? null,
            createdAt: user.createdAt?.toISOString?.() ?? null,
        });
    }
    catch (e) {
        next(e);
    }
});
router.patch('/:id', body('fullName').optional().trim().notEmpty(), body('isActive').optional().isBoolean(), body('roleName').optional().isIn(['OWNER', 'ADMIN', 'CASHIER', 'CUSTOMER']), body('password').optional().isLength({ min: 8 }), body('forcePasswordChange').optional().isBoolean(), async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
        const id = Number(req.params.id);
        if (!id)
            throw new AppError(400, 'Invalid user id');
        const self = req.user;
        const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
        if (!target)
            throw new AppError(404, 'User not found');
        if (target.role.name === 'OWNER') {
            if (req.body.isActive === false)
                throw new AppError(403, 'Owner account cannot be deactivated');
            if (req.body.roleName !== undefined && req.body.roleName !== 'OWNER')
                throw new AppError(403, 'Owner role cannot be changed');
        }
        if (self.roleName !== 'OWNER' && id !== self.id && target.role.name === 'OWNER') {
            throw new AppError(403, 'Cannot modify owner');
        }
        const roleName = req.body.roleName;
        let roleId;
        if (roleName) {
            const role = await prisma.role.findUnique({ where: { name: roleName } });
            if (!role)
                throw new AppError(400, 'Invalid role');
            roleId = role.id;
            if (roleName === 'OWNER' && self.roleName !== 'OWNER')
                throw new AppError(403, 'Only owner can assign owner role');
        }
        const update = {};
        if (req.body.fullName !== undefined)
            update.fullName = req.body.fullName;
        if (req.body.isActive !== undefined)
            update.isActive = req.body.isActive;
        if (roleId !== undefined)
            update.roleId = roleId;
        if (req.body.password) {
            update.passwordHash = await bcrypt.hash(req.body.password, 10);
            if (id !== self.id)
                update.forcePasswordChange = true;
        }
        if (req.body.forcePasswordChange !== undefined)
            update.forcePasswordChange = req.body.forcePasswordChange;
        const user = await prisma.user.update({
            where: { id },
            data: update,
            select: {
                id: true,
                email: true,
                fullName: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                role: { select: { name: true } },
            },
        });
        res.json({
            ...user,
            role: user.role.name,
            lastLoginAt: user.lastLoginAt?.toISOString?.() ?? null,
            createdAt: user.createdAt?.toISOString?.() ?? null,
        });
    }
    catch (e) {
        next(e);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!id)
            throw new AppError(400, 'Invalid user id');
        const self = req.user;
        const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
        if (!target)
            throw new AppError(404, 'User not found');
        if (target.role.name === 'OWNER')
            throw new AppError(403, 'Cannot delete owner account');
        if (id === self.id)
            throw new AppError(403, 'Cannot delete your own account');
        await prisma.$transaction(async (tx) => {
            await tx.orderItem.deleteMany({ where: { order: { userId: id } } });
            await tx.onlineOrder.deleteMany({ where: { userId: id } });
            await tx.saleItem.deleteMany({ where: { sale: { userId: id } } });
            await tx.saleTransaction.deleteMany({ where: { userId: id } });
            await tx.notification.deleteMany({ where: { userId: id } });
            await tx.user.delete({ where: { id } });
        });
        res.status(204).send();
    }
    catch (e) {
        next(e);
    }
});
export const usersRouter = router;
