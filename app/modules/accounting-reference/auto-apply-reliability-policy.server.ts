import type { AccountingAssignmentValidationResult } from "./accounting-assignment-validation-policy.server";
import type { CompanyProfileClassification } from "./company-profile-classification-center.server";
import type { CategorizationSuggestion, CategorizationTransaction } from "../categorization/types";

export type UserFacingResolution =
  | "confirmed"
  | "auto_applied"
  | "to_review_light"
  | "to_review"
  | "to_complete"
  | "blocked"
  | "not_started"
  | "not_applicable";

export type AutoApplyReliabilityStatus = "AUTO_APPLIED" | "REVIEW_LIGHT" | "NEEDS_REVIEW";

export type SupplierCategorizationHistoryItem = {
  accountDebit: string | null;
  accountCredit: string | null;
  vatRate: number | null;
  vatOperationNature: string | null;
  amount: number;
  status: string;
  source: string;
};

export type AutoApplyReliabilityDecision = {
  status: AutoApplyReliabilityStatus;
  writable: boolean;
  userFacingResolution: Extract<UserFacingResolution, "auto_applied" | "to_review_light" | "to_review">;
  reasons: string[];
  audit: {
    supplierHistory: {
      supplierKey: string | null;
      coherentMatches: number;
      contradictoryUserDecisions: number;
      medianAmount: number | null;
    };
    pcg: "validated" | "needs_review" | "blocked";
    vat: "simple" | "complex" | "missing";
    amountCoherence: "coherent" | "atypical" | "not_enough_history";
    exclusions: string[];
  };
};

export type AutoApplyReliabilityInput = {
  suggestion: CategorizationSuggestion;
  validation: AccountingAssignmentValidationResult;
  transaction?: CategorizationTransaction;
  supplierHistory: SupplierCategorizationHistoryItem[];
  company: { vatRegime: string; vatExigibility?: string | null };
  profile: CompanyProfileClassification;
};

const ABSOLUTE_AMOUNT_TOLERANCE = 100;
const RELATIVE_AMOUNT_TOLERANCE = 0.5;
const COMPLEX_VAT_NATURES = new Set(["INTRACOM_PURCHASE", "INTRACOM_SALE", "REVERSE_CHARGE", "MIXED"]);
const SIMPLE_VAT_NATURES = new Set(["DOMESTIC_PURCHASE", "DOMESTIC_SALE", "EXEMPT", "OUT_OF_SCOPE"]);
const SENSITIVE_ACCOUNT_PREFIXES = ["108", "15", "16", "2", "44", "455", "67", "68", "69", "77", "78", "79"];
const CONFIDENCE_SCORE = { HIGH: 95, MEDIUM: 70, LOW: 40 } as const;
const ASSET_KEYWORDS = [
  "amortissement",
  "immobilisation",
  "ordinateur",
  "macbook",
  "iphone",
  "véhicule",
  "vehicule",
  "mobilier",
  "matériel",
  "materiel",
  "équipement",
  "equipement",
  "machine",
  "serveur",
];

