-- CreateEnum
CREATE TYPE "OpenBankingProvider" AS ENUM ('MOCK', 'BRIDGE', 'POWENS', 'GOCARDLESS', 'TINK', 'YAPILY');

-- CreateEnum
CREATE TYPE "BankConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'ERROR', 'REVOKED');

-- CreateEnum
CREATE TYPE "BankFeedSyncStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "OpenBankingProvider" NOT NULL,
    "providerConnectionId" TEXT NOT NULL,
    "status" "BankConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "consentExpiresAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankFeedAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankConnectionId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "ibanMasked" TEXT,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankFeedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankFeedSyncEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalYearId" TEXT,
    "bankConnectionId" TEXT,
    "status" "BankFeedSyncStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "transactionsFetched" INTEGER NOT NULL DEFAULT 0,
    "transactionsImported" INTEGER NOT NULL DEFAULT 0,
    "metadataJson" JSONB,

    CONSTRAINT "BankFeedSyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankConnection_companyId_provider_providerConnectionId_key" ON "BankConnection"("companyId", "provider", "providerConnectionId");

-- CreateIndex
CREATE INDEX "BankConnection_companyId_status_idx" ON "BankConnection"("companyId", "status");

-- CreateIndex
CREATE INDEX "BankConnection_consentExpiresAt_idx" ON "BankConnection"("consentExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BankFeedAccount_bankConnectionId_providerAccountId_key" ON "BankFeedAccount"("bankConnectionId", "providerAccountId");

-- CreateIndex
CREATE INDEX "BankFeedAccount_companyId_status_idx" ON "BankFeedAccount"("companyId", "status");

-- CreateIndex
CREATE INDEX "BankFeedSyncEvent_companyId_fiscalYearId_startedAt_idx" ON "BankFeedSyncEvent"("companyId", "fiscalYearId", "startedAt");

-- CreateIndex
CREATE INDEX "BankFeedSyncEvent_bankConnectionId_idx" ON "BankFeedSyncEvent"("bankConnectionId");

-- CreateIndex
CREATE INDEX "BankFeedSyncEvent_status_idx" ON "BankFeedSyncEvent"("status");

-- AddForeignKey
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankFeedAccount" ADD CONSTRAINT "BankFeedAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankFeedAccount" ADD CONSTRAINT "BankFeedAccount_bankConnectionId_fkey" FOREIGN KEY ("bankConnectionId") REFERENCES "BankConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankFeedSyncEvent" ADD CONSTRAINT "BankFeedSyncEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankFeedSyncEvent" ADD CONSTRAINT "BankFeedSyncEvent_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankFeedSyncEvent" ADD CONSTRAINT "BankFeedSyncEvent_bankConnectionId_fkey" FOREIGN KEY ("bankConnectionId") REFERENCES "BankConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
