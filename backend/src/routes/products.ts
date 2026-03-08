import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { resolveProductImage } from '../lib/imageUrl.js';

const router = Router();

router.get('/categories', async (req, res, next) => {
  try {
    const shop = (req.query.shop as string) === 'true';
    const where: { category?: { not: null }; status?: string } = { category: { not: null } };
    if (shop) {
      where.status = 'active';
      // List categories for all active products (not only in-stock)
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
      OR?: Array<
        | { name: { contains: string; mode?: 'insensitive' }; sku?: { contains: string; mode?: 'insensitive' } }
        | { sku: { contains: string; mode?: 'insensitive' }; name?: { contains: string; mode?: 'insensitive' } }
      >;
      category?: string;
      status?: string;
    } = {};
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }];
    if (category) where.category = category;
    if (shop) {
      where.status = 'active';
      // Return all active products; frontend shows "Out of stock" when quantity is 0
    }
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: { inventory: true, productUnits: true },
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
    ]);
    res.json({
      data: products.map(resolveProductImage),
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
      include: { inventory: true, productUnits: true },
    });
    if (!product) throw new AppError(404, 'Product not found');
    res.json(resolveProductImage(product));
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
  body('unitType').optional().trim().isIn(['piece', 'kg', 'meter']),
  body('initialQuantity').optional().isFloat({ min: 0 }),
  body('lowStockThreshold').optional().isInt({ min: 0 }),
  body('reorderLevel').optional().isInt({ min: 0 }),
  body('reorderQuantity').optional().isInt({ min: 0 }),
  body('saleUnit').optional().trim().isIn(['piece', 'kg', 'meter', 'sheet', 'box', 'sack', 'roll', 'sqm']),
  body('allowCustomQuantity').optional().isBoolean(),
  body('minOrderQuantity').optional().isFloat({ min: 0 }),
  body('quantityStep').optional().isFloat({ min: 0 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
      const { name, sku, category: cat, description, unitPrice, imageUrl: imgUrl, status: st, specifications: specs, initialQuantity = 0, lowStockThreshold, reorderLevel, reorderQuantity, unitType, saleUnit, allowCustomQuantity, minOrderQuantity, quantityStep } = req.body;
      const status = st === 'inactive' ? 'inactive' : 'active';
      const uType = unitType === 'kg' || unitType === 'meter' ? unitType : 'piece';
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
          unitType: uType,
          saleUnit: saleUnit || (uType !== 'piece' ? uType : null),
          allowCustomQuantity: allowCustomQuantity === true || uType !== 'piece',
          minOrderQuantity: minOrderQuantity != null ? Number(minOrderQuantity) : null,
          quantityStep: quantityStep != null ? Number(quantityStep) : (uType !== 'piece' ? 0.01 : null),
        },
      });
      await prisma.inventory.create({
        data: {
          productId: product.id,
          quantity: Number(initialQuantity),
          lowStockThreshold: Number(lowStockThreshold ?? process.env.LOW_STOCK_THRESHOLD_DEFAULT ?? 10),
          reorderLevel: Number(reorderLevel ?? lowStockThreshold ?? 10),
          reorderQuantity: Number(reorderQuantity ?? 100),
        },
      });
      const withInv = await prisma.product.findUnique({
        where: { id: product.id },
        include: { inventory: true },
      });
      res.status(201).json(resolveProductImage(withInv!));
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
  body('unitType').optional().trim().isIn(['piece', 'kg', 'meter']),
  body('saleUnit').optional().trim().isIn(['piece', 'kg', 'meter', 'sheet', 'box', 'sack', 'roll', 'sqm']),
  body('allowCustomQuantity').optional().isBoolean(),
  body('minOrderQuantity').optional().isFloat({ min: 0 }),
  body('quantityStep').optional().isFloat({ min: 0 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
      const id = Number(req.params?.id);
      if (!id) throw new AppError(400, 'Invalid product id');
      const { name, sku, category: cat, description, unitPrice, imageUrl: imgUrl, status: st, specifications: specs, unitType, saleUnit, allowCustomQuantity, minOrderQuantity, quantityStep } = req.body;
      const update: Record<string, unknown> = {};
      if (name !== undefined) update.name = name;
      if (sku !== undefined) update.sku = sku || null;
      if (cat !== undefined) update.category = cat || null;
      if (description !== undefined) update.description = description || null;
      if (specs !== undefined) update.specifications = specs || null;
      if (unitPrice !== undefined) update.unitPrice = Number(unitPrice);
      if (imgUrl !== undefined) update.imageUrl = imgUrl || null;
      if (st !== undefined) update.status = st === 'inactive' ? 'inactive' : 'active';
      if (unitType !== undefined) {
        update.unitType = unitType === 'kg' || unitType === 'meter' ? unitType : 'piece';
        if (update.unitType !== 'piece') {
          update.saleUnit = saleUnit || update.unitType;
          update.allowCustomQuantity = true;
        }
      }
      if (saleUnit !== undefined) update.saleUnit = saleUnit || null;
      if (allowCustomQuantity !== undefined) update.allowCustomQuantity = allowCustomQuantity === true;
      if (minOrderQuantity !== undefined) update.minOrderQuantity = minOrderQuantity == null || minOrderQuantity === '' ? null : Number(minOrderQuantity);
      if (quantityStep !== undefined) update.quantityStep = quantityStep == null || quantityStep === '' ? null : Number(quantityStep);
      const product = await prisma.product.update({
        where: { id },
        data: update,
        include: { inventory: true },
      });
      res.json(resolveProductImage(product));
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

/** Add a purchase unit to a product (Admin). */
router.post(
  '/:id/units',
  body('unitName').trim().notEmpty().isLength({ max: 50 }),
  body('price').isFloat({ min: 0 }),
  body('stock').optional().isFloat({ min: 0 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(400, errors.array()[0]?.msg ?? 'Validation failed');
      const productId = Number(req.params.id);
      if (!productId) throw new AppError(400, 'Invalid product id');
      const { unitName, price, stock } = req.body;
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) throw new AppError(404, 'Product not found');
      const unit = await prisma.productUnit.create({
        data: {
          productId,
          unitName: String(unitName).trim(),
          price: Number(price),
          stock: Number(stock ?? 0),
        },
      });
      const withUnits = await prisma.product.findUnique({
        where: { id: productId },
        include: { inventory: true, productUnits: true },
      });
      res.status(201).json({ unit, product: resolveProductImage(withUnits!) });
    } catch (e) {
      next(e);
    }
  }
);

/** Update a product unit (Admin). */
router.patch(
  '/:productId/units/:unitId',
  body('unitName').optional().trim().notEmpty().isLength({ max: 50 }),
  body('price').optional().isFloat({ min: 0 }),
  body('stock').optional().isFloat({ min: 0 }),
  async (req, res, next) => {
    try {
      const productId = Number(req.params.productId);
      const unitId = Number(req.params.unitId);
      if (!productId || !unitId) throw new AppError(400, 'Invalid id');
      const update: Record<string, unknown> = {};
      if (req.body.unitName !== undefined) update.unitName = String(req.body.unitName).trim();
      if (req.body.price !== undefined) update.price = Number(req.body.price);
      if (req.body.stock !== undefined) update.stock = Number(req.body.stock);
      await prisma.productUnit.update({ where: { id: unitId, productId }, data: update });
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { inventory: true, productUnits: true },
      });
      res.json(resolveProductImage(product!));
    } catch (e) {
      next(e);
    }
  }
);

/** Delete a product unit (Admin). */
router.delete('/:productId/units/:unitId', async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const unitId = Number(req.params.unitId);
    if (!productId || !unitId) throw new AppError(400, 'Invalid id');
    await prisma.productUnit.delete({ where: { id: unitId, productId } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export const productsRouter = router;
