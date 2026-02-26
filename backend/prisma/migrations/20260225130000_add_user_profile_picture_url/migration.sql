-- Add profilePictureUrl to User if missing
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT;
