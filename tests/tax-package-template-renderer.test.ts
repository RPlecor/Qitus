import { describe, expect, it } from "vitest";
import { TaxPackageTemplateRenderer } from "../app/modules/tax-package/tax-package-template-renderer.server";

describe("TaxPackageTemplateRenderer", () => {
  it("renders a structured fiscal package source with cases and VAT summary", () => {
    const source = new TaxPackageTemplateRenderer().renderStructuredSource({
      workspace: {
        company: { id: "company_1", name: "ACME Digital", siren: "912345678", legalForm: "SASU" },
        fiscalYear: { id: "fy_1", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") },
      } as never,
      journal: { entriesCount: 12, linesCount: 30, debitTotal: 1200, creditTotal: 1200, balanced: true },
      vat: { deductible: 20, collected: 200, net: 180 },
    });

    expect(source).toContain("Liasse fiscale 2033 - brouillon structuré");
    expect(source).toContain("| A1 | Dénomination | ACME Digital | Profil société |");
    expect(source).toContain("| 44566 | TVA déductible | 20,00 | JournalLine |");
    expect(source).toContain("Brouillon local - non télétransmis");
  });
});
