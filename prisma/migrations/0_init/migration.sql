-- The demo_tracker schema is provisioned separately by the database administrator.
-- The app login intentionally cannot create schemas or alter other FindIT areas.

-- CreateEnum
CREATE TYPE "demo_tracker"."Role" AS ENUM ('ADMIN', 'REP');

-- CreateEnum
CREATE TYPE "demo_tracker"."UnitStatus" AS ENUM ('AVAILABLE', 'OUT_ON_DEMO', 'SCHEDULED', 'IN_SERVICE');

-- CreateEnum
CREATE TYPE "demo_tracker"."DemoStatus" AS ENUM ('SCHEDULED', 'OUT_ON_DEMO', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "demo_tracker"."ConditionOut" AS ENUM ('NEW', 'USED', 'DAMAGED', 'FOR_SALE');

-- CreateEnum
CREATE TYPE "demo_tracker"."PhotoKind" AS ENUM ('OUT', 'IN');

-- CreateTable
CREATE TABLE "demo_tracker"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "role" "demo_tracker"."Role" NOT NULL DEFAULT 'REP',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_tracker"."EquipmentUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "status" "demo_tracker"."UnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_tracker"."Demo" (
    "id" TEXT NOT NULL,
    "repId" TEXT NOT NULL,
    "customerCompany" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "deliveryAddress" TEXT,
    "pickupAtBranch" BOOLEAN NOT NULL DEFAULT false,
    "deliverToCustomer" BOOLEAN NOT NULL DEFAULT false,
    "customerReturnsToBranch" BOOLEAN NOT NULL DEFAULT false,
    "checkoutDate" TIMESTAMP(3) NOT NULL,
    "expectedReturnDate" TIMESTAMP(3) NOT NULL,
    "unitId" TEXT NOT NULL,
    "conditionOut" "demo_tracker"."ConditionOut" NOT NULL,
    "hoursOut" TEXT NOT NULL,
    "customerIdVerified" BOOLEAN NOT NULL DEFAULT false,
    "outNotes" TEXT,
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "includeResponsibilityRecord" BOOLEAN NOT NULL DEFAULT true,
    "signatureData" TEXT,
    "signatureDate" TIMESTAMP(3),
    "status" "demo_tracker"."DemoStatus" NOT NULL DEFAULT 'SCHEDULED',
    "hoursIn" TEXT,
    "conditionIn" TEXT,
    "returnNotes" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "followUpNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Demo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_tracker"."DemoPhoto" (
    "id" TEXT NOT NULL,
    "demoId" TEXT NOT NULL,
    "kind" "demo_tracker"."PhotoKind" NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_tracker"."SoldRecord" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "customerCompany" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "soldDate" TIMESTAMP(3) NOT NULL,
    "invoiced" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoldRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_tracker"."AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "demo_tracker"."User"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentUnit_serial_key" ON "demo_tracker"."EquipmentUnit"("serial");

-- CreateIndex
CREATE INDEX "Demo_status_idx" ON "demo_tracker"."Demo"("status");

-- CreateIndex
CREATE INDEX "Demo_unitId_idx" ON "demo_tracker"."Demo"("unitId");

-- CreateIndex
CREATE INDEX "Demo_checkoutDate_idx" ON "demo_tracker"."Demo"("checkoutDate");

-- CreateIndex
CREATE INDEX "Demo_expectedReturnDate_idx" ON "demo_tracker"."Demo"("expectedReturnDate");

-- CreateIndex
CREATE INDEX "DemoPhoto_demoId_idx" ON "demo_tracker"."DemoPhoto"("demoId");

-- CreateIndex
CREATE INDEX "SoldRecord_invoiced_idx" ON "demo_tracker"."SoldRecord"("invoiced");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "demo_tracker"."AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "demo_tracker"."AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "demo_tracker"."Demo" ADD CONSTRAINT "Demo_repId_fkey" FOREIGN KEY ("repId") REFERENCES "demo_tracker"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_tracker"."Demo" ADD CONSTRAINT "Demo_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "demo_tracker"."EquipmentUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_tracker"."Demo" ADD CONSTRAINT "Demo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "demo_tracker"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_tracker"."DemoPhoto" ADD CONSTRAINT "DemoPhoto_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "demo_tracker"."Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_tracker"."SoldRecord" ADD CONSTRAINT "SoldRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "demo_tracker"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_tracker"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "demo_tracker"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
