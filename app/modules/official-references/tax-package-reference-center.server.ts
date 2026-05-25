import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { TaxPackageReferencePayload } from "./official-reference-data.server";

export type TaxPackageKind = "tax_package_2033" | "tax_package_2050";

export class TaxPackageReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  async getActiveReference(kind: TaxPackageKind) {
    return this.references.getActiveReferenceAsync<TaxPackageReferencePayload>(kind);
  }

  async assertReady(kind?: TaxPackageKind) {
    if (kind) await this.references.validateReferencePackAsync(kind);
    else await this.references.assertReferenceReadyAsync("generate_tax_package");
  }

  async listCases(kind: TaxPackageKind) {
    const payload = (await this.getActiveReference(kind)).payloadJson;
    return payload.cases.map((item) => ({
      ...item,
      completeness: "à compléter" as const,
    }));
  }

  async getPackageLabel(kind: TaxPackageKind) {
    return (await this.getActiveReference(kind)).payloadJson.label;
  }

  pickKind(input: { taxRegime?: string | null; vatRegime?: string | null; legalForm?: string | null }) {
    const taxRegime = (input.taxRegime ?? "").toUpperCase();
    if (taxRegime.includes("NORMAL") || taxRegime.includes("2050")) return "tax_package_2050" as const;
    return "tax_package_2033" as const;
  }
}
