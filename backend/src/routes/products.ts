import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/categories', async (req, res, next) => {
  try {
    const shop = (req.query.shop as string) === 'true';
    const where: { category?: { not: null }; status?: string; inventory?: { quantity: { gt: number } } } = { category: { not: null } };
    if (shop) {
      where.status = 'active';
      where.inventory = { quantity: { gt: 0 } };
    }
    const rows = await prisma.product.findMany({
      where,
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    const categories = rows.map((r) => r.category).filter((c): c is string => c != null);
    res.json({ data: categories });
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim() || '';
    const category = (req.query.category as string)?.trim() || '';
    const shop = (req.query.shop as string) === 'true';
    const where: {
      OR?: Array<{ name: { contains: string; mode?: 'insensitive' }; sku?: { contains: string; mode?: 'insensitive' } }>;
      category?: string;
      status?: string;
      inventory?: { quantity: { gt: number } };
    } = {};
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }];
    if (category) where.category = category;
    if (shop) {
      where.status = 'active';
      where.inventory = { quantity: { gt: 0 } };
    }
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: { inventory: true },
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
    ]);
    res.json({
      data: products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) throw new AppError(400, 'Invalid product id');
    const product = await prisma.product.findUnique({
      where: { id },
      include: { inventory: true },
    });
    if (!product) throw new AppError(404, 'Product not found');
    res.json(product);
  } catch (e) {
    next(e);
  }
});

router.use(authenticate);
router.use(requireRoles('OWNER', 'ADMIN'));

router.post(
  '/',
  body('name').trim().notEmpty(),
  body('sku').optional().trim(),
  body('category').optional().trim(),
  body('description').optional().trim(),
  body('specifications').optional().trim(),
  body('unitPrice').isFloat({ min: 0 }),
  body('imageUrl').optional().trim(),
  body('status').optional().isIn(['active', 'inactive']),
  body('initialQuantity').optional().isInt({ min: 0 }),
  body('lowStockThreshold').optional().isInt({ min: 0 }),
  body('reorderLevel').optional().isInt({ min: 0 }),
  body('reorderQuantity').optional().isInt({ min: 0 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
      const { name, sku, category: cat, description, unitPrice, imageUrl: imgUrl, status: st, specifications: specs, initialQuantity = 0, lowStockThreshold, reorderLevel, reorderQuantity } = req.body;
      const status = st === 'inactive' ? 'inactive' : 'active';
      const threshold = lowStockThreshold ?? Number(process.env.LOW_STOCK_THRESHOLD_DEFAULT) ?? 10;
      const reorderL = reorderLevel ?? threshold;
      const reorderQ = reorderQuantity ?? 100;
      if (sku) {
        const existing = await prisma.product.findUnique({ where: { sku } });
        if (existing) throw new AppError(400, 'SKU already exists');
      }
      const product = await prisma.product.create({
        data: {
          name,
          sku: sku || null,
          category: cat || null,
          description: description || null,
          specifications: specs || null,
          unitPrice: Number(unitPrice),
          imageUrl: imgUrl || null,
          status,
        },
      });
      await prisma.inventory.create({
        data: {
          productId: product.id,
          quantity: Number(initialQuantity),
          lowStockThreshold: Number(threshold),
          reorderLevel: Number(reorderL),
          reorderQuantity: Number(reorderQ),
        },
      });
      const withInv = await prisma.product.findUnique({
        where: { id: product.id },
        include: { inventory: true },
      });
      res.status(201).json(withInv);
    } catch (e) {
      next(e);
    }
  }
);

/** Bulk delete products by IDs. */
router.post(
  '/bulk-delete',
  body('productIds').isArray(),
  body('productIds.*').isInt(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
      const productIds = req.body.productIds as number[];
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
      res.json({ deleted: productIds.length });
    } catch (e) {
      next(e);
    }
  }
);

/** Bulk update category for multiple products. */
router.patch(
  '/bulk-category',
  body('productIds').isArray(),
  body('productIds.*').isInt(),
  body('category').trim().notEmpty(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
      const { productIds, category } = req.body;
      const result = await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { category: String(category) },
      });
      res.json({ updated: result.count });
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  '/:id',
  body('name').optional().trim().notEmpty(),
  body('sku').optional().trim(),
  body('category').optional().trim(),
  body('description').optional().trim(),
  body('specifications').optional().trim(),
  body('unitPrice').optional().isFloat({ min: 0 }),
  body('imageUrl').optional().trim(),
  body('status').optional().isIn(['active', 'inactive']),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
      const id = Number(req.params?.id);
      if (!id) throw new AppError(400, 'Invalid product id');
      const { name, sku, category: cat, description, unitPrice, imageUrl: imgUrl, status: st, specifications: specs } = req.body;
      const update: Record<string, unknown> = {};
      if (name !== undefined) update.name = name;
      if (sku !== undefined) update.sku = sku || null;
      if (cat !== undefined) update.category = cat || null;
      if (description !== undefined) update.description = description || null;
      if (specs !== undefined) update.specifications = specs || null;
      if (unitPrice !== undefined) update.unitPrice = Number(unitPrice);
      if (imgUrl !== undefined) update.imageUrl = imgUrl || null;
      if (st !== undefined) update.status = st === 'inactive' ? 'inactive' : 'active';
      const product = await prisma.product.update({
        where: { id },
        data: update,
        include: { inventory: true },
      });
      res.json(product);
    } catch (e) {
      next(e);
    }
  }
);

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) throw new AppError(400, 'Invalid product id');
    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export const productsRouter = router;
