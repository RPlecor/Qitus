import { describe, expect, it } from "vitest";
import { renderVatDeclarationSource, resolveDeclarationType } from "../app/modules/vat/vat-declaration-center.server";
import type { CompanyWorkspace } from "../app/modules/company-workspace/company-workspace.server";
import type { VatPosition } from "../app/modules/vat/vat-position-center.server";
import { buildOfficialReferencePacks, type VatReferencePayload } from "../app/modules/official-references/official-reference-data.server";

describe("VatDeclarationCenter", () => {
  it("chooses CA12 for réel simplifié and CA3 for réel normal", () => {
    expect(resolveDeclarationType(workspace({ vatRegime: "REEL_SIMPLIFIE" }))).toBe("CA12");
    expect(resolveDeclarationType(workspace({ vatRegime: "REEL_NORMAL" }))).toBe("CA3");
  });

  it("renders a structured local draft with amounts and controls", () => {
    const source = renderVatDeclarationSource(
      workspace({ vatRegime: "REEL_SIMPLIFIE" }),
      "CA12",
      position(),
      [{ severity: "warning", title: "Déclaration TVA absente", detail: "Générer un brouillon." }],
      (buildOfficialReferencePacks().vat.payloadJson as VatReferencePayload).accounts,
    );

    expect(source).toContain("# Déclaration TVA CA12 - brouillon");
    expect(source).toContain("Brouillon local - non télétransmis");
    expect(source).toContain("| TVA_COLLECTEE | TVA collectée | 200,00 | 44571 |");
    expect(source).toContain("| 0.2 | 1 100,00 | 20,00 | 200,00 | 0,00 | 180,00 |");
    expect(source).toContain("WARNING - Déclaration TVA absente");
  });
});

function workspace(company: Partial<CompanyWorkspace["company"]>): CompanyWorkspace {
  return {
    user: { id: "usr_demo" },
    company: {
      id: "cmp_demo",
      name: "ACME",
      vatRegime: "FRANCHISE",
      vatExigibility: "ENCAISSEMENTS",
      siren: "912345678",
      ...company,
    },
    fiscalYear: { id: "fy_demo", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") },
    bankAccount: { id: "bank_demo" },
    subscription: { status: "ACTIVE_STUB" },
    authMode: "dev",
  } as unknown as CompanyWorkspace;
}

function position(): VatPosition {
  return {
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
    regime: "REEL_SIMPLIFIE",
    exigibility: "ENCAISSEMENTS",
    rows: [],
    totals: { baseHt: 1100, collected: 200, deductible: 20, reverseChargeDue: 0, net: 180 },
    byRate: [{ key: "0.2", baseHt: 1100, deductible: 20, collected: 200, reverseChargeDue: 0, net: 180 }],
    byNature: [{ key: "DOMESTIC_PURCHASE", baseHt: 100, deductible: 20, collected: 0, reverseChargeDue: 0, net: -20 }],
    accounts: [],
  };
}
