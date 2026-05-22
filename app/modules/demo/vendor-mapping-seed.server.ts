import { MatchType, type PrismaClient, type VatOperationNature } from "@prisma/client";

export const seedVendorMappings = [
  ["ovh", "VENDOR_CONTAINS", "6135", "Locations mobilières", 0.2, "DOMESTIC_PURCHASE"],
  ["aws", "VENDOR_CONTAINS", "6135", "Locations mobilières", 0.2, "DOMESTIC_PURCHASE"],
  ["scaleway", "VENDOR_CONTAINS", "6135", "Locations mobilières", 0.2, "DOMESTIC_PURCHASE"],
  ["google workspace", "LABEL_KEYWORD", "6135", "Locations mobilières", 0.2, "DOMESTIC_PURCHASE"],
  ["notion", "VENDOR_CONTAINS", "6135", "Locations mobilières", 0.2, "DOMESTIC_PURCHASE"],
  ["github", "VENDOR_CONTAINS", "6135", "Locations mobilières", 0.2, "DOMESTIC_PURCHASE"],
  ["figma", "VENDOR_CONTAINS", "6135", "Locations mobilières", 0.2, "DOMESTIC_PURCHASE"],
  ["canva", "VENDOR_CONTAINS", "6135", "Locations mobilières", 0.2, "DOMESTIC_PURCHASE"],
  ["anthropic", "VENDOR_CONTAINS", "6135", "Locations mobilières", 0.2, "DOMESTIC_PURCHASE"],
  ["openai", "VENDOR_CONTAINS", "6135", "Locations mobilières", 0.2, "DOMESTIC_PURCHASE"],
  ["slack", "VENDOR_CONTAINS", "6135", "Locations mobilières", 0.2, "DOMESTIC_PURCHASE"],
  ["sncf", "VENDOR_CONTAINS", "6251", "Voyages et déplacements", 0.1, "DOMESTIC_PURCHASE"],
  ["uber", "VENDOR_CONTAINS", "6251", "Voyages et déplacements", 0.1, "DOMESTIC_PURCHASE"],
  ["axa", "VENDOR_CONTAINS", "6161", "Assurances", 0, "EXEMPT"],
  ["assurance", "LABEL_KEYWORD", "6161", "Assurances", 0, "EXEMPT"],
  ["urssaf", "VENDOR_CONTAINS", "6451", "Cotisations URSSAF", 0, "OUT_OF_SCOPE"],
  ["amazon", "VENDOR_CONTAINS", "6064", "Fournitures administratives", 0.2, "DOMESTIC_PURCHASE"],
  ["apple", "VENDOR_CONTAINS", "2183", "Matériel de bureau et informatique", 0.2, "DOMESTIC_PURCHASE"],
  ["wetransfer", "VENDOR_CONTAINS", "6135", "Locations mobilières", 0.2, "DOMESTIC_PURCHASE"],
  ["restaurant", "LABEL_KEYWORD", "6257", "Réceptions", 0.1, "DOMESTIC_PURCHASE"],
  ["repas affaires", "LABEL_KEYWORD", "6257", "Réceptions", 0.1, "DOMESTIC_PURCHASE"],
  ["qonto", "VENDOR_CONTAINS", "627", "Services bancaires", 0, "EXEMPT"],
  ["frais bancaire", "LABEL_KEYWORD", "627", "Services bancaires", 0, "EXEMPT"],
  ["expert comptable", "LABEL_KEYWORD", "6226", "Honoraires", 0.2, "DOMESTIC_PURCHASE"],
  ["honoraires ec", "LABEL_KEYWORD", "6226", "Honoraires", 0.2, "DOMESTIC_PURCHASE"],
  ["remboursement cca", "LABEL_KEYWORD", "4551", "Associés - comptes courants", 0, "OUT_OF_SCOPE"],
  ["greffe", "LABEL_KEYWORD", "6227", "Frais d'actes et de contentieux", 0, "OUT_OF_SCOPE"],
  ["coworking", "LABEL_KEYWORD", "6132", "Locations immobilières", 0.2, "DOMESTIC_PURCHASE"],
  ["mission conseil", "LABEL_KEYWORD", "706", "Prestations de services", 0.2, "DOMESTIC_SALE"],
  ["mission audit", "LABEL_KEYWORD", "706", "Prestations de services", 0.2, "DOMESTIC_SALE"],
  ["stripe payments", "VENDOR_CONTAINS", "5115", "Stripe - compte d'attente", 0, "OUT_OF_SCOPE"],
  ["payout", "LABEL_KEYWORD", "5115", "Stripe - compte d'attente", 0, "OUT_OF_SCOPE"],
] as const;

export async function seedGlobalVendorMappings(prisma: PrismaClient) {
  for (const [pattern, matchType, accountDebit, accountLabel, vatRate, vatOperationNature] of seedVendorMappings) {
    await prisma.vendorMapping.upsert({
      where: { id: vendorMappingSeedId(pattern) },
      update: { pattern, matchType: matchType as MatchType, accountDebit, accountLabel, vatRate, vatOperationNature: vatOperationNature as VatOperationNature, companyId: null, active: true },
      create: {
        id: vendorMappingSeedId(pattern),
        pattern,
        matchType: matchType as MatchType,
        accountDebit,
        accountLabel,
        vatRate,
        vatOperationNature: vatOperationNature as VatOperationNature,
        source: "seed",
        isAnnualCharge: ["figma", "canva", "axa", "assurance"].includes(pattern),
      },
    });
  }
}

export function vendorMappingSeedId(pattern: string) {
  return `seed-${pattern.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}
