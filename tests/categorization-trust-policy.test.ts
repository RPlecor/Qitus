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

  it("keeps AI suggestions in review without an auto-apply decision", () => {
    expect(new CategorizationTrustPolicy().classifySuggestion({ ...baseSuggestion, source: "AI" }, validated)).toMatchObject({
      writable: false,
      reviewRequired: true,
      categorizationStatus: "NEEDS_REVIEW",
      reasons: ["Suggestion IA à relire avant création d'écriture."],
    });
  });

  it("allows auto-applied AI suggestions to write without marking them confirmed", () => {
    expect(new CategorizationTrustPolicy().classifySuggestion({ ...baseSuggestion, source: "AI" }, validated, {
      autoApplyDecision: {
        status: "AUTO_APPLIED",
        writable: true,
        userFacingResolution: "auto_applied",
        reasons: ["Même compte que l'historique fournisseur."],
        audit: {
          supplierHistory: { supplierKey: "orange", coherentMatches: 2, contradictoryUserDecisions: 0, medianAmount: 42 },
          pcg: "validated",
          vat: "simple",
          amountCoherence: "coherent",
          exclusions: [],
        },
      },
    })).toMatchObject({
      writable: true,
      reviewRequired: false,
      categorizationStatus: "AUTO_APPLIED",
      userFacingResolution: "auto_applied",
    });
  });

  it("keeps contradictory learned rules in light review", () => {
    expect(new CategorizationTrustPolicy().classifySuggestion({ ...baseSuggestion, source: "CORRECTION_RULE", requiresLightReview: true }, validated)).toMatchObject({
      writable: false,
      lightReviewRequired: true,
      categorizationStatus: "REVIEW_LIGHT",
      userFacingResolution: "to_review_light",
    });
  });
});
