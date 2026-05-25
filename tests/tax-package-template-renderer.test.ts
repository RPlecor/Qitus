import { describe, expect, it } from "vitest";
import { VatReferenceCenter } from "../app/modules/official-references/vat-reference-center.server";
import { TaxPackageTemplateRenderer } from "../app/modules/tax-package/tax-package-template-renderer.server";

describe("TaxPackageTemplateRenderer", () => {
  it("renders a structured fiscal package source with cases and VAT summary", async () => {
    const vatAccounts = await new VatReferenceCenter().getVatAccounts();
    const source = await new TaxPackageTemplateRenderer().renderStructuredSource({
      workspace: {
        company: { id: "company_1", name: "ACME Digital", siren: "912345678", legalForm: "SASU" },
        fiscalYear: { id: "fy_1", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") },
      } as never,
      journal: { entriesCount: 12, linesCount: 30, debitTotal: 1200, creditTotal: 1200, balanced: true },
      vat: { deductible: 20, collected: 200, net: 180 },
    });

    expect(source).toContain("Pré-liasse réel simplifié 2033 - préparation vérifiable");
    expect(source).toContain("| A1 | Dénomination | ACME Digital | Profil société |");
    expect(source).toContain(`| ${vatAccounts.deductible} | TVA déductible | 20,00 | Journal comptable |`);
    expect(source).toContain("Préparation vérifiable locale - non télétransmise");
    expect(source).toContain("Version vérifiée : 2033-SD-2026-CERFA-2");
    expect(source).toContain("| 2033A_064 | Disponibilités | à compléter | Journal comptable |");
  });

  it("renders the CERFA case-by-case draft without hiding incomplete cases", () => {
    const source = new TaxPackageTemplateRenderer().renderCerfaDraft({
      generatedAt: "2026-05-24T00:00:00.000Z",
      packageKind: "tax_package_2033",
      packageCode: "2033-SD",
      label: "Pré-liasse réel simplifié 2033",
      millesime: "2026",
      reference: { version: "2033-SD-2026-CERFA-1", sourceUrl: "https://www.impots.gouv.fr/formulaire/2033-sd/liasse-bicsi-regime-rsi-tableaux-ndeg-2033-sd-2033-g-sd" },
      company: { name: "ACME Digital", siren: "912345678", legalForm: "SASU" },
      fiscalYear: { startDate: "2026-01-01", endDate: "2026-12-31" },
      summary: { status: "to_complete", label: "Liasse CERFA à compléter", totalCases: 2, calculated: 1, toComplete: 1, blocked: 0, notApplicable: 0, zeroByAbsence: 0, toReview: 1 },
      tables: [{
        code: "2033-A",
        label: "2033-A",
        cases: [
          { code: "2033A_001", table: "2033-A", label: "Dénomination de l'entreprise", type: "text", value: "ACME Digital", status: "calculée", source: "Profil entreprise", reason: null, accountPrefixes: [], resolution: "calculated", isZeroByAbsence: false, sourceCompleteness: "complete" },
          { code: "2033A_064", table: "2033-A", label: "Disponibilités", type: "amount", value: null, status: "à compléter", source: "Journal comptable", reason: "Solde de bilan à confirmer : Qitus ne dispose pas d'une balance complète.", accountPrefixes: ["51", "53"], resolution: "to_complete", isZeroByAbsence: false, sourceCompleteness: "missing" },
        ],
      }],
    });

    expect(source).toContain("préparation CERFA complète case par case");
    expect(source).toContain("- Cases calculées à 0 faute de mouvement : 0");
    expect(source).toContain("| 2033A_064 | Disponibilités | à compléter | à compléter | Journal comptable | Solde de bilan");
  });
});
