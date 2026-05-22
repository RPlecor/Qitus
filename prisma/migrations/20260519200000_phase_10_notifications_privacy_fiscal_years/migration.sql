-- Phase 10: notifications, privacy requests and fiscal-year navigation support.

CREATE TYPE "NotificationType" AS ENUM (
  'TRANSACTION_REVIEW',
  'IMPORT_STATUS',
  'DOCUMENT_STALE',
  'VAT_ALERT',
  'FISCAL_DEADLINE',
  'REGULATORY_FRESHNESS',
  'CLOSING_BLOCKER',
  'USAGE_LIMIT'
);

CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKING');

CREATE TYPE "PrivacyRequestKind" AS ENUM ('EXPORT', 'SOFT_DELETE', 'ANONYMIZATION', 'PURGE');

CREATE TYPE "PrivacyRequestStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'DONE', 'FAILED');

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "anonymizedAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "anonymizedAt" TIMESTAMP(3);
ALTER TABLE "ActivityLog" ADD COLUMN "fiscalYearId" TEXT;

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fiscalYearId" TEXT NOT NULL,
  "userId" TEXT,
  "type" "NotificationType" NOT NULL,
  "severity" "NotificationSeverity" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "kind" "PrivacyRequestKind" NOT NULL,
  "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "metadataJson" JSONB,

  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_companyId_fiscalYearId_dedupeKey_key" ON "Notification"("companyId", "fiscalYearId", "dedupeKey");
CREATE INDEX "Notification_companyId_fiscalYearId_dismissedAt_idx" ON "Notification"("companyId", "fiscalYearId", "dismissedAt");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_type_idx" ON "Notification"("type");
CREATE INDEX "Notification_severity_idx" ON "Notification"("severity");
CREATE INDEX "PrivacyRequest_userId_companyId_idx" ON "PrivacyRequest"("userId", "companyId");
CREATE INDEX "PrivacyRequest_kind_status_idx" ON "PrivacyRequest"("kind", "status");
CREATE INDEX "PrivacyRequest_requestedAt_idx" ON "PrivacyRequest"("requestedAt");
CREATE INDEX "ActivityLog_companyId_fiscalYearId_idx" ON "ActivityLog"("companyId", "fiscalYearId");
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
