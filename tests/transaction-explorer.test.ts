import { describe, expect, it } from "vitest";
import { businessStatusFor, ruleMatchesTransaction } from "../app/modules/transactions/transaction-explorer.server";

describe("TransactionExplorer", () => {
  it("keeps NEEDS_REVIEW as the single review criterion", () => {
    expect(businessStatusFor({ status: "NEEDS_REVIEW", source: "AI" })).toBe("NEEDS_REVIEW");
    expect(businessStatusFor({ status: "REVIEW_LIGHT", source: "AI" })).toBe("REVIEW_LIGHT");
    expect(businessStatusFor({ status: "AUTO_APPLIED", source: "AI" })).toBe("AUTO_APPLIED");
  });

  it("classifies corrected, confirmed, rule-backed and categorized transactions", () => {
    expect(businessStatusFor({ status: "USER_CONFIRMED", source: "MANUAL" })).toBe("CORRECTED");
    expect(businessStatusFor({ status: "USER_CONFIRMED", source: "VENDOR_LOOKUP" })).toBe("CONFIRMED");
    expect(businessStatusFor({ status: "PROPOSED", source: "VENDOR_LOOKUP" }, true)).toBe("HAS_RULE");
    expect(businessStatusFor({ status: "PROPOSED", source: "VENDOR_LOOKUP" })).toBe("CATEGORIZED");
  });

  it("matches active correction rules against counterparty, normalized label and label", () => {
    const transaction = {
      counterparty: "UBER BV",
      normalizedLabel: "uber trajet client",
      label: "UBER TRAJET CLIENT + REPAS",
    };
    expect(ruleMatchesTransaction({ counterparty: "uber", active: true }, transaction)).toBe(true);
    expect(ruleMatchesTransaction({ counterparty: "sncf", active: true }, transaction)).toBe(false);
    expect(ruleMatchesTransaction({ counterparty: "uber", active: false }, transaction)).toBe(false);
  });
});
