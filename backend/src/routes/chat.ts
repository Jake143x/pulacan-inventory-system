import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { createNotificationForCashiers } from '../services/notifications.js';

const router = Router();

/** POST /api/chat/sessions — Create a new chat session.
 * - Customer (no body): create or return own open session; notifies cashiers.
 * - Staff (body: { customerId }): create or return open session for that customer (cashier-initiated live inquiry).
 */
router.post(
  '/sessions',
  authenticate,
  body('customerId').optional().isInt({ min: 1 }),
  async (req: AuthRequest, res, next) => {
    try {
      const role = req.user!.roleName;
      const customerIdFromBody = req.body?.customerId as number | undefined;

      if (role === 'CUSTOMER') {
        if (customerIdFromBody != null) throw new AppError(403, 'Customers cannot create sessions for others');
        const userId = req.user!.id;
        const existing = await prisma.chatSession.findFirst({
          where: { customerId: userId, status: 'open' },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) return res.status(200).json(existing);
        const session = await prisma.chatSession.create({
          data: { customerId: userId, status: 'open' },
        });
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { fullName: true, email: true },
        });
        const name = user?.fullName ?? 'A customer';
        const email = user?.email ?? '';
        await createNotificationForCashiers(
          prisma,
          'Live chat started',
          `${name} (${email}) started a live chat. Session #${session.id}.`,
          'CUSTOMER_INQUIRY'
        );
        return res.status(201).json(session);
      }

      if (role === 'CASHIER' || role === 'ADMIN' || role === 'OWNER') {
        if (customerIdFromBody == null) throw new AppError(400, 'Provide customerId to start a live inquiry for a customer');
        const customer = await prisma.user.findUnique({
          where: { id: customerIdFromBody },
          include: { role: { select: { name: true } } },
        });
        if (!customer) throw new AppError(404, 'Customer not found');
        if (customer.role.name !== 'CUSTOMER') throw new AppError(400, 'User is not a customer');
        const existing = await prisma.chatSession.findFirst({
          where: { customerId: customerIdFromBody, status: 'open' },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) return res.status(200).json(existing);
        const session = await prisma.chatSession.create({
          data: { customerId: customerIdFromBody, status: 'open' },
        });
        const withCustomer = await prisma.chatSession.findUnique({
          where: { id: session.id },
          include: { customer: { select: { id: true, fullName: true, email: true } } },
        });
        return res.status(201).json(withCustomer ?? session);
      }

      throw new AppError(403, 'Forbidden');
    } catch (e) {
      next(e);
    }
  }
);

/** GET /api/chat/customers — List customers (for staff to start a live inquiry). */
router.get(
  '/customers',
  authenticate,
  requireRoles('CASHIER', 'ADMIN', 'OWNER'),
  async (req: AuthRequest, res, next) => {
    try {
      const customerRole = await prisma.role.findUnique({ where: { name: 'CUSTOMER' } });
      if (!customerRole) return res.json({ data: [] });
      const users = await prisma.user.findMany({
        where: { roleId: customerRole.id, isActive: true },
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: 'asc' },
        take: 200,
      });
      res.json({ data: users });
    } catch (e) {
      next(e);
    }
  }
);

/** GET /api/chat/sessions — List sessions. Customer: own; Cashier: all (optional ?status=open). */
router.get(
  '/sessions',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const role = req.user!.roleName;
      const status = (req.query.status as string) || undefined;
      const where: { customerId?: number; status?: string } = {};
      if (role === 'CUSTOMER') where.customerId = req.user!.id;
      if (status) where.status = status;
      const sessions = await prisma.chatSession.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      res.json({ data: sessions });
    } catch (e) {
      next(e);
    }
  }
);

/** GET /api/chat/sessions/:id — Get one session with messages. */
router.get(
  '/sessions/:id',
  authenticate,
  param('id').isInt({ min: 1 }),
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, 'Invalid session id');
      const id = Number(req.params.id);
      const session = await prisma.chatSession.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!session) throw new AppError(404, 'Chat session not found');
      const role = req.user!.roleName;
      if (role === 'CUSTOMER' && session.customerId !== req.user!.id) {
        throw new AppError(403, 'You can only view your own chat sessions');
      }
      res.json(session);
    } catch (e) {
      next(e);
    }
  }
);

/** POST /api/chat/sessions/:id/messages — Send a message (optional image). */
router.post(
  '/sessions/:id/messages',
  authenticate,
  param('id').isInt({ min: 1 }),
  body('message').optional().trim().isLength({ max: 5000 }),
  body('imageUrl').optional().isString().isLength({ max: 2000 }),
  body('senderType').isIn(['customer', 'cashier']),
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, 'Invalid request');
      const sessionId = Number(req.params.id);
      const { message, imageUrl, senderType } = req.body as { message?: string; imageUrl?: string; senderType: 'customer' | 'cashier' };
      if (!message?.trim() && !imageUrl?.trim()) {
        throw new AppError(400, 'Provide message text and/or image');
      }
      const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new AppError(404, 'Chat session not found');
      if (session.status !== 'open') throw new AppError(400, 'This chat session is closed');
      const role = req.user!.roleName;
      if (senderType === 'customer') {
        if (role !== 'CUSTOMER' || session.customerId !== req.user!.id) {
          throw new AppError(403, 'Only the customer in this session can send customer messages');
        }
      } else {
        if (role !== 'CASHIER' && role !== 'ADMIN' && role !== 'OWNER') {
          throw new AppError(403, 'Only staff can send cashier messages');
        }
      }
      const msgText = (message ?? '').trim();
      const imgUrl = imageUrl?.trim() || null;
      let created: { id: number; sessionId: number; senderType: string; message: string; imageUrl: string | null; createdAt: Date };
      try {
        created = await prisma.chatMessage.create({
          data: { sessionId, senderType, message: msgText, imageUrl: imgUrl },
        });
      } catch (createErr: unknown) {
        const errMsg = createErr instanceof Error ? createErr.message : String(createErr);
        if (errMsg.includes('Unknown argument') && errMsg.includes('imageUrl')) {
          const rows = await prisma.$queryRaw<Array<{ id: number; sessionId: number; senderType: string; message: string; imageUrl: string | null; createdAt: Date }>>`
            INSERT INTO "ChatMessage" ("sessionId", "senderType", "message", "imageUrl")
            VALUES (${sessionId}, ${senderType}, ${msgText}, ${imgUrl})
            RETURNING id, "sessionId", "senderType", "message", "imageUrl", "createdAt"
          `;
          const row = rows[0];
          if (!row) throw new AppError(500, 'Failed to create message');
          created = { ...row, createdAt: row.createdAt };
        } else {
          throw createErr;
        }
      }
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  }
);

/** PATCH /api/chat/sessions/:id — Close session. */
router.patch(
  '/sessions/:id',
  authenticate,
  param('id').isInt({ min: 1 }),
  body('status').optional().isIn(['open', 'closed']),
  async (req: AuthRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      const session = await prisma.chatSession.findUnique({ where: { id } });
      if (!session) throw new AppError(404, 'Chat session not found');
      const role = req.user!.roleName;
      const canClose = role === 'CASHIER' || role === 'ADMIN' || role === 'OWNER' || session.customerId === req.user!.id;
      if (!canClose) throw new AppError(403, 'You cannot close this session');
      const updated = await prisma.chatSession.update({
        where: { id },
        data: { status: 'closed' },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export const chatRouter = router;
