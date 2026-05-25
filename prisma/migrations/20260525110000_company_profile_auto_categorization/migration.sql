-- Company profile fields used to configure Qitus auto-categorization policy.
ALTER TABLE "Company" ADD COLUMN "hasAccountant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN "accountantEmail" TEXT;
ALTER TABLE "Company" ADD COLUMN "revenueEstimate" TEXT;
