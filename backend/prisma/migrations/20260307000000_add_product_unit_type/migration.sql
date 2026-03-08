-- Add unitType to Product (piece | kg | meter) for hardware/construction quantity feature
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unitType" TEXT NOT NULL DEFAULT 'piece';