export class AutoApplyReliabilityPolicy {
  classifyAiSuggestion(input: AutoApplyReliabilityInput): AutoApplyReliabilityDecision {
    // Preconditions provided by upstream Modules before this policy decides auto-application:
    // - AccountingAssignmentValidationPolicy has validated that accounts are PCG-known and postable.
    // - AccountingReferencePolicyCenter has supplied suspense/bank roles, so suspense-account warnings are visible here.
    // - VatRatePolicy has checked the structural coherence of TVA rate/nature selections.
    // - CategorizationTrustPolicy forbids an AI-only suggestion from becoming USER_CONFIRMED.
    const reasons: string[] = [];
    const exclusions: string[] = [];
    const tierConfig = input.profile.config;
    const supplierKey = supplierKeyFor(input.transaction);
    const pcg = pcgStatus(input.validation);
    const vat = vatStatus(input);
    const coherentHistory = input.supplierHistory.filter((item) => sameAccountingDecision(item, input.suggestion));
    const contradictoryUserDecisions = input.supplierHistory.filter((item) => isContradictoryUserDecision(item, input.suggestion));
    const medianAmount = coherentHistory.length > 0 ? median(coherentHistory.map((item) => Math.abs(item.amount))) : null;
    const amountCoherence = amountCoherenceFor(input.transaction?.amount ?? 0, medianAmount, coherentHistory.length, tierConfig.minHistoryMatches);
    const confidenceScore = CONFIDENCE_SCORE[input.suggestion.confidence];

    if (input.suggestion.source !== "AI") {
      return decision("NEEDS_REVIEW", ["Cette policy est réservée aux suggestions IA."], audit({
        supplierKey,
        coherentMatches: coherentHistory.length,
        contradictoryUserDecisions: contradictoryUserDecisions.length,
        medianAmount,
        pcg,
        vat,
        amountCoherence,
        exclusions: ["source_not_ai"],
      }));
    }
    if (confidenceScore < tierConfig.confidenceThreshold) reasons.push("Confiance IA insuffisante pour le profil de l'entreprise.");
    if (input.validation.status === "BLOCKED" || !input.validation.valid) reasons.push("Compte non validé par le plan comptable Qitus.");
    if (input.validation.reviewRequired || input.validation.warnings.length > 0) reasons.push("Contrôle Qitus à relire avant écriture.");
    if (vat !== "simple") reasons.push(vat === "complex" ? "TVA à relire avant automatisation." : "TVA incomplète.");
    if (contradictoryUserDecisions.length > 0) reasons.push("Correction utilisateur contradictoire déjà observée.");

    if (isPotentialFixedAsset(input)) {
      exclusions.push("fixed_asset_candidate");
      reasons.push("Immobilisation potentielle à relire.");
    }
    if (isSensitiveAccounting(input.suggestion)) {
      exclusions.push("sensitive_accounting");
      reasons.push("Compte sensible à valider manuellement.");
    }
    if (input.suggestion.isAnnualCharge) {
      exclusions.push("annual_charge");
      reasons.push("Charge périodique à relire avant écriture.");
    }
    if (tierConfig.blacklistExtensions.includes("provision") && isProvisionCandidate(input)) {
      exclusions.push("provision");
      reasons.push("Provision à relire avant écriture.");
    }
    if (tierConfig.blacklistExtensions.includes("exceptional_charge_over_1000") && isExceptionalChargeOverThreshold(input)) {
      exclusions.push("exceptional_charge_over_1000");
      reasons.push("Charge exceptionnelle supérieure à 1 000 € à relire.");
    }

    const hardReview = reasons.length > 0;
    if (hardReview) {
      return decision("NEEDS_REVIEW", reasons, audit({
        supplierKey,
        coherentMatches: coherentHistory.length,
        contradictoryUserDecisions: contradictoryUserDecisions.length,
        medianAmount,
        pcg,
        vat,
        amountCoherence,
        exclusions,
      }));
    }

    const lightReasons: string[] = [];
    if (coherentHistory.length < tierConfig.minHistoryMatches) lightReasons.push("Fournisseur encore peu observé dans Qitus.");
    if (amountCoherence === "atypical") lightReasons.push("Montant atypique par rapport à l'historique fournisseur.");
    if (!supplierKey) lightReasons.push("Fournisseur non identifié.");
    if (lightReasons.length > 0) {
      return decision("REVIEW_LIGHT", lightReasons, audit({
        supplierKey,
        coherentMatches: coherentHistory.length,
        contradictoryUserDecisions: contradictoryUserDecisions.length,
        medianAmount,
        pcg,
        vat,
        amountCoherence,
        exclusions,
      }));
    }

    return decision("AUTO_APPLIED", [
      `Confiance IA suffisante pour le profil ${input.profile.tier}.`,
      "Compte validé par le plan comptable Qitus.",
      tierConfig.minHistoryMatches > 0 ? "Même compte que l'historique fournisseur." : "Profil micro : historique fournisseur non requis pour les cas courants.",
      "Montant cohérent avec l'historique fournisseur.",
    ], audit({
      supplierKey,
      coherentMatches: coherentHistory.length,
      contradictoryUserDecisions: contradictoryUserDecisions.length,
      medianAmount,
      pcg,
      vat,
      amountCoherence,
      exclusions,
    }));
  }
}

function audit(input: {
  supplierKey: string | null;
  coherentMatches: number;
  contradictoryUserDecisions: number;
  medianAmount: number | null;
  pcg: AutoApplyReliabilityDecision["audit"]["pcg"];
  vat: AutoApplyReliabilityDecision["audit"]["vat"];
  amountCoherence: AutoApplyReliabilityDecision["audit"]["amountCoherence"];
  exclusions: string[];
}): AutoApplyReliabilityDecision["audit"] {
  return {
    supplierHistory: {
      supplierKey: input.supplierKey,
      coherentMatches: input.coherentMatches,
      contradictoryUserDecisions: input.contradictoryUserDecisions,
      medianAmount: input.medianAmount,
    },
    pcg: input.pcg,
    vat: input.vat,
    amountCoherence: input.amountCoherence,
    exclusions: input.exclusions,
  };
}

function decision(status: AutoApplyReliabilityStatus, reasons: string[], audit: AutoApplyReliabilityDecision["audit"]): AutoApplyReliabilityDecision {
  return {
    status,
    writable: status === "AUTO_APPLIED",
    userFacingResolution: status === "AUTO_APPLIED" ? "auto_applied" : status === "REVIEW_LIGHT" ? "to_review_light" : "to_review",
    reasons,
    audit,
  };
}

