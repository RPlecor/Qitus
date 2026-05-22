import type { Categorization, Confidence, CorrectionRule, VendorMapping } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ruleMatchesTransaction } from "./transaction-explorer.server";

export type TransactionSuggestion = {
  id: string;
  accountDebit: string;
  accountDebitLabel: string | null;
  accountCredit: string;
  accountCreditLabel: string | null;
  ecritureLabel: string;
  vatRate: string | null;
  vatOperationNature: string | null;
  confidence: Confidence;
  source: "CURRENT" | "CORRECTION_RULE" | "VENDOR_MAPPING" | "PATTERN" | "REVIEW";
  rationale: string;
  badge: "appliquée" | "suggérée" | "à vérifier";
};

export class TransactionSuggestionCenter {
  async getSuggestions(workspace: CompanyWorkspace, transactionId: string): Promise<TransactionSuggestion[]> {
    const [transaction, rules, mappings] = await Promise.all([
      prisma.transaction.findFirstOrThrow({
        where: { id: transactionId, fiscalYearId: workspace.fiscalYear.id },
        include: { categorization: true },
      }),
      prisma.correctionRule.findMany({ where: { fiscalYearId: workspace.fiscalYear.id, active: true }, orderBy: { createdAt: "desc" } }),
      prisma.vendorMapping.findMany({
        where: { active: true, OR: [{ companyId: null }, { companyId: workspace.company.id }] },
        orderBy: [{ companyId: "desc" }, { hitCount: "desc" }],
      }),
    ]);

    const suggestions = [
      currentSuggestion(transaction.categorization),
      rules.map((rule) => ruleSuggestion(transaction, rule)).find(Boolean) ?? null,
      mappings.map((mapping) => mappingSuggestion(transaction, mapping)).find(Boolean) ?? null,
      patternSuggestion(transaction),
    ].filter((suggestion): suggestion is TransactionSuggestion => Boolean(suggestion));

    if (suggestions.length === 0) suggestions.push(reviewSuggestion(transaction));
    return uniqueSuggestions(suggestions);
  }

  async explainSuggestion(workspace: CompanyWorkspace, suggestionId: string) {
    const transactionId = suggestionId.split(":").at(-1);
    if (!transactionId) return null;
    return (await this.getSuggestions(workspace, transactionId)).find((suggestion) => suggestion.id === suggestionId) ?? null;
  }

  async previewCategorization(workspace: CompanyWorkspace, transactionId: string, suggestion: TransactionSuggestion) {
    const transaction = await prisma.transaction.findFirstOrThrow({ where: { id: transactionId, fiscalYearId: workspace.fiscalYear.id } });
    return {
      transactionId: transaction.id,
      amount: transaction.amount.toString(),
      accountDebit: suggestion.accountDebit,
      accountCredit: suggestion.accountCredit,
      ecritureLabel: suggestion.ecritureLabel,
      vatRate: suggestion.vatRate,
      vatOperationNature: suggestion.vatOperationNature,
    };
  }
}

function currentSuggestion(categorization: Categorization | null): TransactionSuggestion | null {
  if (!categorization?.accountDebit || !categorization.accountCredit) return null;
  return {
    id: `current:${categorization.transactionId}`,
    accountDebit: categorization.accountDebit,
    accountDebitLabel: categorization.accountDebitLabel,
    accountCredit: categorization.accountCredit,
    accountCreditLabel: categorization.accountCreditLabel,
    ecritureLabel: categorization.ecritureLabel ?? "Transaction",
    vatRate: categorization.vatRate?.toString() ?? null,
    vatOperationNature: categorization.vatOperationNature,
    confidence: categorization.confidence,
    source: "CURRENT",
    rationale: categorization.aiRationale ?? "Catégorisation actuellement enregistrée.",
    badge: "appliquée",
  };
}

function ruleSuggestion(transaction: TransactionShape, rule: CorrectionRule): TransactionSuggestion | null {
  if (!ruleMatchesTransaction(rule, transaction)) return null;
  const isCredit = Number(transaction.amount) >= 0;
  return {
    id: `rule:${rule.id}:${transaction.id}`,
    accountDebit: isCredit ? "5121" : rule.preferredAccount,
    accountDebitLabel: isCredit ? "Banque" : rule.preferredAccountLabel,
    accountCredit: isCredit ? rule.preferredAccount : "5121",
    accountCreditLabel: isCredit ? rule.preferredAccountLabel : "Banque",
    ecritureLabel: `${transaction.counterparty ?? "Transaction"} - ${transaction.label}`,
    vatRate: rule.preferredVatRate?.toString() ?? null,
    vatOperationNature: rule.vatOperationNature,
    confidence: "HIGH",
    source: "CORRECTION_RULE",
    rationale: `Règle utilisateur active pour "${rule.counterparty}".`,
    badge: "suggérée",
  };
}

