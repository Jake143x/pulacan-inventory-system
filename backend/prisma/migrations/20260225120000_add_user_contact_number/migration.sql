-- Add contactNumber to User if missing (e.g. DB was created before this field existed)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contactNumber" TEXT;
