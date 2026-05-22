-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('UPLOADED', 'EXTRACTED', 'EXTRACTION_FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AttachmentEntityType" AS ENUM ('TRANSACTION', 'JOURNAL_ENTRY', 'CLOSING_ADJUSTMENT', 'FISCAL_YEAR');

-- CreateEnum
CREATE TYPE "AttachmentRelationType" AS ENUM ('INVOICE', 'RECEIPT', 'BANK_STATEMENT', 'CONTRACT', 'USER_DECISION', 'EXPERT_VALIDATION', 'OTHER');

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'UPLOADED',
    "extractedText" TEXT,
    "extractedJson" JSONB,
    "supplierName" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "amountHt" DECIMAL(12,2),
    "amountVat" DECIMAL(12,2),
    "amountTtc" DECIMAL(12,2),
    "currency" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttachmentLink" (
    "id" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "entityType" "AttachmentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "relationType" "AttachmentRelationType" NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttachmentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_companyId_fiscalYearId_sha256_key" ON "Attachment"("companyId", "fiscalYearId", "sha256");

-- CreateIndex
CREATE INDEX "Attachment_companyId_fiscalYearId_status_idx" ON "Attachment"("companyId", "fiscalYearId", "status");

-- CreateIndex
CREATE INDEX "Attachment_archivedAt_idx" ON "Attachment"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttachmentLink_attachmentId_entityType_entityId_relationType_key" ON "AttachmentLink"("attachmentId", "entityType", "entityId", "relationType");

-- CreateIndex
CREATE INDEX "AttachmentLink_entityType_entityId_idx" ON "AttachmentLink"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AttachmentLink_relationType_idx" ON "AttachmentLink"("relationType");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttachmentLink" ADD CONSTRAINT "AttachmentLink_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
