-- CreateEnum
CREATE TYPE "LegalForm" AS ENUM ('AUTO_ENTREPRENEUR', 'EI', 'EURL', 'SASU', 'SARL', 'SAS', 'SA', 'SCI', 'AUTRE');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('IS', 'IR');

-- CreateEnum
CREATE TYPE "VatRegime" AS ENUM ('FRANCHISE', 'REEL_SIMPLIFIE', 'REEL_NORMAL');

-- CreateEnum
CREATE TYPE "FiscalYearStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('CSV_UPLOAD');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PARSING', 'NEEDS_MAPPING', 'CATEGORIZING', 'REVIEW', 'DONE', 'ERROR');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('VENDOR_EXACT', 'VENDOR_CONTAINS', 'LABEL_REGEX', 'LABEL_KEYWORD');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "CategorizationSource" AS ENUM ('CORRECTION_RULE', 'VENDOR_LOOKUP', 'PATTERN_MATCH', 'AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "CategorizationStatus" AS ENUM ('PROPOSED', 'USER_CONFIRMED', 'USER_CORRECTED', 'MANUAL', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('FEC', 'BALANCE', 'BILAN', 'COMPTE_RESULTAT', 'PDF_BUNDLE');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('READY', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalForm" "LegalForm" NOT NULL,
    "siren" TEXT,
    "siret" TEXT,
    "nafCode" TEXT,
    "rcs" TEXT,
    "capital" INTEGER,
    "addressStreet" TEXT,
    "addressPostal" TEXT,
    "addressCity" TEXT,
    "managerFirstName" TEXT,
    "managerLastName" TEXT,
    "managerCivility" TEXT,
    "managerRole" TEXT,
    "corporateTax" "TaxType",
    "vatRegime" "VatRegime" NOT NULL,
    "vatRate" DECIMAL(5,4),
    "incomeRegime" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "FiscalYearStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "iban" TEXT,
    "pcgAccount" TEXT NOT NULL DEFAULT '5121',
    "fecAccount" TEXT NOT NULL DEFAULT '51211',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "sourceType" "ImportSource" NOT NULL DEFAULT 'CSV_UPLOAD',
    "originalFilename" TEXT,
    "storageKey" TEXT,
    "fileFormat" TEXT,
    "fileEncoding" TEXT,
    "fileSeparator" TEXT,
    "detectedColumns" JSONB,
    "columnMapping" JSONB,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "parsedRows" INTEGER NOT NULL DEFAULT 0,
    "categorizedRows" INTEGER NOT NULL DEFAULT 0,
    "reviewRows" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "sourceId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "counterparty" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "type" "TransactionType" NOT NULL,
    "sourceRef" TEXT,
    "sourceCategory" TEXT,
    "notes" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorMapping" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "pattern" TEXT NOT NULL,
    "matchType" "MatchType" NOT NULL,
    "accountDebit" TEXT NOT NULL,
    "accountCredit" TEXT NOT NULL DEFAULT '5121',
    "accountLabel" TEXT,
    "journal" TEXT NOT NULL DEFAULT 'BQ',
    "ecritureLabel" TEXT,
    "isAnnualCharge" BOOLEAN NOT NULL DEFAULT false,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categorization" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountDebit" TEXT,
    "accountDebitLabel" TEXT,
    "accountCredit" TEXT,
    "accountCreditLabel" TEXT,
    "journal" TEXT,
    "ecritureLabel" TEXT,
    "confidence" "Confidence" NOT NULL,
    "source" "CategorizationSource" NOT NULL,
    "aiRationale" TEXT,
    "alternatives" JSONB,
    "status" "CategorizationStatus" NOT NULL,
    "isAnnualCharge" BOOLEAN NOT NULL DEFAULT false,
    "originalAccountDebit" TEXT,
    "originalAccountCredit" TEXT,
    "correctionNote" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionRule" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "preferredAccount" TEXT NOT NULL,
    "preferredAccountLabel" TEXT,
    "condition" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sourceTransactionId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "num" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "journal" TEXT NOT NULL,
    "ref" TEXT,
    "label" TEXT NOT NULL,
    "source" "EntrySource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "accountLabel" TEXT,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "format" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "entriesCount" INTEGER,
    "generatedBy" TEXT NOT NULL,
    "scriptVersion" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'READY',
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_companyId_startDate_endDate_key" ON "FiscalYear"("companyId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Transaction_fiscalYearId_date_idx" ON "Transaction"("fiscalYearId", "date");

-- CreateIndex
CREATE INDEX "Transaction_importId_idx" ON "Transaction"("importId");

-- CreateIndex
CREATE INDEX "VendorMapping_companyId_pattern_idx" ON "VendorMapping"("companyId", "pattern");

-- CreateIndex
CREATE INDEX "VendorMapping_matchType_idx" ON "VendorMapping"("matchType");

-- CreateIndex
CREATE UNIQUE INDEX "Categorization_transactionId_key" ON "Categorization"("transactionId");

-- CreateIndex
CREATE INDEX "JournalEntry_fiscalYearId_date_idx" ON "JournalEntry"("fiscalYearId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_fiscalYearId_num_key" ON "JournalEntry"("fiscalYearId", "num");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorMapping" ADD CONSTRAINT "VendorMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categorization" ADD CONSTRAINT "Categorization_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categorization" ADD CONSTRAINT "Categorization_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionRule" ADD CONSTRAINT "CorrectionRule_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