function pcgStatus(validation: AccountingAssignmentValidationResult): AutoApplyReliabilityDecision["audit"]["pcg"] {
  if (validation.status === "BLOCKED") return "blocked";
  if (validation.status === "NEEDS_REVIEW" || validation.reviewRequired) return "needs_review";
  return "validated";
}

function vatStatus(input: AutoApplyReliabilityInput): AutoApplyReliabilityDecision["audit"]["vat"] {
  const nature = input.suggestion.vatOperationNature ?? null;
  const rate = input.suggestion.vatRate ?? null;
  if (!nature && (rate === null || rate === 0)) return "simple";
  if (nature && COMPLEX_VAT_NATURES.has(nature)) return "complex";
  if (!nature && rate !== null && rate > 0) return "missing";
  if (nature && !SIMPLE_VAT_NATURES.has(nature)) return "complex";
  if ((nature === "DOMESTIC_PURCHASE" || nature === "DOMESTIC_SALE") && rate === null) return "missing";
  if ((nature === "EXEMPT" || nature === "OUT_OF_SCOPE") && rate !== null && rate > 0) return "complex";
  if (input.company.vatExigibility === "MIXED" && rate !== null && rate > 0) return "complex";
  return "simple";
}

function sameAccountingDecision(item: SupplierCategorizationHistoryItem, suggestion: CategorizationSuggestion) {
  return item.accountDebit === suggestion.accountDebit
    && item.accountCredit === suggestion.accountCredit
    && normalizeVatRate(item.vatRate) === normalizeVatRate(suggestion.vatRate ?? null)
    && (item.vatOperationNature ?? null) === (suggestion.vatOperationNature ?? null);
}

function isContradictoryUserDecision(item: SupplierCategorizationHistoryItem, suggestion: CategorizationSuggestion) {
  if (!["USER_CONFIRMED", "USER_CORRECTED", "MANUAL"].includes(item.status)) return false;
  return !sameAccountingDecision(item, suggestion);
}

function amountCoherenceFor(amount: number, medianAmount: number | null, historyCount: number, minimumHistoryMatches: number): AutoApplyReliabilityDecision["audit"]["amountCoherence"] {
  if (historyCount < minimumHistoryMatches) return "not_enough_history";
  if (medianAmount === null) return minimumHistoryMatches === 0 ? "coherent" : "not_enough_history";
  const delta = Math.abs(Math.abs(amount) - medianAmount);
  const tolerance = Math.max(ABSOLUTE_AMOUNT_TOLERANCE, medianAmount * RELATIVE_AMOUNT_TOLERANCE);
  return delta <= tolerance ? "coherent" : "atypical";
}

function isPotentialFixedAsset(input: AutoApplyReliabilityInput) {
  if (input.suggestion.accountDebit.startsWith("2") || input.suggestion.accountCredit.startsWith("2")) return true;
  const text = `${input.transaction?.label ?? ""} ${input.transaction?.counterparty ?? ""} ${input.transaction?.sourceCategory ?? ""}`.toLowerCase();
  return Math.abs(input.transaction?.amount ?? 0) >= 500 && ASSET_KEYWORDS.some((keyword) => text.includes(keyword));
}

function isSensitiveAccounting(suggestion: CategorizationSuggestion) {
  return [suggestion.accountDebit, suggestion.accountCredit].some((account) => SENSITIVE_ACCOUNT_PREFIXES.some((prefix) => account.startsWith(prefix)));
}

function isProvisionCandidate(input: AutoApplyReliabilityInput) {
  const text = `${input.transaction?.label ?? ""} ${input.transaction?.counterparty ?? ""} ${input.suggestion.ecritureLabel}`.toLowerCase();
  return input.suggestion.accountDebit.startsWith("15")
    || input.suggestion.accountCredit.startsWith("15")
    || text.includes("provision");
}

function isExceptionalChargeOverThreshold(input: AutoApplyReliabilityInput) {
  const text = `${input.transaction?.label ?? ""} ${input.transaction?.counterparty ?? ""} ${input.suggestion.ecritureLabel}`.toLowerCase();
  const amount = Math.abs(input.transaction?.amount ?? 0);
  return amount > 1000 && (
    input.suggestion.accountDebit.startsWith("67")
    || input.suggestion.accountCredit.startsWith("77")
    || text.includes("exceptionnel")
    || text.includes("exceptionnelle")
  );
}

function supplierKeyFor(transaction: CategorizationTransaction | undefined) {
  const key = transaction?.counterparty?.trim() || transaction?.normalizedLabel?.trim();
  return key ? key.toLowerCase() : null;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function normalizeVatRate(value: number | null) {
  return value === null ? null : Number(value.toFixed(4));
}
