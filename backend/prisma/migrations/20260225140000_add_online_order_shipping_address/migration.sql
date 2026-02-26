-- Add shipping address columns to OnlineOrder if missing
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "streetAddress" TEXT;
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "barangay" TEXT;
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "province" TEXT;
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "zipCode" TEXT;
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "landmark" TEXT;
