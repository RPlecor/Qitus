-- Phase 18 PA connection hardening: provider lifecycle, PA proofs and safe metadata.

ALTER TABLE "EInvoice"
  ADD COLUMN "providerStatus" TEXT,
  ADD COLUMN "providerReceivedAt" TIMESTAMP(3),
  ADD COLUMN "providerStatusSyncedAt" TIMESTAMP(3),
  ADD COLUMN "providerProofJson" JSONB,
  ADD COLUMN "providerMetadataJson" JSONB;

ALTER TABLE "EInvoiceProviderConnection"
  ADD COLUMN "providerCompanyId" TEXT,
  ADD COLUMN "mandateStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "connectionStatus" TEXT,
  ADD COLUMN "lastStatusSyncedAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "capabilitiesJson" JSONB,
  ADD COLUMN "safeMetadataJson" JSONB;

