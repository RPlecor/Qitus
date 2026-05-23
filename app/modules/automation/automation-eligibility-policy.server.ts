import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig } from "../runtime-config.server";
import type { AutomationOpportunity } from "./automation-opportunity-center.server";

export class AutomationEligibilityPolicy {
  constructor(private readonly threshold = getRuntimeConfig().automationConfidenceThreshold) {}

  normalize(workspace: CompanyWorkspace, opportunity: AutomationOpportunity): AutomationOpportunity {
    const reasons: string[] = [];
    let category = opportunity.category;
    let eligibilityStatus: AutomationOpportunity["eligibilityStatus"] = category === 1 ? "safe" : "needs_validation";

    if (category === 1 && workspace.fiscalYear.status === "CLOSED") {
      eligibilityStatus = "blocked";
      reasons.push("L'exercice est clôturé.");
    }

    if (category === 1 && opportunity.confidence < this.threshold) {
      category = 2;
      eligibilityStatus = "needs_validation";
      reasons.push(`Confiance ${formatScore(opportunity.confidence)} inférieure au seuil ${formatScore(this.threshold)}.`);
    }

    if (category === 1 && opportunity.requiresUserValidation) {
      category = 2;
      eligibilityStatus = "needs_validation";
      reasons.push("Validation utilisateur requise.");
    }

    if (category === 1 && !opportunity.reversible) {
      eligibilityStatus = "blocked";
      reasons.push("Action non réversible.");
    }

    if (category === 1 && opportunity.safetyChecks?.protectedUserDecision) {
      eligibilityStatus = "blocked";
      reasons.push("Une décision utilisateur confirmée serait remplacée.");
    }

    for (const conflict of opportunity.safetyChecks?.conflictReasons ?? []) {
      if (category === 1) eligibilityStatus = "blocked";
      reasons.push(conflict);
    }

    if (category === 1 && opportunity.effectKind === "accounting_mutation") {
      const ambiguityReasons = accountingMutationAmbiguityReasons(opportunity);
      if (ambiguityReasons.length > 0) {
        category = 2;
        eligibilityStatus = "needs_validation";
        reasons.push(...ambiguityReasons);
      }
    }

    return {
      ...opportunity,
      category,
      confidenceThreshold: this.threshold,
      eligibilityStatus,
      eligibilityReasons: reasons.length > 0 ? reasons : defaultReason(eligibilityStatus),
      requiresUserValidation: opportunity.requiresUserValidation || eligibilityStatus === "needs_validation",
    };
  }

  assertRunnable(workspace: CompanyWorkspace, opportunity: AutomationOpportunity) {
    const normalized = this.normalize(workspace, opportunity);
    if (normalized.category !== 1 || normalized.eligibilityStatus !== "safe" || normalized.requiresUserValidation) {
      throw new ExpectedRouteError(`Automatisation à valider : ${normalized.eligibilityReasons[0] ?? "critère de sûreté non rempli"}`, 409);
    }
    return normalized;
  }
}

function accountingMutationAmbiguityReasons(opportunity: AutomationOpportunity) {
  const checks = opportunity.safetyChecks;
  const reasons: string[] = [];
  if (!checks) return ["Contrôles de non-ambiguïté comptable absents."];
  if (checks.candidateCount !== 1) reasons.push("Plus d'un candidat métier possible.");
  if (checks.hasCompetingAlternatives) reasons.push("Une alternative concurrente existe.");
  if (checks.deterministicSource !== true) reasons.push("Source déterministe non confirmée.");
  if (checks.activeRule !== true) reasons.push("Règle active non confirmée.");
  if (checks.accountResolved !== true) reasons.push("Comptes comptables non résolus.");
  if (checks.vatResolvedOrNotApplicable !== true) reasons.push("TVA non résolue ou non justifiée comme non applicable.");
  if (checks.balancedEntry !== true) reasons.push("Écriture équilibrée non confirmée.");
  return reasons;
}

function defaultReason(status: AutomationOpportunity["eligibilityStatus"]) {
  if (status === "safe") return ["Critères déterministes remplis."];
  if (status === "blocked") return ["Action bloquée par les garde-fous d'automatisation."];
  return ["Validation utilisateur requise."];
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
