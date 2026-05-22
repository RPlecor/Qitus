CREATE TYPE "SharePermission" AS ENUM ('READ_ONLY_REVIEW');

ALTER TABLE "VendorMapping" ADD COLUMN "vatRate" DECIMAL(5,4);
ALTER TABLE "Categorization" ADD COLUMN "vatRate" DECIMAL(5,4);
ALTER TABLE "CorrectionRule" ADD COLUMN "preferredVatRate" DECIMAL(5,4);

CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'READ_ONLY_REVIEW',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "reviewerName" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP(3),

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShareLink_tokenHash_key" ON "ShareLink"("tokenHash");
CREATE INDEX "ShareLink_companyId_fiscalYearId_idx" ON "ShareLink"("companyId", "fiscalYearId");
CREATE INDEX "ShareLink_expiresAt_idx" ON "ShareLink"("expiresAt");
CREATE INDEX "ShareLink_revokedAt_idx" ON "ShareLink"("revokedAt");

ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
