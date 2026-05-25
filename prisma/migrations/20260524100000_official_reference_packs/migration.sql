-- CreateEnum
CREATE TYPE "OfficialReferencePackStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'NEEDS_REVIEW', 'BLOCKED');

-- CreateTable
CREATE TABLE "OfficialReferencePack" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "OfficialReferencePackStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "summary" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "validationJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialReferencePack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficialReferencePack_kind_version_key" ON "OfficialReferencePack"("kind", "version");

-- CreateIndex
CREATE INDEX "OfficialReferencePack_kind_status_idx" ON "OfficialReferencePack"("kind", "status");

-- CreateIndex
CREATE INDEX "OfficialReferencePack_kind_effectiveFrom_idx" ON "OfficialReferencePack"("kind", "effectiveFrom");

-- CreateIndex
CREATE INDEX "OfficialReferencePack_checksum_idx" ON "OfficialReferencePack"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialReferencePack_one_active_per_kind_idx" ON "OfficialReferencePack"("kind") WHERE "status" = 'ACTIVE';
