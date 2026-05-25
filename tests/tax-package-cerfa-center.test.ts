import { describe, expect, it } from "vitest";
import { TaxPackageCerfaCenter } from "../app/modules/tax-package/tax-package-cerfa-center.server";

describe("TaxPackageCerfaCenter", () => {
  it("produces a case-by-case CERFA draft with calculated, incomplete and computed cases", async () => {
    const center = new TaxPackageCerfaCenter(
      {
        async assertReady() {},
        pickKind() { return "tax_package_2033"; },
        async getActiveReference() {
          return {
            version: "2033-SD-2026-CERFA-1",
            sourceUrl: "https://www.impots.gouv.fr/formulaire/2033-sd/liasse-bicsi-regime-rsi-tableaux-ndeg-2033-sd-2033-g-sd",
            payloadJson: {
              packageCode: "2033-SD",
              label: "Pré-liasse réel simplifié 2033",
              tables: ["2033-A", "2033-B"],
              cases: [
                { table: "2033-A", code: "2033A_001", label: "Dénomination", type: "text", requiredSource: "profile" },
                { table: "2033-A", code: "2033A_064", label: "Disponibilités", type: "amount", requiredSource: "journal", accountPrefixes: ["51"], balanceSide: "debit" },
                { table: "2033-A", code: "2033A_164", label: "Dettes fournisseurs", type: "amount", requiredSource: "journal", accountPrefixes: ["40"], balanceSide: "credit" },
                { table: "2033-B", code: "2033B_312", label: "Résultat comptable", type: "amount", requiredSource: "computed", formula: "classe_7 - classe_6", accountPrefixes: [], balanceSide: "credit" },
              ],
            },
          };
        },
      } as never,
      { async getAuditSummary() { return { status: "exportable" }; } } as never,
      { async listLineBalances() {
        return new Map([
          ["5121", { debit: 1200, credit: 0, count: 1 }],
          ["707", { debit: 0, credit: 1000, count: 1 }],
          ["607", { debit: 200, credit: 0, count: 1 }],
        ]);
      } } as never
    );

    const draft = await center.buildDraft(workspace());

    expect(draft.summary).toMatchObject({ totalCases: 4, calculated: 3, toComplete: 1, blocked: 0, status: "to_complete" });
    expect(flatCases(draft).find((taxCase) => taxCase.code === "2033A_064")).toMatchObject({ value: 1200, status: "calculée" });
    expect(flatCases(draft).find((taxCase) => taxCase.code === "2033A_164")).toMatchObject({ value: null, status: "à compléter" });
    expect(flatCases(draft).find((taxCase) => taxCase.code === "2033B_312")).toMatchObject({ value: 800, status: "calculée" });
  });

  it("blocks journal-sourced cases when the journal is not exportable", async () => {
    const center = new TaxPackageCerfaCenter(
      {
        async assertReady() {},
        pickKind() { return "tax_package_2033"; },
        async getActiveReference() {
          return {
            version: "2033-SD-2026-CERFA-1",
            sourceUrl: "https://example.test",
            payloadJson: {
              packageCode: "2033-SD",
              label: "Pré-liasse réel simplifié 2033",
              tables: ["2033-A"],
              cases: [{ table: "2033-A", code: "2033A_064", label: "Disponibilités", type: "amount", requiredSource: "journal", accountPrefixes: ["51"], balanceSide: "debit" }],
            },
          };
        },
      } as never,
      { async getAuditSummary() { return { status: "needs_attention" }; } } as never,
      { async listLineBalances() { return new Map([["5121", { debit: 1200, credit: 0, count: 1 }]]); } } as never
    );

    const draft = await center.buildDraft(workspace());

    expect(draft.summary.status).toBe("blocked");
    expect(flatCases(draft)[0]).toMatchObject({ status: "bloquée", reason: "Le journal doit être exportable avant calcul." });
  });

  it("calculates income statement empty movements as reliable zero", async () => {
    const center = new TaxPackageCerfaCenter(
      referenceWithCases([
        { table: "2033-B", code: "2033B_209", label: "Ventes de marchandises", type: "amount", requiredSource: "journal", accountPrefixes: ["707"], balanceSide: "credit", emptyBehavior: "zero_if_no_movement", calculationFamily: "income_statement" },
        { table: "2033-B", code: "2033B_312", label: "Résultat comptable", type: "amount", requiredSource: "computed", formula: "classe_7 - classe_6", accountPrefixes: [], balanceSide: "credit", emptyBehavior: "zero_if_no_movement", calculationFamily: "income_statement" },
      ]) as never,
      { async getAuditSummary() { return { status: "exportable" }; } } as never,
      { async listLineBalances() { return new Map(); } } as never
    );

    const cases = flatCases(await center.buildDraft(workspace()));

    expect(cases[0]).toMatchObject({ value: 0, status: "calculée", resolution: "zero_by_absence", isZeroByAbsence: true });
    expect(cases[1]).toMatchObject({ value: 0, status: "calculée", resolution: "zero_by_absence", isZeroByAbsence: true });
  });

  it("keeps balance sheet empty balances to complete unless the balance source is complete", async () => {
    const center = new TaxPackageCerfaCenter(
      referenceWithCases([
        { table: "2033-A", code: "2033A_164", label: "Dettes fournisseurs", type: "amount", requiredSource: "journal", accountPrefixes: ["40"], balanceSide: "credit", emptyBehavior: "zero_if_balance_source_complete", calculationFamily: "balance_sheet" },
      ]) as never,
      { async getAuditSummary() { return { status: "exportable" }; } } as never,
      { async listLineBalances() { return new Map(); } } as never
    );

    const taxCase = flatCases(await center.buildDraft(workspace()))[0];

    expect(taxCase).toMatchObject({
      value: null,
      status: "à compléter",
      resolution: "to_complete",
      reason: "Solde de bilan à confirmer : Qitus ne dispose pas d'une balance complète.",
    });
  });

  it("keeps manual tax cases to complete and supports non applicable cases", async () => {
    const center = new TaxPackageCerfaCenter(
      referenceWithCases([
        { table: "2033-D", code: "2033D_500", label: "Plus-values à court terme", type: "amount", requiredSource: "manual", emptyBehavior: "manual_if_absent", calculationFamily: "tax_adjustment" },
        { table: "2033-G", code: "2033G_800", label: "Filiales et participations", type: "text", requiredSource: "manual", emptyBehavior: "not_applicable_if_absent", calculationFamily: "manual" },
      ]) as never,
      { async getAuditSummary() { return { status: "exportable" }; } } as never,
      { async listLineBalances() { return new Map(); } } as never
    );

    const cases = flatCases(await center.buildDraft(workspace()));

    expect(cases[0]).toMatchObject({ value: null, status: "à compléter", resolution: "to_complete" });
    expect(cases[1]).toMatchObject({ value: null, status: "non applicable", resolution: "not_applicable" });
  });
});

function flatCases(draft: Awaited<ReturnType<TaxPackageCerfaCenter["buildDraft"]>>) {
  return draft.tables.flatMap((table) => table.cases);
}

function workspace() {
  return {
    company: { name: "ACME", siren: "912345678", legalForm: "SASU", incomeRegime: "REEL_SIMPLIFIE", vatRegime: "FRANCHISE" },
    fiscalYear: { id: "fy_1", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
  } as never;
}

function referenceWithCases(cases: Array<Record<string, unknown>>) {
  return {
    async assertReady() {},
    pickKind() { return "tax_package_2033"; },
    async getActiveReference() {
      return {
        version: "2033-SD-2026-CERFA-2",
        sourceUrl: "https://example.test",
        payloadJson: {
          packageCode: "2033-SD",
          label: "Pré-liasse réel simplifié 2033",
          tables: [...new Set(cases.map((taxCase) => String(taxCase.table)))],
          cases,
        },
      };
    },
  };
}
