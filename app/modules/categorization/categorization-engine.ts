import type {
  AiCategorizationProvider,
  CategorizationContext,
  CategorizationSuggestion,
  CategorizationTransaction,
  CorrectionRuleInput,
  VendorMappingInput,
} from "./types";

export class CategorizationEngine {
  constructor(private readonly aiProvider: AiCategorizationProvider) {}

  async categorize(transactions: CategorizationTransaction[], context: CategorizationContext): Promise<CategorizationSuggestion[]> {
    const resolved = new Map<string, CategorizationSuggestion>();

    for (const transaction of transactions) {
      const correction = matchCorrection(transaction, context.correctionRules, context);
      if (correction) {
        resolved.set(transaction.id, correction);
        continue;
      }

      const vendor = matchVendor(transaction, context.vendorMappings, context);
      if (vendor) {
        resolved.set(transaction.id, vendor);
      }
    }

    const residual = transactions.filter((transaction) => !resolved.has(transaction.id));
    const aiResults = await this.categorizeResidualWithAi(residual, context);
    for (const suggestion of aiResults) {
      resolved.set(suggestion.transactionId, suggestion);
    }

    return transactions
      .map((transaction) => resolved.get(transaction.id))
      .filter((suggestion): suggestion is CategorizationSuggestion => Boolean(suggestion));
  }

  private async categorizeResidualWithAi(transactions: CategorizationTransaction[], context: CategorizationContext): Promise<CategorizationSuggestion[]> {
    if (transactions.length === 0) return [];

    try {
      const suggestions = await this.aiProvider.categorize(transactions, context);
      const byTransaction = new Map(suggestions.map((suggestion) => [suggestion.transactionId, suggestion]));
      return transactions.map((transaction) => byTransaction.get(transaction.id) ?? buildReviewSuggestion(transaction, "IA response omitted this transaction.", context));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "IA provider failed.";
      return transactions.map((transaction) => buildReviewSuggestion(transaction, reason, context));
    }
  }
}

function matchCorrection(transaction: CategorizationTransaction, rules: CorrectionRuleInput[], context: CategorizationContext): CategorizationSuggestion | null {
  const counterparty = transaction.counterparty?.toLowerCase();
  if (!counterparty) return null;

  const rule = rules.find((candidate) => counterparty.includes(candidate.counterparty.toLowerCase()));
  if (!rule) return null;

  return buildSuggestion(transaction, {
    accountDebit: transaction.type === "CREDIT" ? context.accountRoles.bank.account : rule.preferredAccount,
    accountDebitLabel: transaction.type === "CREDIT" ? context.accountRoles.bank.label : rule.preferredAccountLabel,
    accountCredit: transaction.type === "CREDIT" ? rule.preferredAccount : context.accountRoles.bank.account,
    accountCreditLabel: transaction.type === "CREDIT" ? rule.preferredAccountLabel : context.accountRoles.bank.label,
    vatRate: rule.preferredVatRate,
    vatOperationNature: rule.vatOperationNature,
    confidence: "HIGH",
    source: "CORRECTION_RULE",
    requiresLightReview: rule.conflict,
  });
}

function matchVendor(transaction: CategorizationTransaction, mappings: VendorMappingInput[], context: CategorizationContext): CategorizationSuggestion | null {
  const counterparty = transaction.counterparty?.toLowerCase() ?? "";
  const label = transaction.normalizedLabel.toLowerCase();

  for (const mapping of mappings) {
    const pattern = mapping.pattern.toLowerCase();
    const matches =
      (mapping.matchType === "VENDOR_EXACT" && counterparty === pattern) ||
      (mapping.matchType === "VENDOR_CONTAINS" && counterparty.includes(pattern)) ||
      (mapping.matchType === "LABEL_KEYWORD" && label.includes(pattern)) ||
      (mapping.matchType === "LABEL_REGEX" && new RegExp(mapping.pattern, "i").test(transaction.label));

    if (!matches) continue;

    return buildSuggestion(transaction, {
      accountDebit: transaction.type === "CREDIT" ? context.accountRoles.bank.account : mapping.accountDebit,
      accountDebitLabel: transaction.type === "CREDIT" ? context.accountRoles.bank.label : mapping.accountLabel,
      accountCredit: transaction.type === "CREDIT" ? mapping.accountDebit : mapping.accountCredit ?? context.accountRoles.bank.account,
      accountCreditLabel: transaction.type === "CREDIT" ? mapping.accountLabel : context.accountRoles.bank.label,
      journal: mapping.journal ?? "BQ",
      ecritureLabel: mapping.ecritureLabel,
      vatRate: mapping.vatRate,
      vatOperationNature: mapping.vatOperationNature,
      confidence: "HIGH",
      source: mapping.matchType.startsWith("LABEL") ? "PATTERN_MATCH" : "VENDOR_LOOKUP",
      isAnnualCharge: mapping.isAnnualCharge,
    });
  }

  return null;
}

function buildSuggestion(
  transaction: CategorizationTransaction,
  options: Pick<CategorizationSuggestion, "accountDebit" | "accountDebitLabel" | "accountCredit" | "accountCreditLabel" | "confidence" | "source"> &
    Partial<Pick<CategorizationSuggestion, "journal" | "ecritureLabel" | "isAnnualCharge" | "vatRate" | "vatOperationNature">>
    & Pick<Partial<CategorizationSuggestion>, "requiresLightReview">
): CategorizationSuggestion {
  return {
    transactionId: transaction.id,
    accountDebit: options.accountDebit,
    accountDebitLabel: options.accountDebitLabel,
    accountCredit: options.accountCredit,
    accountCreditLabel: options.accountCreditLabel,
    journal: options.journal ?? "BQ",
    ecritureLabel: options.ecritureLabel ?? `${transaction.counterparty ?? "Transaction"} - ${transaction.label}`,
    vatRate: options.vatRate,
    vatOperationNature: options.vatOperationNature,
    confidence: options.confidence,
    source: options.source,
    isAnnualCharge: options.isAnnualCharge ?? false,
    requiresLightReview: options.requiresLightReview,
  };
}

function buildReviewSuggestion(transaction: CategorizationTransaction, reason: string, context?: CategorizationContext): CategorizationSuggestion {
  const bank = context?.accountRoles.bank;
  const suspense = context?.accountRoles.suspense;
  if (!bank || !suspense) throw new Error("Rôles comptables banque/attente absents du contexte de catégorisation.");
  return {
    transactionId: transaction.id,
    accountDebit: suspense.account,
    accountDebitLabel: suspense.label,
    accountCredit: bank.account,
    accountCreditLabel: bank.label,
    journal: "BQ",
    ecritureLabel: `${transaction.counterparty ?? "Transaction"} - ${transaction.label}`,
    confidence: "LOW",
    source: "AI",
    rationale: reason,
    isAnnualCharge: false,
  };
}
