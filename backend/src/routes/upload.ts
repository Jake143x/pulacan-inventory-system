import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');
const PRODUCT_IMAGE_DIR = path.join(process.cwd(), 'uploads', 'products');
const CHAT_IMAGE_DIR = path.join(process.cwd(), 'uploads', 'chat');

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
    cb(null, AVATAR_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    const name = `${(req as AuthRequest).user!.id}-${Date.now()}${safeExt}`;
    cb(null, name);
  },
});

const productStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(PRODUCT_IMAGE_DIR, { recursive: true });
    cb(null, PRODUCT_IMAGE_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png'].includes(ext) ? ext : '.jpg';
    const name = `product-${Date.now()}-${Math.random().toString(36).slice(2, 9)}${safeExt}`;
    cb(null, name);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new AppError(400, 'Only images (JPEG, PNG, GIF, WebP) are allowed'));
  },
});

const uploadProductImage = multer({
  storage: productStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png)$/i.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new AppError(400, 'Only JPG and PNG images are allowed (max 2MB)'));
  },
});

const chatStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(CHAT_IMAGE_DIR, { recursive: true });
    cb(null, CHAT_IMAGE_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    const name = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}${safeExt}`;
    cb(null, name);
  },
});

const uploadChatImage = multer({
  storage: chatStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for chat
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new AppError(400, 'Only images (JPEG, PNG, GIF, WebP) are allowed (max 5MB)'));
  },
});

router.post('/avatar', authenticate, uploadAvatar.single('avatar'), (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No image file provided');
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    const url = `${baseUrl.replace(/\/$/, '')}/api/uploads/avatars/${file.filename}`;
    res.json({ url });
  } catch (e) {
    next(e);
  }
});

/** Product image upload — stores in /uploads/products/, returns path for saving as product image_path. Admin only. */
router.post('/product', authenticate, requireRoles('OWNER', 'ADMIN'), uploadProductImage.single('image'), (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No image file provided. Use field name "image" and allow only JPG or PNG (max 2MB).');
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    const pathForDb = `${baseUrl.replace(/\/$/, '')}/api/uploads/products/${file.filename}`;
    res.json({ url: pathForDb, path: `/api/uploads/products/${file.filename}` });
  } catch (e) {
    next(e);
  }
});

/** Chat image upload — for live chat. Field: "image"; body or query: sessionId. User must be participant (customer or staff). */
router.post('/chat', authenticate, uploadChatImage.single('image'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No image file provided. Use field name "image".');
    const sessionId = Number(req.body?.sessionId ?? req.query?.sessionId);
    if (!sessionId || !Number.isInteger(sessionId)) throw new AppError(400, 'sessionId is required');
    const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new AppError(404, 'Chat session not found');
    if (session.status !== 'open') throw new AppError(400, 'This chat session is closed');
    const role = req.user!.roleName;
    const isCustomer = role === 'CUSTOMER' && session.customerId === req.user!.id;
    const isStaff = role === 'CASHIER' || role === 'ADMIN' || role === 'OWNER';
    if (!isCustomer && !isStaff) throw new AppError(403, 'You cannot upload to this chat');
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    const url = `${baseUrl.replace(/\/$/, '')}/api/uploads/chat/${file.filename}`;
    res.json({ url });
  } catch (e) {
    next(e);
  }
});

export const uploadRouter = router;
