-- Add a company-level access layer without removing the legacy Role column.
CREATE TYPE "CompanyStatus" AS ENUM ('OWNER', 'MANAGER', 'EMPLOYEE');

ALTER TABLE "User"
ADD COLUMN "companyStatus" "CompanyStatus" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN "companyRoleId" TEXT;

UPDATE "User" SET "companyStatus" = 'OWNER' WHERE "role" = 'OWNER';
UPDATE "User" SET "companyStatus" = 'MANAGER' WHERE "role" IN ('PARTNER', 'STORE_MANAGER', 'PRODUCTION_MANAGER');

CREATE TABLE "CompanyRole" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPermissionOverride" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyRole_name_key" ON "CompanyRole"("name");
CREATE UNIQUE INDEX "RolePermission_roleId_permission_key" ON "RolePermission"("roleId", "permission");
CREATE INDEX "RolePermission_permission_idx" ON "RolePermission"("permission");
CREATE UNIQUE INDEX "UserPermissionOverride_userId_permission_key" ON "UserPermissionOverride"("userId", "permission");
CREATE INDEX "UserPermissionOverride_permission_idx" ON "UserPermissionOverride"("permission");
CREATE INDEX "User_companyStatus_idx" ON "User"("companyStatus");
CREATE INDEX "User_companyRoleId_idx" ON "User"("companyRoleId");

ALTER TABLE "User" ADD CONSTRAINT "User_companyRoleId_fkey" FOREIGN KEY ("companyRoleId") REFERENCES "CompanyRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CompanyRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
