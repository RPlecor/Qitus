import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { TaxPackageReferencePayload } from "./official-reference-data.server";

export type TaxPackageKind = "tax_package_2033" | "tax_package_2050";

export class TaxPackageReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  getActiveReference(kind: TaxPackageKind) {
    return this.references.getActiveReference<TaxPackageReferencePayload>(kind);
  }

  assertReady(kind?: TaxPackageKind) {
    if (kind) this.references.validateReferencePack(kind);
    else this.references.assertReferenceReady("generate_tax_package");
  }

  listCases(kind: TaxPackageKind) {
    return this.getActiveReference(kind).payloadJson.cases.map((item) => ({
      ...item,
      completeness: "à compléter" as const,
    }));
  }

  getPackageLabel(kind: TaxPackageKind) {
    return this.getActiveReference(kind).payloadJson.label;
  }

  pickKind(input: { taxRegime?: string | null; vatRegime?: string | null; legalForm?: string | null }) {
    const taxRegime = (input.taxRegime ?? "").toUpperCase();
    if (taxRegime.includes("NORMAL") || taxRegime.includes("2050")) return "tax_package_2050" as const;
    return "tax_package_2033" as const;
  }
}
