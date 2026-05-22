import { describe, expect, it } from "vitest";
import { FakeCategorizationProvider } from "../app/modules/categorization/ai-provider";

describe("IA categorization provider contract", () => {
  it("returns typed suggestions without network in tests", async () => {
    const provider = new FakeCategorizationProvider();
    const result = await provider.categorize([{
      id: "txn_low",
      date: "2025-03-18",
      label: "VIREMENT REF 789456123",
      normalizedLabel: "virement ref 789456123",
      amount: -45,
      currency: "EUR",
      type: "DEBIT",
    }], {
      companyName: "ACME",
      legalForm: "SASU",
      vatRegime: "FRANCHISE",
      correctionRules: [],
      vendorMappings: [],
    });

    expect(result[0].source).toBe("AI");
    expect(result[0].confidence).toBe("LOW");
  });
});
