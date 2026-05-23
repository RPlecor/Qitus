CREATE TYPE "CategorizationValidationStatus" AS ENUM ('NOT_VALIDATED', 'VALIDATED', 'NEEDS_REVIEW', 'BLOCKED');

ALTER TABLE "Categorization"
  ADD COLUMN "rulePackId" TEXT,
  ADD COLUMN "chartVersion" TEXT,
  ADD COLUMN "validationStatus" "CategorizationValidationStatus" NOT NULL DEFAULT 'NOT_VALIDATED',
  ADD COLUMN "validationReasonsJson" JSONB,
  ADD COLUMN "validatedAt" TIMESTAMP(3);

CREATE INDEX "Categorization_validationStatus_idx" ON "Categorization"("validationStatus");
CREATE INDEX "Categorization_chartVersion_idx" ON "Categorization"("chartVersion");
