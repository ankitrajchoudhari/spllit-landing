-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" TEXT DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN "adminStatus" TEXT DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN "createdBy" TEXT;

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_adminStatus_idx" ON "User"("adminStatus");
