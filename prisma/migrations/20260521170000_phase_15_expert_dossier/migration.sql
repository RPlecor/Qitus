-- Phase 15: expert-comptable dossier snapshots and collaborative review.

CREATE TYPE "DossierSnapshotStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'FINAL');
CREATE TYPE "ExpertReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'READY_FOR_SIGNOFF', 'SIGNED_OFF', 'CANCELLED');
CREATE TYPE "ExpertReviewSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKING');
CREATE TYPE "ExpertReviewItemStatus" AS ENUM ('OPEN', 'ANSWERED', 'RESOLVED', 'WAIVED');
CREATE TYPE "ExpertReviewAuthorType" AS ENUM ('USER', 'EXPERT', 'SYSTEM');

CREATE TABLE "ExpertReviewRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fiscalYearId" TEXT NOT NULL,
  "shareLinkId" TEXT,
  "status" "ExpertReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "reviewerName" TEXT,
  "reviewerEmail" TEXT,
  "summaryJson" JSONB,
  "submittedAt" TIMESTAMP(3),
  "signedOffAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExpertReviewRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpertReviewItem" (
  "id" TEXT NOT NULL,
  "reviewRunId" TEXT NOT NULL,
  "sectionCode" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "severity" "ExpertReviewSeverity" NOT NULL,
  "status" "ExpertReviewItemStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "ExpertReviewItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpertReviewComment" (
  "id" TEXT NOT NULL,
  "reviewItemId" TEXT NOT NULL,
  "authorType" "ExpertReviewAuthorType" NOT NULL,
  "authorName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpertReviewComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DossierSnapshot" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fiscalYearId" TEXT NOT NULL,
  "reviewRunId" TEXT,
  "snapshotKey" TEXT NOT NULL,
  "status" "DossierSnapshotStatus" NOT NULL DEFAULT 'DRAFT',
  "manifestJson" JSONB NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DossierSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExpertReviewRun_companyId_fiscalYearId_status_idx" ON "ExpertReviewRun"("companyId", "fiscalYearId", "status");
CREATE INDEX "ExpertReviewRun_shareLinkId_idx" ON "ExpertReviewRun"("shareLinkId");
CREATE INDEX "ExpertReviewItem_reviewRunId_status_idx" ON "ExpertReviewItem"("reviewRunId", "status");
CREATE INDEX "ExpertReviewItem_sectionCode_idx" ON "ExpertReviewItem"("sectionCode");
CREATE INDEX "ExpertReviewItem_severity_idx" ON "ExpertReviewItem"("severity");
CREATE INDEX "ExpertReviewComment_reviewItemId_createdAt_idx" ON "ExpertReviewComment"("reviewItemId", "createdAt");
CREATE UNIQUE INDEX "DossierSnapshot_fiscalYearId_snapshotKey_key" ON "DossierSnapshot"("fiscalYearId", "snapshotKey");
CREATE INDEX "DossierSnapshot_companyId_fiscalYearId_status_idx" ON "DossierSnapshot"("companyId", "fiscalYearId", "status");
CREATE INDEX "DossierSnapshot_reviewRunId_idx" ON "DossierSnapshot"("reviewRunId");

ALTER TABLE "ExpertReviewRun" ADD CONSTRAINT "ExpertReviewRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpertReviewRun" ADD CONSTRAINT "ExpertReviewRun_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpertReviewRun" ADD CONSTRAINT "ExpertReviewRun_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "ShareLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpertReviewItem" ADD CONSTRAINT "ExpertReviewItem_reviewRunId_fkey" FOREIGN KEY ("reviewRunId") REFERENCES "ExpertReviewRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpertReviewComment" ADD CONSTRAINT "ExpertReviewComment_reviewItemId_fkey" FOREIGN KEY ("reviewItemId") REFERENCES "ExpertReviewItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DossierSnapshot" ADD CONSTRAINT "DossierSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DossierSnapshot" ADD CONSTRAINT "DossierSnapshot_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DossierSnapshot" ADD CONSTRAINT "DossierSnapshot_reviewRunId_fkey" FOREIGN KEY ("reviewRunId") REFERENCES "ExpertReviewRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
