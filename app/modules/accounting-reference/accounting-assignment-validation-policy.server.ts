import type { VatRegime } from "@prisma/client";
import { ChartOfAccountsCenter } from "./chart-of-accounts-center.server";
import type { CategorizationSuggestion, CategorizationTransaction } from "../categorization/types";
import { VatRatePolicy } from "../vat/vat-rate-policy";

export type AccountingValidationStatus = "VALIDATED" | "NEEDS_REVIEW" | "BLOCKED";

export type AccountingAssignmentValidationResult = {
  status: AccountingValidationStatus;
  valid: boolean;
  reviewRequired: boolean;
  blockingReasons: string[];
  warnings: string[];
  chartVersion: string;
  accountDebitLabel?: string;
  accountCreditLabel?: string;
};

export class AccountingAssignmentValidationPolicy {
  constructor(
    private readonly chart = new ChartOfAccountsCenter(),
    private readonly vat = new VatRatePolicy()
  ) {}

  validateSuggestion(
    company: { vatRegime: VatRegime | string },
    suggestion: CategorizationSuggestion,
    transaction?: Pick<CategorizationTransaction, "type" | "amount">
  ): AccountingAssignmentValidationResult {
    const blockingReasons: string[] = [];
    const warnings: string[] = [];
    const debit = this.chart.getAccount(suggestion.accountDebit);
    const credit = this.chart.getAccount(suggestion.accountCredit);

    if (!debit) blockingReasons.push(`Compte débit ${suggestion.accountDebit} non reconnu par le référentiel PCG Qitus.`);
    else if (!debit.isPostable) blockingReasons.push(`Compte débit ${suggestion.accountDebit} non utilisable pour une écriture.`);

    if (!credit) blockingReasons.push(`Compte crédit ${suggestion.accountCredit} non reconnu par le référentiel PCG Qitus.`);
    else if (!credit.isPostable) blockingReasons.push(`Compte crédit ${suggestion.accountCredit} non utilisable pour une écriture.`);

    if (!suggestion.journal) blockingReasons.push("Journal comptable manquant.");
    if (!suggestion.ecritureLabel) blockingReasons.push("Libellé d'écriture manquant.");

    const vatSelection = this.vat.validateSelection({
      vatRate: suggestion.vatRate,
      vatOperationNature: suggestion.vatOperationNature,
    });
    blockingReasons.push(...vatSelection.errors);
    warnings.push(...vatSelection.warnings);

    if (company.vatRegime === "FRANCHISE" && vatSelection.vatRate !== null && vatSelection.vatRate > 0) {
      warnings.push("TVA renseignée alors que l'entreprise est en franchise de TVA.");
    }

    if (suggestion.accountDebit === "471" || suggestion.accountCredit === "471") {
      warnings.push("Compte d'attente à vérifier avant finalisation du dossier.");
    }

    if (transaction && Number(transaction.amount) === 0) {
      blockingReasons.push("Montant nul : aucune écriture automatique ne peut être créée.");
    }

    const reviewRequired = blockingReasons.length > 0 || warnings.some((warning) => warning.includes("Compte d'attente"));
    return {
      status: blockingReasons.length > 0 ? "BLOCKED" : reviewRequired ? "NEEDS_REVIEW" : "VALIDATED",
      valid: blockingReasons.length === 0,
      reviewRequired,
      blockingReasons,
      warnings,
      chartVersion: this.chart.getActiveChartVersion(),
      accountDebitLabel: suggestion.accountDebitLabel ?? debit?.label,
      accountCreditLabel: suggestion.accountCreditLabel ?? credit?.label,
    };
  }
}
