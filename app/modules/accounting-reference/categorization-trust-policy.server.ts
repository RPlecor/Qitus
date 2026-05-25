import type { CategorizationSuggestion } from "../categorization/types";
import type { AccountingAssignmentValidationResult } from "./accounting-assignment-validation-policy.server";
import type { AutoApplyReliabilityDecision, UserFacingResolution } from "./auto-apply-reliability-policy.server";

export type CategorizationTrustDecision = {
  status: "WRITABLE" | "AUTO_APPLIED" | "REVIEW_LIGHT" | "NEEDS_REVIEW" | "BLOCKED";
  categorizationStatus: "PROPOSED" | "AUTO_APPLIED" | "REVIEW_LIGHT" | "NEEDS_REVIEW";
  userFacingResolution: UserFacingResolution;
  writable: boolean;
  reviewRequired: boolean;
  lightReviewRequired: boolean;
  reasons: string[];
  audit?: AutoApplyReliabilityDecision["audit"];
};

export type CategorizationTrustOptions = {
  autoApplyDecision?: AutoApplyReliabilityDecision;
  storedStatus?: string | null;
};

export class CategorizationTrustPolicy {
  classifySuggestion(suggestion: CategorizationSuggestion, validation: AccountingAssignmentValidationResult, options: CategorizationTrustOptions = {}): CategorizationTrustDecision {
    const reasons = [...validation.blockingReasons, ...validation.warnings];
    if (!validation.valid || validation.status === "BLOCKED") return this.decision("BLOCKED", "NEEDS_REVIEW", "blocked", false, true, false, reasons);
    if (suggestion.source === "AI") {
      return this.classifyAiSuggestion(validation, reasons, options);
    }
    if (suggestion.requiresLightReview) {
      return this.decision("REVIEW_LIGHT", "REVIEW_LIGHT", "to_review_light", false, false, true, [...reasons, "Règle apprise contradictoire à relire rapidement."]);
    }
    if (suggestion.confidence !== "HIGH") {
      return this.decision("NEEDS_REVIEW", "NEEDS_REVIEW", "to_review", false, true, false, [...reasons, "Confiance insuffisante pour créer une écriture automatiquement."]);
    }
    if (validation.reviewRequired) return this.decision("NEEDS_REVIEW", "NEEDS_REVIEW", "to_review", false, true, false, reasons);
    return this.decision("WRITABLE", "PROPOSED", "confirmed", true, false, false, reasons);
  }

  private classifyAiSuggestion(validation: AccountingAssignmentValidationResult, reasons: string[], options: CategorizationTrustOptions): CategorizationTrustDecision {
    if (options.storedStatus === "AUTO_APPLIED" && validation.status === "VALIDATED" && !validation.reviewRequired && reasons.length === 0) {
      return this.decision("AUTO_APPLIED", "AUTO_APPLIED", "auto_applied", true, false, false, ["Appliqué automatiquement par Qitus — corrigeable."]);
    }
    if (options.storedStatus === "REVIEW_LIGHT") {
      return this.decision("REVIEW_LIGHT", "REVIEW_LIGHT", "to_review_light", false, false, true, ["À relire rapidement avant création d'écriture."]);
    }
    if (options.storedStatus === "NEEDS_REVIEW") {
      return this.decision("NEEDS_REVIEW", "NEEDS_REVIEW", "to_review", false, true, false, ["Décision utilisateur nécessaire."]);
    }
    if (options.autoApplyDecision) {
      const decision = options.autoApplyDecision;
      if (decision.status === "AUTO_APPLIED") {
        return this.decision("AUTO_APPLIED", "AUTO_APPLIED", "auto_applied", true, false, false, decision.reasons, decision.audit);
      }
      if (decision.status === "REVIEW_LIGHT") {
        return this.decision("REVIEW_LIGHT", "REVIEW_LIGHT", "to_review_light", false, false, true, decision.reasons, decision.audit);
      }
      return this.decision("NEEDS_REVIEW", "NEEDS_REVIEW", "to_review", false, true, false, decision.reasons, decision.audit);
    }
    return this.decision("NEEDS_REVIEW", "NEEDS_REVIEW", "to_review", false, true, false, [...reasons, "Suggestion IA à relire avant création d'écriture."]);
  }

  private decision(
    status: CategorizationTrustDecision["status"],
    categorizationStatus: CategorizationTrustDecision["categorizationStatus"],
    userFacingResolution: UserFacingResolution,
    writable: boolean,
    reviewRequired: boolean,
    lightReviewRequired: boolean,
    reasons: string[],
    audit?: AutoApplyReliabilityDecision["audit"]
  ): CategorizationTrustDecision {
    return { status, categorizationStatus, userFacingResolution, writable, reviewRequired, lightReviewRequired, reasons, audit };
  }
}
