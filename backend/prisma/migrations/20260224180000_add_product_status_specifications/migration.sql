-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "specifications" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_status_idx" ON "Product"("status");
