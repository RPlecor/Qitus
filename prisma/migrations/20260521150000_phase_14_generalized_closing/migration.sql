ALTER TYPE "ClosingAdjustmentKind" ADD VALUE IF NOT EXISTS 'FNP';
ALTER TYPE "ClosingAdjustmentKind" ADD VALUE IF NOT EXISTS 'FAE';
ALTER TYPE "ClosingAdjustmentKind" ADD VALUE IF NOT EXISTS 'PCA';
ALTER TYPE "ClosingAdjustmentKind" ADD VALUE IF NOT EXISTS 'STOCK_VARIATION';
ALTER TYPE "ClosingAdjustmentKind" ADD VALUE IF NOT EXISTS 'PROVISION';
ALTER TYPE "ClosingAdjustmentKind" ADD VALUE IF NOT EXISTS 'PROVISION_REVERSAL';
ALTER TYPE "ClosingAdjustmentKind" ADD VALUE IF NOT EXISTS 'LOAN_INTEREST_ACCRUAL';
ALTER TYPE "ClosingAdjustmentKind" ADD VALUE IF NOT EXISTS 'PAYROLL_ACCRUAL';
ALTER TYPE "ClosingAdjustmentKind" ADD VALUE IF NOT EXISTS 'VAT_SETTLEMENT';
ALTER TYPE "ClosingAdjustmentKind" ADD VALUE IF NOT EXISTS 'RECONCILIATION_DIFFERENCE';

CREATE TYPE "ClosingWorkpaperStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

CREATE TABLE "ClosingWorkpaper" (
  "id" TEXT NOT NULL,
  "fiscalYearId" TEXT NOT NULL,
  "workpaperKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" "ClosingWorkpaperStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "sourceEntityType" TEXT,
  "sourceEntityId" TEXT,
  "assumptionsJson" JSONB,
  "calculationJson" JSONB,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClosingWorkpaper_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClosingWorkpaper_fiscalYearId_workpaperKey_key" ON "ClosingWorkpaper"("fiscalYearId", "workpaperKey");
CREATE INDEX "ClosingWorkpaper_fiscalYearId_kind_idx" ON "ClosingWorkpaper"("fiscalYearId", "kind");
CREATE INDEX "ClosingWorkpaper_status_idx" ON "ClosingWorkpaper"("status");

ALTER TABLE "ClosingWorkpaper" ADD CONSTRAINT "ClosingWorkpaper_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
