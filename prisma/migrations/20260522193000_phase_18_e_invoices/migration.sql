-- Phase 18: incoming structured e-invoices and accounting drafts.

ALTER TYPE "EntrySource" ADD VALUE IF NOT EXISTS 'E_INVOICE';
ALTER TYPE "AttachmentEntityType" ADD VALUE IF NOT EXISTS 'E_INVOICE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'E_INVOICE_ACTION';

CREATE TYPE "EInvoiceDirection" AS ENUM ('INCOMING');
CREATE TYPE "EInvoiceSource" AS ENUM ('UPLOAD', 'PROVIDER');
CREATE TYPE "EInvoiceFormat" AS ENUM ('FACTUR_X', 'UBL', 'CII', 'UNKNOWN');
CREATE TYPE "EInvoiceStatus" AS ENUM ('RECEIVED', 'PARSED', 'MATCHED', 'ACCOUNTING_DRAFT', 'ACCOUNTED', 'NEEDS_REVIEW', 'ARCHIVED', 'ERROR');
CREATE TYPE "EInvoiceAccountingDraftStatus" AS ENUM ('DRAFT', 'READY', 'APPROVED', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "EInvoiceProviderStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'ERROR', 'REVOKED');
CREATE TYPE "EInvoiceProviderSyncStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED');

CREATE TABLE "EInvoiceProviderConnection" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerConnectionId" TEXT,
  "status" "EInvoiceProviderStatus" NOT NULL DEFAULT 'PENDING',
  "safeLabel" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EInvoiceProviderConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EInvoice" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fiscalYearId" TEXT NOT NULL,
  "attachmentId" TEXT,
  "providerConnectionId" TEXT,
  "direction" "EInvoiceDirection" NOT NULL DEFAULT 'INCOMING',
  "source" "EInvoiceSource" NOT NULL,
  "sourceId" TEXT,
  "format" "EInvoiceFormat" NOT NULL,
  "status" "EInvoiceStatus" NOT NULL DEFAULT 'RECEIVED',
  "checksum" TEXT NOT NULL,
  "rawXmlStorageKey" TEXT,
  "supplierName" TEXT,
  "supplierSiret" TEXT,
  "buyerName" TEXT,
  "buyerSiret" TEXT,
  "invoiceNumber" TEXT,
  "issueDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "currency" TEXT DEFAULT 'EUR',
  "amountHt" DECIMAL(12,2),
  "amountVat" DECIMAL(12,2),
  "amountTtc" DECIMAL(12,2),
  "vatBreakdownJson" JSONB,
  "linesJson" JSONB,
  "errorMessage" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EInvoiceAccountingDraft" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fiscalYearId" TEXT NOT NULL,
  "eInvoiceId" TEXT NOT NULL,
  "status" "EInvoiceAccountingDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "proposedJournalEntryJson" JSONB NOT NULL,
  "proposedLinksJson" JSONB,
  "requiredActionJson" JSONB,
  "note" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "journalEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EInvoiceAccountingDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EInvoiceProviderSyncEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fiscalYearId" TEXT,
  "provider" TEXT NOT NULL,
  "status" "EInvoiceProviderSyncStatus" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "fetchedCount" INTEGER NOT NULL DEFAULT 0,
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "metadataJson" JSONB,
  CONSTRAINT "EInvoiceProviderSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EInvoiceProviderConnection_companyId_provider_providerConnectionId_key" ON "EInvoiceProviderConnection"("companyId", "provider", "providerConnectionId");
CREATE INDEX "EInvoiceProviderConnection_companyId_status_idx" ON "EInvoiceProviderConnection"("companyId", "status");

CREATE UNIQUE INDEX "EInvoice_companyId_fiscalYearId_checksum_key" ON "EInvoice"("companyId", "fiscalYearId", "checksum");
CREATE UNIQUE INDEX "EInvoice_companyId_fiscalYearId_source_sourceId_key" ON "EInvoice"("companyId", "fiscalYearId", "source", "sourceId");
CREATE INDEX "EInvoice_companyId_fiscalYearId_status_idx" ON "EInvoice"("companyId", "fiscalYearId", "status");
CREATE INDEX "EInvoice_attachmentId_idx" ON "EInvoice"("attachmentId");
CREATE INDEX "EInvoice_providerConnectionId_idx" ON "EInvoice"("providerConnectionId");

CREATE UNIQUE INDEX "EInvoiceAccountingDraft_journalEntryId_key" ON "EInvoiceAccountingDraft"("journalEntryId");
CREATE INDEX "EInvoiceAccountingDraft_companyId_fiscalYearId_status_idx" ON "EInvoiceAccountingDraft"("companyId", "fiscalYearId", "status");
CREATE INDEX "EInvoiceAccountingDraft_eInvoiceId_idx" ON "EInvoiceAccountingDraft"("eInvoiceId");

CREATE INDEX "EInvoiceProviderSyncEvent_companyId_fiscalYearId_startedAt_idx" ON "EInvoiceProviderSyncEvent"("companyId", "fiscalYearId", "startedAt");
CREATE INDEX "EInvoiceProviderSyncEvent_provider_status_idx" ON "EInvoiceProviderSyncEvent"("provider", "status");

ALTER TABLE "EInvoiceProviderConnection" ADD CONSTRAINT "EInvoiceProviderConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "EInvoiceProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EInvoiceAccountingDraft" ADD CONSTRAINT "EInvoiceAccountingDraft_eInvoiceId_fkey" FOREIGN KEY ("eInvoiceId") REFERENCES "EInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EInvoiceAccountingDraft" ADD CONSTRAINT "EInvoiceAccountingDraft_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EInvoiceAccountingDraft" ADD CONSTRAINT "EInvoiceAccountingDraft_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EInvoiceProviderSyncEvent" ADD CONSTRAINT "EInvoiceProviderSyncEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EInvoiceProviderSyncEvent" ADD CONSTRAINT "EInvoiceProviderSyncEvent_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
