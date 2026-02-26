-- AlterTable
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "productId" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_productId_idx" ON "Notification"("productId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_productId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
