import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ROLES = [
  { name: 'OWNER', description: 'Full system access' },
  { name: 'ADMIN', description: 'Inventory, reports, user management' },
  { name: 'CASHIER', description: 'POS and order approval' },
  { name: 'CUSTOMER', description: 'Browse and order products' },
];

async function main() {
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    });
  }

  const ownerRole = await prisma.role.findUnique({ where: { name: 'OWNER' } });
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const cashierRole = await prisma.role.findUnique({ where: { name: 'CASHIER' } });
  const customerRole = await prisma.role.findUnique({ where: { name: 'CUSTOMER' } });

  if (!ownerRole || !adminRole || !cashierRole || !customerRole) throw new Error('Roles not found');

  const hash = (p: string) => bcrypt.hashSync(p, 10);

  const users = [
    { email: 'owner@inventory.com', passwordHash: hash('Owner123!'), fullName: 'System Owner', roleId: ownerRole.id },
    { email: 'admin@inventory.com', passwordHash: hash('Admin123!'), fullName: 'Admin User', roleId: adminRole.id },
    { email: 'cashier@inventory.com', passwordHash: hash('Cashier123!'), fullName: 'Cashier User', roleId: cashierRole.id },
    { email: 'customer@inventory.com', passwordHash: hash('Customer123!'), fullName: 'Customer User', roleId: customerRole.id },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }

  await prisma.systemConfig.upsert({
    where: { key: 'LOW_STOCK_THRESHOLD' },
    update: {},
    create: { key: 'LOW_STOCK_THRESHOLD', value: '10' },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'GCASH_QR_URL' },
    update: {},
    create: { key: 'GCASH_QR_URL', value: '' },
  });

  // Sample products for hardware and construction — categories: Building Materials, Hardware & Fasteners, Tools, Paint & Finishing, Safety Equipment
  const products = [
    { name: 'Portland Cement 50kg', sku: 'CEM-001', category: 'Building Materials', description: '50kg bag', unitPrice: 285 },
    { name: 'Steel Rebar 10mm x 6m', sku: 'STL-001', category: 'Building Materials', description: '10mm x 6m', unitPrice: 185 },
    { name: 'Pine Lumber 2x4 x 8ft', sku: 'LUM-001', category: 'Building Materials', description: '2x4 8ft', unitPrice: 95 },
    { name: 'Sand 1 cu.m', sku: 'BLD-001', category: 'Building Materials', description: 'Fine sand for concrete', unitPrice: 1200 },
    { name: 'Common Nails 2kg', sku: 'HRD-001', category: 'Hardware & Fasteners', description: '2kg box, assorted', unitPrice: 180 },
    { name: 'Wood Screws 100pc', sku: 'HRD-002', category: 'Hardware & Fasteners', description: '3" Phillips', unitPrice: 220 },
    { name: 'Steel Bolts M10 x 50mm', sku: 'HRD-003', category: 'Hardware & Fasteners', description: 'Pack of 20', unitPrice: 95 },
    { name: 'Cordless Drill 18V', sku: 'PWR-001', category: 'Tools', description: '18V lithium, with battery', unitPrice: 3200 },
    { name: 'Hammer', sku: 'HND-001', category: 'Tools', description: '16 oz claw hammer', unitPrice: 340 },
    { name: 'Wrench Set 8-19mm', sku: 'HND-003', category: 'Tools', description: 'Combination wrench set', unitPrice: 520 },
    { name: 'Interior Wall Paint 5L White', sku: 'PNT-001', category: 'Paint & Finishing', description: '5L white', unitPrice: 450 },
    { name: 'Primer 4L', sku: 'PNT-002', category: 'Paint & Finishing', description: 'White primer', unitPrice: 380 },
    { name: 'Safety Helmet', sku: 'SFY-001', category: 'Safety Equipment', description: 'Hard hat, adjustable', unitPrice: 180 },
    { name: 'Safety Goggles', sku: 'SFY-002', category: 'Safety Equipment', description: 'Clear anti-fog', unitPrice: 95 },
    { name: 'Work Gloves Pair', sku: 'SFY-003', category: 'Safety Equipment', description: 'Heavy duty leather', unitPrice: 220 },
  ];

  const createdProducts: { id: number; unitPrice: number }[] = [];
  for (const p of products) {
    const created = await prisma.product.upsert({
      where: { sku: p.sku },
      update: { category: (p as { category?: string }).category },
      create: p as { name: string; sku: string; category?: string; description?: string; unitPrice: number },
    });
    createdProducts.push({ id: created.id, unitPrice: created.unitPrice });
    await prisma.inventory.upsert({
      where: { productId: created.id },
      update: {},
      create: { productId: created.id, quantity: 50, lowStockThreshold: 10 },
    });
  }

  // Sample sales transactions so Analytics has data (past ~30 days)
  const cashier = await prisma.user.findUnique({ where: { email: 'cashier@inventory.com' } });
  if (cashier && createdProducts.length >= 2) {
    const now = new Date();
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const date = new Date(now);
      date.setDate(date.getDate() - dayOffset);
      date.setHours(10 + (dayOffset % 5), 0, 0, 0);
      const numItems = 1 + (dayOffset % 3);
      let total = 0;
      const items: { productId: number; quantity: number; unitPrice: number; subtotal: number }[] = [];
      for (let i = 0; i < numItems; i++) {
        const prod = createdProducts[i % createdProducts.length];
        const qty = 1 + (dayOffset % 5);
        const subtotal = prod.unitPrice * qty;
        total += subtotal;
        items.push({ productId: prod.id, quantity: qty, unitPrice: prod.unitPrice, subtotal });
      }
      const sale = await prisma.saleTransaction.create({
        data: {
          userId: cashier.id,
          total,
          createdAt: date,
          items: {
            create: items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              subtotal: it.subtotal,
            })),
          },
        },
      });
      if (dayOffset === 0) void sale; // use sale to avoid lint
    }
    console.log('Seed: added 30 sample sales transactions for analytics.');
  }

  console.log('Seed completed: roles, users, config, sample products.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
