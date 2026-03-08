-- Add Product columns that may be missing (saleUnit, allowCustomQuantity, minOrderQuantity, quantityStep)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "saleUnit" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "allowCustomQuantity" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "minOrderQuantity" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "quantityStep" DOUBLE PRECISION;
