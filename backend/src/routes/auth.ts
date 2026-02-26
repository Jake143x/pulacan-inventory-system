import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest, JwtPayload } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.post(
  '/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({
        where: { email },
        include: { role: true },
      });
      if (!user || !user.isActive) throw new AppError(401, 'Invalid email or password');
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) throw new AppError(401, 'Invalid email or password');
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      } catch {
        // Non-fatal: allow login even if lastLoginAt update fails (e.g. column missing before migration)
      }
      const payload: JwtPayload = {
        userId: user.id,
        email: user.email,
        roleName: user.role.name,
      };
      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET!,
        { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
      );
      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role.name,
        },
        mustChangePassword: user.forcePasswordChange === true,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Customer self-registration: fullName, email, contactNumber, password. Address is collected at checkout.
// Uses raw SQL insert so registration works even if the generated Prisma client is out of date (e.g. contactNumber).
router.post(
  '/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 128 }),
  body('fullName').trim().notEmpty().isLength({ min: 2, max: 100 }),
  body('contactNumber').optional().trim().isLength({ max: 30 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
      const { email, password, fullName, contactNumber } = req.body;
      const customerRole = await prisma.role.findUnique({ where: { name: 'CUSTOMER' } });
      if (!customerRole) throw new AppError(500, 'Customer role not found');
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new AppError(400, 'An account with this email already exists');
      const passwordHash = await bcrypt.hash(password, 10);
      const fullNameTrimmed = (fullName as string).trim();
      const contactNumberVal = (contactNumber as string)?.trim() || null;
      const now = new Date();

      await prisma.$executeRaw`
        INSERT INTO "User" (email, "passwordHash", "fullName", "contactNumber", "roleId", "isActive", "forcePasswordChange", "createdAt", "updatedAt")
        VALUES (${email}, ${passwordHash}, ${fullNameTrimmed}, ${contactNumberVal}, ${customerRole.id}, true, false, ${now}, ${now})
      `;

      const user = await prisma.user.findUnique({
        where: { email },
        include: { role: true },
      });
      if (!user) throw new AppError(500, 'User created but could not be retrieved');

      const payload: JwtPayload = {
        userId: user.id,
        email: user.email,
        roleName: user.role.name,
      };
      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET!,
        { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
      );
      return res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role.name,
        },
      });
    } catch (e) {
      next(e);
    }
  }
);

router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const baseSelect = { id: true, email: true, fullName: true, isActive: true, lastLoginAt: true, createdAt: true, role: { select: { name: true } } } as const;
    let user: { id: number; email: string; fullName: string; isActive: boolean; lastLoginAt: Date | null; createdAt: Date; role: { name: string }; contactNumber?: string | null; profilePictureUrl?: string | null } | null;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { ...baseSelect, contactNumber: true, profilePictureUrl: true },
      });
    } catch {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: baseSelect,
      }).then((u) => (u ? { ...u, contactNumber: null as string | null, profilePictureUrl: null as string | null } : null));
    }
    if (!user) return next(new AppError(404, 'User not found'));
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      contactNumber: user.contactNumber ?? null,
      profilePictureUrl: user.profilePictureUrl ?? null,
      role: user.role.name,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString?.() ?? null,
      createdAt: user.createdAt?.toISOString?.() ?? null,
    });
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/me',
  authenticate,
  body('fullName').optional().trim().notEmpty().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('contactNumber').optional().trim().isLength({ max: 30 }),
  body('profilePictureUrl').optional().trim().isLength({ max: 500 }),
  body('password').optional().isLength({ min: 8, max: 128 }),
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
      const userId = req.user!.id;
      const update: { fullName?: string; email?: string; contactNumber?: string | null; profilePictureUrl?: string | null; passwordHash?: string; forcePasswordChange?: boolean } = {};
      if (req.body.fullName !== undefined) update.fullName = req.body.fullName.trim();
      if (req.body.email !== undefined) {
        const existing = await prisma.user.findFirst({ where: { email: req.body.email, id: { not: userId } } });
        if (existing) throw new AppError(400, 'Email already in use');
        update.email = req.body.email;
      }
      if (req.body.contactNumber !== undefined) update.contactNumber = req.body.contactNumber?.trim() || null;
      if (req.body.profilePictureUrl !== undefined) update.profilePictureUrl = req.body.profilePictureUrl?.trim() || null;
      if (req.body.password) {
        update.passwordHash = await bcrypt.hash(req.body.password, 10);
        update.forcePasswordChange = false;
      }
      const select = { id: true, email: true, fullName: true, contactNumber: true, profilePictureUrl: true, isActive: true, lastLoginAt: true, createdAt: true, role: { select: { name: true } } };
      if (Object.keys(update).length === 0) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select });
        if (!user) return next(new AppError(404, 'User not found'));
        return res.json({
          ...user,
          role: user.role.name,
          lastLoginAt: user.lastLoginAt?.toISOString?.() ?? null,
          createdAt: user.createdAt?.toISOString?.() ?? null,
        });
      }
      const user = await prisma.user.update({
        where: { id: userId },
        data: update,
        select,
      });
      res.json({
        ...user,
        role: user.role.name,
        lastLoginAt: user.lastLoginAt?.toISOString?.() ?? null,
        createdAt: user.createdAt?.toISOString?.() ?? null,
      });
    } catch (e) {
      next(e);
    }
  }
);

export const authRouter = router;
