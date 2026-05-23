import { describe, expect, it } from "vitest";
import { CategorizationTrustPolicy } from "../app/modules/accounting-reference/categorization-trust-policy.server";
import type { AccountingAssignmentValidationResult } from "../app/modules/accounting-reference/accounting-assignment-validation-policy.server";
import type { CategorizationSuggestion } from "../app/modules/categorization/types";

const validated: AccountingAssignmentValidationResult = {
  status: "VALIDATED",
  valid: true,
  reviewRequired: false,
  blockingReasons: [],
  warnings: [],
  chartVersion: "ANC-PCG-2026-01-01",
};

const baseSuggestion: CategorizationSuggestion = {
  transactionId: "tx_1",
  accountDebit: "6135",
  accountCredit: "5121",
  journal: "BQ",
  ecritureLabel: "OVH",
  confidence: "HIGH",
  source: "VENDOR_LOOKUP",
};

describe("CategorizationTrustPolicy", () => {
  it("allows deterministic validated mappings to write ledger entries", () => {
    expect(new CategorizationTrustPolicy().classifySuggestion(baseSuggestion, validated)).toMatchObject({
      writable: true,
      reviewRequired: false,
    });
  });

  it("forces AI suggestions into user review even with high confidence", () => {
    expect(new CategorizationTrustPolicy().classifySuggestion({ ...baseSuggestion, source: "AI" }, validated)).toMatchObject({
      writable: false,
      reviewRequired: true,
      reasons: ["Suggestion IA à valider avant création d'écriture."],
    });
  });
});
