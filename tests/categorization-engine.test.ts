import { describe, expect, it } from "vitest";
import { CategorizationEngine } from "../app/modules/categorization/categorization-engine";
import { FakeCategorizationProvider } from "../app/modules/categorization/ai-provider";
import { qitusVendorMappingDefinitions } from "../app/modules/accounting-rules/vendor-mapping-definitions";

const tx = {
  id: "txn_001",
  date: "2025-01-03",
  label: "OVH CLOUD HOSTING JANVIER",
  normalizedLabel: "ovh cloud hosting janvier",
  counterparty: "OVH SAS",
  amount: -29.99,
  currency: "EUR",
  type: "DEBIT" as const,
};

const accountRoles = {
  bank: { account: "5121", label: "Banque" },
  suspense: { account: "471", label: "Compte d'attente" },
};

describe("CategorizationEngine", () => {
  it("uses deterministic vendor mappings before IA", async () => {
    const engine = new CategorizationEngine(new FakeCategorizationProvider());
    const result = await engine.categorize([tx], {
      companyName: "ACME",
      legalForm: "SASU",
      vatRegime: "FRANCHISE",
      accountRoles,
      correctionRules: [],
      vendorMappings: [{ pattern: "ovh", matchType: "VENDOR_CONTAINS", accountDebit: "6135", accountLabel: "Locations mobilières" }],
    });

    expect(result[0]).toMatchObject({ accountDebit: "6135", source: "VENDOR_LOOKUP", confidence: "HIGH" });
  });

  it("falls back to IA for residual transactions", async () => {
    const engine = new CategorizationEngine(new FakeCategorizationProvider());
    const result = await engine.categorize([{ ...tx, id: "txn_x", counterparty: "UNKNOWN", normalizedLabel: "virement ref 123" }], {
      companyName: "ACME",
      legalForm: "SASU",
      vatRegime: "FRANCHISE",
      accountRoles,
      correctionRules: [],
      vendorMappings: [],
    });

    expect(result[0]).toMatchObject({ transactionId: "txn_x", source: "AI", confidence: "LOW" });
  });

  it("marks contradictory learned correction rules for light review", async () => {
    const engine = new CategorizationEngine(new FakeCategorizationProvider());
    const result = await engine.categorize([tx], {
      companyName: "ACME",
      legalForm: "EI",
      vatRegime: "FRANCHISE",
      accountRoles,
      correctionRules: [{
        counterparty: "OVH",
        preferredAccount: "6135",
        preferredAccountLabel: "Locations mobilières",
        conflict: true,
        sourceFiscalYearId: "fy_previous",
      }],
      vendorMappings: [],
    });

    expect(result[0]).toMatchObject({ source: "CORRECTION_RULE", requiresLightReview: true });
  });

  it("keeps residual transactions in review when IA fails", async () => {
    const engine = new CategorizationEngine({
      async categorize() {
        throw new Error("timeout");
      },
    });
    const result = await engine.categorize([{ ...tx, id: "txn_review", counterparty: "UNKNOWN", normalizedLabel: "virement ref 456" }], {
      companyName: "ACME",
      legalForm: "SASU",
      vatRegime: "FRANCHISE",
      accountRoles,
      correctionRules: [],
      vendorMappings: [],
    });

    expect(result[0]).toMatchObject({
      transactionId: "txn_review",
      accountDebit: "471",
      source: "AI",
      confidence: "LOW",
      rationale: "timeout",
    });
  });

  it("ships a broad enough deterministic mapping base for beta coverage", () => {
    expect(qitusVendorMappingDefinitions.length).toBeGreaterThanOrEqual(100);
  });
});
