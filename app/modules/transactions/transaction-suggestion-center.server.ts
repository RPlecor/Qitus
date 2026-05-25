import type { Categorization, Confidence, CorrectionRule, VendorMapping } from "@prisma/client";
import { AccountingReferencePolicyCenter, type AccountingAccountRoleValue } from "../accounting-reference/accounting-reference-policy-center.server";
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
  constructor(private readonly accountPolicy = new AccountingReferencePolicyCenter()) {}

  async getSuggestions(workspace: CompanyWorkspace, transactionId: string): Promise<TransactionSuggestion[]> {
    const [transaction, rules, mappings, bankRole, suspenseRole] = await Promise.all([
      prisma.transaction.findFirstOrThrow({
        where: { id: transactionId, fiscalYearId: workspace.fiscalYear.id },
        include: { categorization: true },
      }),
      prisma.correctionRule.findMany({ where: { fiscalYearId: workspace.fiscalYear.id, active: true }, orderBy: { createdAt: "desc" } }),
      prisma.vendorMapping.findMany({
        where: { active: true, OR: [{ companyId: null }, { companyId: workspace.company.id }] },
        orderBy: [{ companyId: "desc" }, { hitCount: "desc" }],
      }),
      this.accountPolicy.getAccountRole("bank"),
      this.accountPolicy.getAccountRole("suspense"),
    ]);

    const suggestions = [
      currentSuggestion(transaction.categorization),
      rules.map((rule) => ruleSuggestion(transaction, rule, bankRole)).find(Boolean) ?? null,
      mappings.map((mapping) => mappingSuggestion(transaction, mapping, bankRole)).find(Boolean) ?? null,
    ].filter((suggestion): suggestion is TransactionSuggestion => Boolean(suggestion));

    if (suggestions.length === 0) suggestions.push(reviewSuggestion(transaction, bankRole, suspenseRole));
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

function ruleSuggestion(transaction: TransactionShape, rule: CorrectionRule, bankRole: AccountingAccountRoleValue): TransactionSuggestion | null {
  if (!ruleMatchesTransaction(rule, transaction)) return null;
  const isCredit = Number(transaction.amount) >= 0;
  return {
    id: `rule:${rule.id}:${transaction.id}`,
    accountDebit: isCredit ? bankRole.account : rule.preferredAccount,
    accountDebitLabel: isCredit ? bankRole.label : rule.preferredAccountLabel,
    accountCredit: isCredit ? rule.preferredAccount : bankRole.account,
    accountCreditLabel: isCredit ? rule.preferredAccountLabel : bankRole.label,
    ecritureLabel: `${transaction.counterparty ?? "Transaction"} - ${transaction.label}`,
    vatRate: rule.preferredVatRate?.toString() ?? null,
    vatOperationNature: rule.vatOperationNature,
    confidence: "HIGH",
    source: "CORRECTION_RULE",
    rationale: `Règle utilisateur active pour "${rule.counterparty}".`,
    badge: "suggérée",
  };
}

function mappingSuggestion(transaction: TransactionShape, mapping: VendorMapping, bankRole: AccountingAccountRoleValue): TransactionSuggestion | null {
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
    accountDebit: isCredit ? bankRole.account : mapping.accountDebit,
    accountDebitLabel: isCredit ? bankRole.label : mapping.accountLabel,
    accountCredit: isCredit ? mapping.accountDebit : mapping.accountCredit,
    accountCreditLabel: isCredit ? mapping.accountLabel : bankRole.label,
    ecritureLabel: mapping.ecritureLabel ?? `${transaction.counterparty ?? "Transaction"} - ${transaction.label}`,
    vatRate: mapping.vatRate?.toString() ?? null,
    vatOperationNature: mapping.vatOperationNature,
    confidence: "HIGH",
    source: mapping.matchType.toString().startsWith("LABEL") ? "PATTERN" : "VENDOR_MAPPING",
    rationale: `Mapping déterministe "${mapping.pattern}".`,
    badge: "suggérée",
  };
}

function reviewSuggestion(transaction: TransactionShape, bankRole: AccountingAccountRoleValue, suspenseRole: AccountingAccountRoleValue): TransactionSuggestion {
  return {
    id: `review:${transaction.id}`,
    accountDebit: suspenseRole.account,
    accountDebitLabel: suspenseRole.label,
    accountCredit: bankRole.account,
    accountCreditLabel: bankRole.label,
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