function mappingSuggestion(transaction: TransactionShape, mapping: VendorMapping): TransactionSuggestion | null {
  const label = transaction.normalizedLabel.toLowerCase();
  const counterparty = (transaction.counterparty ?? "").toLowerCase();
  const pattern = mapping.pattern.toLowerCase();
  const matches =
    (mapping.matchType === "VENDOR_EXACT" && counterparty === pattern) ||
    (mapping.matchType === "VENDOR_CONTAINS" && counterparty.includes(pattern)) ||
    (mapping.matchType === "LABEL_KEYWORD" && label.includes(pattern)) ||
    (mapping.matchType === "LABEL_REGEX" && new RegExp(mapping.pattern, "i").test(transaction.label));
  if (!matches) return null;
  const isCredit = Number(transaction.amount) >= 0;
  return {
    id: `mapping:${mapping.id}:${transaction.id}`,
    accountDebit: isCredit ? "5121" : mapping.accountDebit,
    accountDebitLabel: isCredit ? "Banque" : mapping.accountLabel,
    accountCredit: isCredit ? mapping.accountDebit : mapping.accountCredit,
    accountCreditLabel: isCredit ? mapping.accountLabel : "Banque",
    ecritureLabel: mapping.ecritureLabel ?? `${transaction.counterparty ?? "Transaction"} - ${transaction.label}`,
    vatRate: mapping.vatRate?.toString() ?? null,
    vatOperationNature: mapping.vatOperationNature,
    confidence: "HIGH",
    source: mapping.matchType.toString().startsWith("LABEL") ? "PATTERN" : "VENDOR_MAPPING",
    rationale: `Mapping déterministe "${mapping.pattern}".`,
    badge: "suggérée",
  };
}

function patternSuggestion(transaction: TransactionShape): TransactionSuggestion | null {
  const label = transaction.normalizedLabel.toLowerCase();
  const patterns: Array<[RegExp, string, string]> = [
    [/frais bancaire|qonto|commission/, "627", "Services bancaires"],
    [/greffe|inpi|cci/, "6354", "Droits d'enregistrement"],
    [/expert comptable|fiduciaire/, "6226", "Honoraires"],
    [/coworking|loyer|bail/, "6132", "Locations immobilières"],
  ];
  const match = patterns.find(([pattern]) => pattern.test(label));
  if (!match) return null;
  const [, account, accountLabel] = match;
  const isCredit = Number(transaction.amount) >= 0;
  return {
    id: `pattern:${account}:${transaction.id}`,
    accountDebit: isCredit ? "5121" : account,
    accountDebitLabel: isCredit ? "Banque" : accountLabel,
    accountCredit: isCredit ? account : "5121",
    accountCreditLabel: isCredit ? accountLabel : "Banque",
    ecritureLabel: `${transaction.counterparty ?? "Transaction"} - ${transaction.label}`,
    vatRate: null,
    vatOperationNature: null,
    confidence: "MEDIUM",
    source: "PATTERN",
    rationale: "Pattern déterministe Qitus.",
    badge: "suggérée",
  };
}

function reviewSuggestion(transaction: TransactionShape): TransactionSuggestion {
  return {
    id: `review:${transaction.id}`,
    accountDebit: "471",
    accountDebitLabel: "Compte d'attente",
    accountCredit: "5121",
    accountCreditLabel: "Banque",
    ecritureLabel: transaction.label,
    vatRate: null,
    vatOperationNature: null,
    confidence: "LOW",
    source: "REVIEW",
    rationale: "Aucune règle fiable. Laisse en compte d'attente et fais valider manuellement.",
    badge: "à vérifier",
  };
}

function uniqueSuggestions(suggestions: TransactionSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = `${suggestion.accountDebit}:${suggestion.accountCredit}:${suggestion.ecritureLabel}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type TransactionShape = {
  id: string;
  label: string;
  normalizedLabel: string;
  counterparty: string | null;
  amount: unknown;
};
