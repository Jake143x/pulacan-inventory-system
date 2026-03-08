-- CreateTable ProductUnit (product_units)
CREATE TABLE IF NOT EXISTS "ProductUnit" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "unitName" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUnit_pkey" PRIMARY KEY ("id")
);

-- AddColumn SaleItem
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "productUnitId" INTEGER;
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "unitName" TEXT;

-- AddColumn OrderItem
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "productUnitId" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "unitName" TEXT;

-- Unique constraint ProductUnit (productId, unitName)
CREATE UNIQUE INDEX IF NOT EXISTS "ProductUnit_productId_unitName_key" ON "ProductUnit"("productId", "unitName");
CREATE INDEX IF NOT EXISTS "ProductUnit_productId_idx" ON "ProductUnit"("productId");

-- AddForeignKey ProductUnit -> Product
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductUnit_productId_fkey') THEN
    ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey SaleItem -> ProductUnit
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaleItem_productUnitId_fkey') THEN
    ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productUnitId_fkey" FOREIGN KEY ("productUnitId") REFERENCES "ProductUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey OrderItem -> ProductUnit
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_productUnitId_fkey') THEN
    ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productUnitId_fkey" FOREIGN KEY ("productUnitId") REFERENCES "ProductUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
