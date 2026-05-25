import type { TaxPackageSourceCompleteness, TaxPackageSourceReadiness } from "./tax-package-source-readiness-center.server";

export type TaxPackageCaseResolution = "calculated" | "zero_by_absence" | "to_complete" | "not_applicable" | "blocked";
export type TaxPackageEmptyBehavior = "zero_if_no_movement" | "zero_if_balance_source_complete" | "manual_if_absent" | "not_applicable_if_absent";
export type TaxPackageCalculationFamily = "income_statement" | "balance_sheet" | "fixed_assets" | "tax_adjustment" | "profile" | "manual";

export type TaxPackageReferenceCaseForResolution = {
  requiredSource?: string;
  emptyBehavior?: TaxPackageEmptyBehavior;
  calculationFamily?: TaxPackageCalculationFamily;
  formula?: string;
};

export type TaxPackageCaseResolutionResult = {
  resolution: TaxPackageCaseResolution;
  status: "calculée" | "à compléter" | "non applicable" | "bloquée";
  value: number | null;
  reason: string | null;
  sourceCompleteness: TaxPackageSourceCompleteness;
  isZeroByAbsence: boolean;
};

export class TaxPackageCaseResolutionPolicy {
  resolve(input: {
    taxCase: TaxPackageReferenceCaseForResolution;
    amount: number | null;
    hasSourceMovement: boolean;
    sourceReadiness: TaxPackageSourceReadiness;
  }): TaxPackageCaseResolutionResult {
    const sourceCompleteness = sourceCompletenessFor(input.taxCase, input.sourceReadiness);
    if (requiresJournal(input.taxCase) && !input.sourceReadiness.journalExportable) {
      return result("blocked", "bloquée", null, "Le journal doit être exportable avant calcul.", sourceCompleteness, false);
    }
    if (input.amount != null) {
      return result("calculated", "calculée", input.amount, null, sourceCompleteness, false);
    }
    if (input.hasSourceMovement) {
      return result("to_complete", "à compléter", null, "Données comptables à relire avant calcul.", sourceCompleteness, false);
    }
    if (input.taxCase.emptyBehavior === "zero_if_no_movement") {
      return result("zero_by_absence", "calculée", 0, "Aucun mouvement comptable détecté : valeur calculée à 0.", sourceCompleteness, true);
    }
    if (input.taxCase.emptyBehavior === "zero_if_balance_source_complete") {
      return sourceCompleteness === "complete"
        ? result("zero_by_absence", "calculée", 0, "Aucun solde comptable détecté : valeur calculée à 0.", sourceCompleteness, true)
        : result("to_complete", "à compléter", null, "Solde de bilan à confirmer : Qitus ne dispose pas d'une balance complète.", sourceCompleteness, false);
    }
    if (input.taxCase.emptyBehavior === "not_applicable_if_absent") {
      return result("not_applicable", "non applicable", null, "Case non applicable au régime configuré.", sourceCompleteness, false);
    }
    return result("to_complete", "à compléter", null, "Information à compléter avec votre expert-comptable.", sourceCompleteness, false);
  }
}

function requiresJournal(taxCase: TaxPackageReferenceCaseForResolution) {
  return taxCase.requiredSource === "journal" || taxCase.requiredSource === "computed";
}

function sourceCompletenessFor(taxCase: TaxPackageReferenceCaseForResolution, readiness: TaxPackageSourceReadiness): TaxPackageSourceCompleteness {
  if (taxCase.requiredSource === "profile") return readiness.profileCompleteness;
  if (taxCase.requiredSource === "manual") return readiness.manualDataCompleteness;
  if (taxCase.calculationFamily === "income_statement") return readiness.incomeStatementCompleteness;
  if (taxCase.calculationFamily === "balance_sheet") return readiness.balanceSheetCompleteness;
  if (taxCase.calculationFamily === "fixed_assets") return readiness.fixedAssetsCompleteness;
  if (taxCase.calculationFamily === "tax_adjustment") return readiness.manualDataCompleteness;
  return taxCase.requiredSource === "journal" || taxCase.requiredSource === "computed" ? readiness.incomeStatementCompleteness : "not_required";
}

function result(
  resolution: TaxPackageCaseResolution,
  status: TaxPackageCaseResolutionResult["status"],
  value: number | null,
  reason: string | null,
  sourceCompleteness: TaxPackageSourceCompleteness,
  isZeroByAbsence: boolean
): TaxPackageCaseResolutionResult {
  return { resolution, status, value, reason, sourceCompleteness, isZeroByAbsence };
}
