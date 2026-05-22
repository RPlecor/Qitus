CREATE TYPE "ReconciliationRunKind" AS ENUM ('BANK', 'STRIPE', 'THIRD_PARTY', 'SUSPENSE');
CREATE TYPE "ReconciliationRunStatus" AS ENUM ('DRAFT', 'READY', 'BLOCKED', 'COMPLETED');
CREATE TYPE "ReconciliationMatchKind" AS ENUM ('BANK_TRANSACTION_LEDGER', 'STRIPE_PAYOUT', 'THIRD_PARTY', 'SUSPENSE');
CREATE TYPE "ReconciliationMatchStatus" AS ENUM ('AUTO_MATCHED', 'USER_MATCHED', 'UNMATCHED', 'IGNORED', 'DIFFERENCE');
CREATE TYPE "ReconciliationIssueSeverity" AS ENUM ('BLOCKING', 'WARNING');
CREATE TYPE "ReconciliationIssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');
CREATE TYPE "StripeEventType" AS ENUM ('CHARGE', 'FEE', 'REFUND', 'DISPUTE', 'PAYOUT');

CREATE TABLE "ReconciliationRun" (
  "id" TEXT NOT NULL,
  "fiscalYearId" TEXT NOT NULL,
  "kind" "ReconciliationRunKind" NOT NULL,
  "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'DRAFT',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationMatch" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "kind" "ReconciliationMatchKind" NOT NULL,
  "leftEntityType" TEXT NOT NULL,
  "leftEntityId" TEXT NOT NULL,
  "rightEntityType" TEXT,
  "rightEntityId" TEXT,
  "status" "ReconciliationMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
  "amountDifference" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "dateDifferenceDays" INTEGER NOT NULL DEFAULT 0,
  "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReconciliationMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationIssue" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "issueKey" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "severity" "ReconciliationIssueSeverity" NOT NULL,
  "status" "ReconciliationIssueStatus" NOT NULL DEFAULT 'OPEN',
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReconciliationIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fiscalYearId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "eventType" "StripeEventType" NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "grossAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "feeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "payoutId" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripePayout" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fiscalYearId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "arrivalDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "status" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripePayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReconciliationRun_fiscalYearId_kind_key" ON "ReconciliationRun"("fiscalYearId", "kind");
CREATE INDEX "ReconciliationRun_status_idx" ON "ReconciliationRun"("status");
CREATE INDEX "ReconciliationMatch_runId_status_idx" ON "ReconciliationMatch"("runId", "status");
CREATE INDEX "ReconciliationMatch_leftEntityType_leftEntityId_idx" ON "ReconciliationMatch"("leftEntityType", "leftEntityId");
CREATE INDEX "ReconciliationMatch_rightEntityType_rightEntityId_idx" ON "ReconciliationMatch"("rightEntityType", "rightEntityId");
CREATE UNIQUE INDEX "ReconciliationIssue_runId_issueKey_key" ON "ReconciliationIssue"("runId", "issueKey");
CREATE INDEX "ReconciliationIssue_status_idx" ON "ReconciliationIssue"("status");
CREATE INDEX "ReconciliationIssue_code_idx" ON "ReconciliationIssue"("code");
CREATE UNIQUE INDEX "StripeEvent_fiscalYearId_sourceId_key" ON "StripeEvent"("fiscalYearId", "sourceId");
CREATE INDEX "StripeEvent_companyId_fiscalYearId_eventType_idx" ON "StripeEvent"("companyId", "fiscalYearId", "eventType");
CREATE INDEX "StripeEvent_payoutId_idx" ON "StripeEvent"("payoutId");
CREATE UNIQUE INDEX "StripePayout_fiscalYearId_sourceId_key" ON "StripePayout"("fiscalYearId", "sourceId");
CREATE INDEX "StripePayout_companyId_fiscalYearId_status_idx" ON "StripePayout"("companyId", "fiscalYearId", "status");

ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationIssue" ADD CONSTRAINT "ReconciliationIssue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
