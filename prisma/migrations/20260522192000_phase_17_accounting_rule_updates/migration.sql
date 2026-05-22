CREATE TYPE "RegulatoryChangeSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKING');
CREATE TYPE "RegulatoryChangeStatus" AS ENUM ('NEW', 'PACKED', 'IGNORED');
CREATE TYPE "AccountingRulePackStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'NEEDS_REVIEW');
CREATE TYPE "AccountingRuleApplicationStatus" AS ENUM ('AUTO_APPLIED', 'SKIPPED', 'NEEDS_REVIEW');

ALTER TABLE "VendorMapping" ADD COLUMN "rulePackId" TEXT;
ALTER TABLE "VendorMapping" ADD COLUMN "effectiveFrom" TIMESTAMP(3);
ALTER TABLE "VendorMapping" ADD COLUMN "effectiveTo" TIMESTAMP(3);
ALTER TABLE "VendorMapping" ADD COLUMN "supersededAt" TIMESTAMP(3);

CREATE TABLE "RegulatorySourceSnapshot" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checksum" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "rawMetadataJson" JSONB,

    CONSTRAINT "RegulatorySourceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryChange" (
    "id" TEXT NOT NULL,
    "sourceSnapshotId" TEXT NOT NULL,
    "changeKey" TEXT NOT NULL,
    "severity" "RegulatoryChangeSeverity" NOT NULL DEFAULT 'INFO',
    "status" "RegulatoryChangeStatus" NOT NULL DEFAULT 'NEW',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "sourceUrl" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulatoryChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountingRulePack" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "AccountingRulePackStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "summary" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingRulePack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountingRuleApplication" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "rulePackId" TEXT NOT NULL,
    "status" "AccountingRuleApplicationStatus" NOT NULL DEFAULT 'AUTO_APPLIED',
    "appliedAt" TIMESTAMP(3),
    "impactJson" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingRuleApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegulatorySourceSnapshot_source_checksum_key" ON "RegulatorySourceSnapshot"("source", "checksum");
CREATE INDEX "RegulatorySourceSnapshot_source_retrievedAt_idx" ON "RegulatorySourceSnapshot"("source", "retrievedAt");
CREATE UNIQUE INDEX "RegulatoryChange_sourceSnapshotId_changeKey_key" ON "RegulatoryChange"("sourceSnapshotId", "changeKey");
CREATE INDEX "RegulatoryChange_changeKey_idx" ON "RegulatoryChange"("changeKey");
CREATE INDEX "RegulatoryChange_status_idx" ON "RegulatoryChange"("status");
CREATE UNIQUE INDEX "AccountingRulePack_version_key" ON "AccountingRulePack"("version");
CREATE INDEX "AccountingRulePack_status_idx" ON "AccountingRulePack"("status");
CREATE INDEX "AccountingRulePack_effectiveFrom_idx" ON "AccountingRulePack"("effectiveFrom");
CREATE UNIQUE INDEX "AccountingRuleApplication_companyId_fiscalYearId_rulePackId_key" ON "AccountingRuleApplication"("companyId", "fiscalYearId", "rulePackId");
CREATE INDEX "AccountingRuleApplication_companyId_fiscalYearId_status_idx" ON "AccountingRuleApplication"("companyId", "fiscalYearId", "status");
CREATE INDEX "VendorMapping_rulePackId_idx" ON "VendorMapping"("rulePackId");
CREATE INDEX "VendorMapping_effectiveFrom_effectiveTo_idx" ON "VendorMapping"("effectiveFrom", "effectiveTo");

ALTER TABLE "RegulatoryChange" ADD CONSTRAINT "RegulatoryChange_sourceSnapshotId_fkey" FOREIGN KEY ("sourceSnapshotId") REFERENCES "RegulatorySourceSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingRuleApplication" ADD CONSTRAINT "AccountingRuleApplication_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingRuleApplication" ADD CONSTRAINT "AccountingRuleApplication_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingRuleApplication" ADD CONSTRAINT "AccountingRuleApplication_rulePackId_fkey" FOREIGN KEY ("rulePackId") REFERENCES "AccountingRulePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorMapping" ADD CONSTRAINT "VendorMapping_rulePackId_fkey" FOREIGN KEY ("rulePackId") REFERENCES "AccountingRulePack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
