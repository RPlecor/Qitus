-- CreateEnum
CREATE TYPE "AccountingIssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateTable
CREATE TABLE "AccountingIssueResolution" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "controlCode" TEXT NOT NULL,
    "status" "AccountingIssueStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "ignoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingIssueResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingIssueResolution_fiscalYearId_issueKey_key" ON "AccountingIssueResolution"("fiscalYearId", "issueKey");

-- CreateIndex
CREATE INDEX "AccountingIssueResolution_fiscalYearId_controlCode_idx" ON "AccountingIssueResolution"("fiscalYearId", "controlCode");

-- CreateIndex
CREATE INDEX "AccountingIssueResolution_status_idx" ON "AccountingIssueResolution"("status");

-- AddForeignKey
ALTER TABLE "AccountingIssueResolution" ADD CONSTRAINT "AccountingIssueResolution_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
