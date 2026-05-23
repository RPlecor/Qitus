import type { CategorizationSuggestion } from "../categorization/types";
import type { AccountingAssignmentValidationResult } from "./accounting-assignment-validation-policy.server";

export type CategorizationTrustDecision = {
  writable: boolean;
  reviewRequired: boolean;
  reasons: string[];
};

export class CategorizationTrustPolicy {
  classifySuggestion(suggestion: CategorizationSuggestion, validation: AccountingAssignmentValidationResult): CategorizationTrustDecision {
    const reasons = [...validation.blockingReasons, ...validation.warnings];
    if (!validation.valid) return { writable: false, reviewRequired: true, reasons };
    if (suggestion.source === "AI") {
      return {
        writable: false,
        reviewRequired: true,
        reasons: [...reasons, "Suggestion IA à valider avant création d'écriture."],
      };
    }
    if (suggestion.confidence !== "HIGH") {
      return {
        writable: false,
        reviewRequired: true,
        reasons: [...reasons, "Confiance insuffisante pour créer une écriture automatiquement."],
      };
    }
    if (validation.reviewRequired) return { writable: false, reviewRequired: true, reasons };
    return { writable: true, reviewRequired: false, reasons };
  }
}
