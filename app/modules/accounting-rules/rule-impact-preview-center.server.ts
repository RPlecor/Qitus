import type { CategorizationStatus, PrismaClient } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";

const PROTECTED_CATEGORIZATION_STATUSES: CategorizationStatus[] = ["USER_CONFIRMED", "USER_CORRECTED", "MANUAL"];

export class RuleImpactPreviewCenter {
  constructor(private readonly db: PrismaClient = prisma) {}

  async previewRulePackImpact(workspace: CompanyWorkspace, rulePackId: string) {
    const [affectedTransactions, conflicts] = await Promise.all([
      this.listAffectedTransactions(workspace, rulePackId),
      this.listConflictsWithUserRules(workspace, rulePackId),
    ]);
    return {
      rulePackId,
      affectedTransactionCount: affectedTransactions.length,
      protectedTransactionCount: affectedTransactions.filter((transaction) => transaction.protected).length,
      conflictCount: conflicts.length,
      affectedTransactions: affectedTransactions.slice(0, 25),
      conflicts,
      safeForAutomaticFutureImports: true,
      existingDataRequiresExplicitAction: affectedTransactions.length > 0,
    };
  }

  async listAffectedTransactions(workspace: CompanyWorkspace, rulePackId: string) {
    const mappings = await this.db.vendorMapping.findMany({ where: { rulePackId, active: true, companyId: null } });
    const transactions = await this.db.transaction.findMany({
      where: { fiscalYearId: workspace.fiscalYear.id },
      include: { categorization: true },
      orderBy: { date: "desc" },
      take: 1000,
    });
    return transactions.flatMap((transaction) => {
      const mapping = mappings.find((candidate) => mappingMatches(candidate, transaction));
      if (!mapping) return [];
      const currentAccount = transaction.categorization?.accountDebit ?? null;
      const wouldChange = currentAccount !== mapping.accountDebit;
      if (!wouldChange) return [];
      return [{
        transactionId: transaction.id,
        date: transaction.date.toISOString().slice(0, 10),
        label: transaction.label,
        counterparty: transaction.counterparty,
        amount: Number(transaction.amount),
        currentAccount,
        suggestedAccount: mapping.accountDebit,
        suggestedLabel: mapping.accountLabel,
        protected: transaction.categorization ? PROTECTED_CATEGORIZATION_STATUSES.includes(transaction.categorization.status) : false,
      }];
    });
  }

  async listConflictsWithUserRules(workspace: CompanyWorkspace, rulePackId: string) {
    const [mappings, rules] = await Promise.all([
      this.db.vendorMapping.findMany({ where: { rulePackId, active: true, companyId: null } }),
      this.db.correctionRule.findMany({ where: { fiscalYearId: workspace.fiscalYear.id, active: true } }),
    ]);
    return rules.flatMap((rule) => {
      const mapping = mappings.find((candidate) => rule.counterparty.toLowerCase().includes(candidate.pattern.toLowerCase()) || candidate.pattern.toLowerCase().includes(rule.counterparty.toLowerCase()));
      if (!mapping) return [];
      if (mapping.accountDebit === rule.preferredAccount) return [];
      return [{
        ruleId: rule.id,
        counterparty: rule.counterparty,
        userAccount: rule.preferredAccount,
        qitusAccount: mapping.accountDebit,
        qitusPattern: mapping.pattern,
      }];
    });
  }
}

function mappingMatches(mapping: { pattern: string; matchType: string }, transaction: { counterparty: string | null; normalizedLabel: string; label: string }) {
  const pattern = mapping.pattern.toLowerCase();
  const counterparty = transaction.counterparty?.toLowerCase() ?? "";
  const normalizedLabel = transaction.normalizedLabel.toLowerCase();
  const label = transaction.label.toLowerCase();
  if (mapping.matchType === "VENDOR_EXACT") return counterparty === pattern;
  if (mapping.matchType === "VENDOR_CONTAINS") return counterparty.includes(pattern);
  if (mapping.matchType === "LABEL_KEYWORD") return normalizedLabel.includes(pattern) || label.includes(pattern);
  if (mapping.matchType === "LABEL_REGEX") return new RegExp(mapping.pattern, "i").test(transaction.label);
  return false;
}
