-- CreateEnum
CREATE TYPE "AnnualClosingRunStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'READY_TO_CLOSE', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "AnnualClosingStepStatus" AS ENUM ('PENDING', 'BLOCKED', 'READY', 'DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "FixedAssetMethod" AS ENUM ('LINEAR');

-- CreateEnum
CREATE TYPE "BankReconciliationStatus" AS ENUM ('DRAFT', 'MATCHED', 'DIFFERENCE');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'LIASSE_FISCALE';
ALTER TYPE "DocumentType" ADD VALUE 'EVIDENCE_BUNDLE';

-- CreateTable
CREATE TABLE "AnnualClosingRun" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "status" "AnnualClosingRunStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "evidenceManifestJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "reopenedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnualClosingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnualClosingStep" (
    "id" TEXT NOT NULL,
    "closingRunId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "AnnualClosingStepStatus" NOT NULL DEFAULT 'PENDING',
    "blockingCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "resultJson" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnualClosingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "FixedAssetMethod" NOT NULL DEFAULT 'LINEAR',
    "usefulLifeYears" INTEGER NOT NULL,
    "depreciationAccount" TEXT NOT NULL,
    "expenseAccount" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "statementBalance" DECIMAL(12,2) NOT NULL,
    "ledgerBalance" DECIMAL(12,2) NOT NULL,
    "difference" DECIMAL(12,2) NOT NULL,
    "status" "BankReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnualClosingRun_fiscalYearId_key" ON "AnnualClosingRun"("fiscalYearId");

-- CreateIndex
CREATE INDEX "AnnualClosingRun_status_idx" ON "AnnualClosingRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AnnualClosingStep_closingRunId_code_key" ON "AnnualClosingStep"("closingRunId", "code");

-- CreateIndex
CREATE INDEX "AnnualClosingStep_status_idx" ON "AnnualClosingStep"("status");

-- CreateIndex
CREATE INDEX "FixedAsset_fiscalYearId_idx" ON "FixedAsset"("fiscalYearId");

-- CreateIndex
CREATE INDEX "FixedAsset_archivedAt_idx" ON "FixedAsset"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BankReconciliation_fiscalYearId_bankAccountId_key" ON "BankReconciliation"("fiscalYearId", "bankAccountId");

-- CreateIndex
CREATE INDEX "BankReconciliation_status_idx" ON "BankReconciliation"("status");

-- AddForeignKey
ALTER TABLE "AnnualClosingRun" ADD CONSTRAINT "AnnualClosingRun_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualClosingStep" ADD CONSTRAINT "AnnualClosingStep_closingRunId_fkey" FOREIGN KEY ("closingRunId") REFERENCES "AnnualClosingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
