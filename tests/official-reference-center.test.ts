import { beforeAll, describe, expect, it } from "vitest";
import { OfficialReferenceCenter } from "../app/modules/official-references/official-reference-center.server";
import { VatReferenceCenter } from "../app/modules/official-references/vat-reference-center.server";
import { FecComplianceReferenceCenter } from "../app/modules/official-references/fec-compliance-reference-center.server";
import { TaxPackageReferenceCenter } from "../app/modules/official-references/tax-package-reference-center.server";
import { ClosingAdjustmentReferenceCenter } from "../app/modules/official-references/closing-adjustment-reference-center.server";
import { FixedAssetReferenceCenter } from "../app/modules/official-references/fixed-asset-reference-center.server";
import { EvidenceRequirementPolicyCenter } from "../app/modules/official-references/evidence-requirement-policy-center.server";
import { ImpotsGovReferenceAdapter } from "../app/modules/official-references/official-reference-source-adapters.server";
import { buildOfficialReferencePacks } from "../app/modules/official-references/official-reference-data.server";

describe("OfficialReferenceCenter", () => {
  beforeAll(async () => {
    await new OfficialReferenceCenter().bootstrapEmbeddedReferences();
  });

  it("exposes active validated packs for all beta-critical references", async () => {
    const center = new OfficialReferenceCenter();
    const readiness = await center.getReferenceReadinessAsync();

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

  it("blocks a capability when its reference is not ready", async () => {
    const center = new OfficialReferenceCenter();

    await expect(center.assertReferenceReadyAsync("generate_fec")).resolves.toBeUndefined();
    await expect(center.assertReferenceReadyAsync("generate_vat_declaration")).resolves.toBeUndefined();
    await expect(center.assertReferenceReadyAsync("generate_tax_package")).resolves.toBeUndefined();
  });
});

describe("OfficialReferenceSourceAdapter", () => {
  it("keeps the embedded pack active when the tracked source checksum is unchanged", async () => {
    const pack = buildOfficialReferencePacks().vat;
    const adapter = new ImpotsGovReferenceAdapter(pack);

    const snapshot = await adapter.fetchSnapshot();
    const draft = await adapter.buildDraftPack(snapshot);

    expect(draft.status).toBe("ACTIVE");
    expect(draft.version).toBe(pack.version);
    expect(draft.checksum).toBe(pack.checksum);
  });

  it("creates a review-only draft when an official source checksum changes", async () => {
    const pack = buildOfficialReferencePacks().vat;
    const adapter = new ImpotsGovReferenceAdapter(pack);
    const draft = await adapter.buildDraftPack({
      kind: "vat",
      source: "IMPOTS_GOUV",
      sourceUrl: pack.sourceUrl,
      retrievedAt: new Date().toISOString(),
      checksum: "a".repeat(64),
      title: "TVA source modifiée",
    });

    expect(draft.status).toBe("NEEDS_REVIEW");
    expect(draft.version).toContain("-source-");
    expect(draft.version).not.toBe(pack.version);
  });
});

describe("domain reference centers", () => {
  it("describes TVA rates, natures and expected accounts", async () => {
    const center = new VatReferenceCenter();

    expect((await center.listRateOptions()).map((rate) => rate.value)).toContain("0.20");
    expect((await center.listNatureOptions()).map((nature) => nature.value)).toContain("DOMESTIC_PURCHASE");
    expect(await center.getVatAccounts()).toMatchObject({ deductible: "44566", collected: "44571" });
    expect((await center.validateSelection({ rate: "0.20", nature: "EXEMPT" })).ok).toBe(false);
  });

  it("describes the official FEC columns in order", async () => {
    const columns = await new FecComplianceReferenceCenter().getRequiredColumns();

    expect(columns.slice(0, 5)).toEqual(["JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum"]);
    expect(columns).toContain("Debit");
    expect(columns).toContain("Credit");
  });

  it("keeps missing tax-package cases explicit instead of silently zeroing them", async () => {
    const cases2033 = await new TaxPackageReferenceCenter().listCases("tax_package_2033");

    expect(cases2033.length).toBeGreaterThan(55);
    expect(cases2033.map((taxCase) => taxCase.table)).toContain("2033-G");
    expect(cases2033.every((taxCase) => taxCase.completeness === "à compléter")).toBe(true);
  });

  it("keeps closing adjustments and fixed assets validated against PCG accounts", async () => {
    const closingTypes = await new ClosingAdjustmentReferenceCenter().listTypes();
    const assetFamilies = await new FixedAssetReferenceCenter().listFamilies();

    expect(closingTypes.map((type) => type.kind)).toContain("PREPAID_EXPENSE");
    expect(assetFamilies.find((family) => family.key === "office_it")).toMatchObject({
      assetAccount: "2183",
      amortizationAccount: "2818",
      expenseAccount: "68112",
    });
  });

  it("distinguishes non-blocking evidence gaps from blocking proof requirements", async () => {
    const policy = new EvidenceRequirementPolicyCenter();

    expect((await policy.getRequirementForEntrySource("IMPORT")).level).toBe("to_complete");
    expect((await policy.getWording()).nonBlockingGap).toBe("écriture sans justificatif rattaché");
  });
});
