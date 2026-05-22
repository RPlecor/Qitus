CREATE TYPE "VatExigibility" AS ENUM ('DEBITS', 'ENCAISSEMENTS', 'MIXED');
CREATE TYPE "VatOperationNature" AS ENUM ('DOMESTIC_PURCHASE', 'DOMESTIC_SALE', 'INTRACOM_PURCHASE', 'INTRACOM_SALE', 'REVERSE_CHARGE', 'EXEMPT', 'OUT_OF_SCOPE');
CREATE TYPE "VatDeclarationType" AS ENUM ('CA3', 'CA12');
CREATE TYPE "VatDeclarationStatus" AS ENUM ('DRAFT', 'SUPERSEDED');

ALTER TYPE "DocumentType" ADD VALUE 'TVA_DECLARATION';

ALTER TABLE "Company" ADD COLUMN "vatExigibility" "VatExigibility" NOT NULL DEFAULT 'ENCAISSEMENTS';
ALTER TABLE "VendorMapping" ADD COLUMN "vatOperationNature" "VatOperationNature";
ALTER TABLE "Categorization" ADD COLUMN "vatOperationNature" "VatOperationNature";
ALTER TABLE "CorrectionRule" ADD COLUMN "vatOperationNature" "VatOperationNature";

CREATE TABLE "VatDeclaration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "type" "VatDeclarationType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "VatDeclarationStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceJson" JSONB NOT NULL,
    "amountsJson" JSONB NOT NULL,
    "controlsJson" JSONB NOT NULL,
    "documentId" TEXT,
    "generatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VatDeclaration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VatDeclaration_companyId_fiscalYearId_status_idx" ON "VatDeclaration"("companyId", "fiscalYearId", "status");
CREATE INDEX "VatDeclaration_type_periodStart_periodEnd_idx" ON "VatDeclaration"("type", "periodStart", "periodEnd");

ALTER TABLE "VatDeclaration" ADD CONSTRAINT "VatDeclaration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VatDeclaration" ADD CONSTRAINT "VatDeclaration_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VatDeclaration" ADD CONSTRAINT "VatDeclaration_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
