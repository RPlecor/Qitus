import { MatchType, type PrismaClient, type VatOperationNature } from "@prisma/client";
import { AccountingRulePackCenter, vendorMappingRuleId } from "../accounting-rules/accounting-rule-pack-center.server";
import { qitusVendorMappingDefinitions } from "../accounting-rules/vendor-mapping-definitions";

export const seedVendorMappings = qitusVendorMappingDefinitions;

export async function seedGlobalVendorMappings(prisma: PrismaClient) {
  const pack = await new AccountingRulePackCenter(prisma).syncSeedRulePack();
  await prisma.vendorMapping.updateMany({
    where: {
      companyId: null,
      active: true,
      OR: [{ rulePackId: { not: pack.id } }, { rulePackId: null }],
    },
    data: { active: false, supersededAt: new Date() },
  });
  for (const [pattern, matchType, accountDebit, accountLabel, vatRate, vatOperationNature] of seedVendorMappings) {
    await prisma.vendorMapping.upsert({
      where: { id: vendorMappingRuleId(pack.version, pattern) },
      update: { pattern, matchType: matchType as MatchType, accountDebit, accountLabel, vatRate, vatOperationNature: vatOperationNature as VatOperationNature, companyId: null, rulePackId: pack.id, source: "qitus-official", active: true, effectiveTo: null, supersededAt: null },
      create: {
        id: vendorMappingRuleId(pack.version, pattern),
        pattern,
        matchType: matchType as MatchType,
        accountDebit,
        accountLabel,
        vatRate,
        vatOperationNature: vatOperationNature as VatOperationNature,
        rulePackId: pack.id,
        source: "qitus-official",
        effectiveFrom: pack.effectiveFrom,
        isAnnualCharge: ["figma", "canva", "axa", "assurance"].includes(pattern),
      },
    });
  }
}

export function vendorMappingSeedId(pattern: string) {
  return `seed-${pattern.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}
