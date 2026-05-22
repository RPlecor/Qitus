import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../db.server";
import { qitusVendorMappingDefinitions } from "./vendor-mapping-definitions";

const QITUS_RULE_SOURCE = "qitus-official";

export class AccountingRulePackCenter {
  constructor(private readonly db: PrismaClient = prisma) {}

  async buildRulePackFromRegulatoryChanges() {
    const changes = await this.db.regulatoryChange.findMany({
      where: { status: "NEW" },
      include: { sourceSnapshot: true },
      orderBy: { createdAt: "asc" },
    });
    if (changes.length === 0) return this.syncSeedRulePack();

    const hasStructuredChange = changes.some((change) => change.sourceSnapshot.source === "anc_pcg");
    const checksum = checksumJson({
      changes: changes.map((change) => ({ key: change.changeKey, source: change.sourceSnapshot.source })),
      mappings: qitusVendorMappingDefinitions,
    });
    const version = `official-${new Date().toISOString().slice(0, 10)}-${checksum.slice(0, 8)}`;
    const pack = await this.db.accountingRulePack.upsert({
      where: { version },
      update: {
        status: hasStructuredChange ? "ACTIVE" : "NEEDS_REVIEW",
        checksum,
        summary: hasStructuredChange
          ? "Règles Qitus synchronisées depuis sources officielles structurées."
          : "Sources officielles textuelles détectées, conservées pour revue interne.",
        metadataJson: { regulatoryChangeIds: changes.map((change) => change.id), mappingCount: qitusVendorMappingDefinitions.length },
        activatedAt: hasStructuredChange ? new Date() : null,
      },
      create: {
        version,
        status: hasStructuredChange ? "ACTIVE" : "NEEDS_REVIEW",
        source: QITUS_RULE_SOURCE,
        checksum,
        effectiveFrom: new Date(),
        activatedAt: hasStructuredChange ? new Date() : null,
        summary: hasStructuredChange
          ? "Règles Qitus synchronisées depuis sources officielles structurées."
          : "Sources officielles textuelles détectées, conservées pour revue interne.",
        metadataJson: { regulatoryChangeIds: changes.map((change) => change.id), mappingCount: qitusVendorMappingDefinitions.length },
      },
    });

    await this.db.regulatoryChange.updateMany({
      where: { id: { in: changes.map((change) => change.id) } },
      data: { status: "PACKED" },
    });

    if (pack.status === "ACTIVE") await this.activateRulePack(pack.id);
    return pack;
  }

  async syncSeedRulePack() {
    const checksum = checksumJson({ mappings: qitusVendorMappingDefinitions, source: QITUS_RULE_SOURCE });
    const version = `qitus-seed-${checksum.slice(0, 12)}`;
    const pack = await this.db.accountingRulePack.upsert({
      where: { version },
      update: {
        status: "ACTIVE",
        checksum,
        activatedAt: new Date(),
        summary: "Règles globales Qitus initiales.",
        metadataJson: { mappingCount: qitusVendorMappingDefinitions.length, source: "seed" },
      },
      create: {
        version,
        status: "ACTIVE",
        source: QITUS_RULE_SOURCE,
        checksum,
        effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
        activatedAt: new Date(),
        summary: "Règles globales Qitus initiales.",
        metadataJson: { mappingCount: qitusVendorMappingDefinitions.length, source: "seed" },
      },
    });
    await this.activateRulePack(pack.id);
    return pack;
  }

  async activateRulePack(rulePackId: string) {
    const pack = await this.db.accountingRulePack.findUniqueOrThrow({ where: { id: rulePackId } });
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      await tx.accountingRulePack.updateMany({
        where: { status: "ACTIVE", id: { not: pack.id } },
        data: { status: "ARCHIVED" },
      });
      await tx.accountingRulePack.update({
        where: { id: pack.id },
        data: { status: "ACTIVE", activatedAt: now },
      });
      await tx.vendorMapping.updateMany({
        where: {
          companyId: null,
          active: true,
          OR: [{ rulePackId: { not: pack.id } }, { rulePackId: null }],
        },
        data: { active: false, supersededAt: now, effectiveTo: now },
      });
      for (const [pattern, matchType, accountDebit, accountLabel, vatRate, vatOperationNature] of qitusVendorMappingDefinitions) {
        await tx.vendorMapping.upsert({
          where: { id: vendorMappingRuleId(pack.version, pattern) },
          update: {
            pattern,
            matchType,
            accountDebit,
            accountLabel,
            vatRate,
            vatOperationNature,
            rulePackId: pack.id,
            source: QITUS_RULE_SOURCE,
            active: true,
            effectiveFrom: pack.effectiveFrom ?? now,
            effectiveTo: null,
            supersededAt: null,
            isAnnualCharge: ["figma", "canva", "axa", "assurance"].includes(pattern),
          },
          create: {
            id: vendorMappingRuleId(pack.version, pattern),
            pattern,
            matchType,
            accountDebit,
            accountLabel,
            vatRate,
            vatOperationNature,
            rulePackId: pack.id,
            source: QITUS_RULE_SOURCE,
            active: true,
            effectiveFrom: pack.effectiveFrom ?? now,
            isAnnualCharge: ["figma", "canva", "axa", "assurance"].includes(pattern),
          },
        });
      }
    });
    return this.getActiveRulePack();
  }

  async getActiveRulePack() {
    return this.db.accountingRulePack.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { activatedAt: "desc" },
      include: { vendorMappings: true },
    });
  }

  async listRulePacks() {
    return this.db.accountingRulePack.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 25,
      include: { vendorMappings: true },
    });
  }
}

export function vendorMappingRuleId(version: string, pattern: string) {
  return `rule-${version}-${pattern.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`.slice(0, 190);
}

export function checksumJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
