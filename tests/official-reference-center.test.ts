import { describe, expect, it } from "vitest";
import { OfficialReferenceCenter } from "../app/modules/official-references/official-reference-center.server";
import { VatReferenceCenter } from "../app/modules/official-references/vat-reference-center.server";
import { FecComplianceReferenceCenter } from "../app/modules/official-references/fec-compliance-reference-center.server";
import { TaxPackageReferenceCenter } from "../app/modules/official-references/tax-package-reference-center.server";
import { ClosingAdjustmentReferenceCenter } from "../app/modules/official-references/closing-adjustment-reference-center.server";
import { FixedAssetReferenceCenter } from "../app/modules/official-references/fixed-asset-reference-center.server";
import { EvidenceRequirementPolicyCenter } from "../app/modules/official-references/evidence-requirement-policy-center.server";

describe("OfficialReferenceCenter", () => {
  it("exposes active validated packs for all beta-critical references", () => {
    const readiness = new OfficialReferenceCenter().getReferenceReadiness();

    expect(readiness.status).toBe("ready");
    expect(readiness.summary.blocked).toBe(0);
    expect(readiness.items.map((item) => item.kind)).toEqual([
      "chart_of_accounts",
      "vat",
      "fec",
      "tax_package_2033",
      "tax_package_2050",
      "closing_adjustments",
      "fixed_assets",
      "evidence",
      "reconciliation",
      "e_invoice",
      "retention",
    ]);
    for (const item of readiness.items) {
      expect(item.version).toBeTruthy();
      expect(item.sourceUrl).toMatch(/^https:\/\//);
      expect(item.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(item.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("blocks a capability when its reference is not ready", () => {
    const center = new OfficialReferenceCenter();

    expect(() => center.assertReferenceReady("generate_fec")).not.toThrow();
    expect(() => center.assertReferenceReady("generate_vat_declaration")).not.toThrow();
    expect(() => center.assertReferenceReady("generate_tax_package")).not.toThrow();
  });
});

describe("domain reference centers", () => {
  it("describes TVA rates, natures and expected accounts", () => {
    const center = new VatReferenceCenter();

    expect(center.listRateOptions().map((rate) => rate.value)).toContain("0.20");
    expect(center.listNatureOptions().map((nature) => nature.value)).toContain("DOMESTIC_PURCHASE");
    expect(center.getVatAccounts()).toMatchObject({ deductible: "44566", collected: "44571" });
    expect(center.validateSelection({ rate: "0.20", nature: "EXEMPT" }).ok).toBe(false);
  });

  it("describes the official FEC columns in order", () => {
    const columns = new FecComplianceReferenceCenter().getRequiredColumns();

    expect(columns.slice(0, 5)).toEqual(["JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum"]);
    expect(columns).toContain("Debit");
    expect(columns).toContain("Credit");
  });

  it("keeps missing tax-package cases explicit instead of silently zeroing them", () => {
    const cases2033 = new TaxPackageReferenceCenter().listCases("tax_package_2033");

    expect(cases2033.length).toBeGreaterThan(5);
    expect(cases2033.every((taxCase) => taxCase.completeness === "à compléter")).toBe(true);
  });

  it("keeps closing adjustments and fixed assets validated against PCG accounts", () => {
    const closingTypes = new ClosingAdjustmentReferenceCenter().listTypes();
    const assetFamilies = new FixedAssetReferenceCenter().listFamilies();

    expect(closingTypes.map((type) => type.kind)).toContain("PREPAID_EXPENSE");
    expect(assetFamilies.find((family) => family.key === "office_it")).toMatchObject({
      assetAccount: "2183",
      amortizationAccount: "2818",
      expenseAccount: "68112",
    });
  });

  it("distinguishes non-blocking evidence gaps from blocking proof requirements", () => {
    const policy = new EvidenceRequirementPolicyCenter();

    expect(policy.getRequirementForEntrySource("IMPORT").level).toBe("to_complete");
    expect(policy.getWording().nonBlockingGap).toBe("écriture sans justificatif rattaché");
  });
});
