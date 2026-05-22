import type { CorrectionRule, Transaction } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { ruleMatchesTransaction } from "../transactions/transaction-explorer.server";
import type { CorrectionRuleSummary } from "./correction-rule-center.server";

export type CorrectionRuleImpactInput = {
  counterparty: string;
  preferredAccount: string;
  active?: boolean;
  excludeRuleId?: string | null;
};

export type CorrectionRuleImpact = {
  rule: CorrectionRuleSummary | null;
  count: number;
  health: "healthy" | "broad" | "conflict";
  warnings: string[];
  conflicts: Array<{ id: string; counterparty: string; preferredAccount: string; active: boolean }>;
  transactions: Array<{ id: string; date: string; label: string; amount: string }>;
};

export class CorrectionRuleImpactCenter {
  async previewRuleImpact(workspace: CompanyWorkspace, ruleId: string): Promise<CorrectionRuleImpact> {
    const rule = await this.requireRule(workspace, ruleId);
    return this.previewImpact(workspace, {
      counterparty: rule.counterparty,
      preferredAccount: rule.preferredAccount,
      active: rule.active,
      excludeRuleId: rule.id,
    }, summarizeRule(rule));
  }

  async previewDraftRuleImpact(workspace: CompanyWorkspace, input: CorrectionRuleImpactInput): Promise<CorrectionRuleImpact> {
    return this.previewImpact(workspace, input, null);
  }

  async findConflictingRules(workspace: CompanyWorkspace, input: CorrectionRuleImpactInput) {
    const counterparty = input.counterparty.trim().toLowerCase();
    if (!counterparty) return [];
    const rules = await prisma.correctionRule.findMany({
      where: {
        fiscalYearId: workspace.fiscalYear.id,
        id: input.excludeRuleId ? { not: input.excludeRuleId } : undefined,
      },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    });
    return rules
      .filter((rule) => rule.active)
      .filter((rule) => {
        const candidate = rule.counterparty.toLowerCase();
        return candidate.includes(counterparty) || counterparty.includes(candidate);
      })
      .map((rule) => ({ id: rule.id, counterparty: rule.counterparty, preferredAccount: rule.preferredAccount, active: rule.active }));
  }

  async summarizeRuleHealth(workspace: CompanyWorkspace) {
    const rules = await prisma.correctionRule.findMany({
      where: { fiscalYearId: workspace.fiscalYear.id },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    });
    const active = rules.filter((rule) => rule.active);
    const broad = active.filter((rule) => rule.counterparty.trim().length < 4 || rule.matchCountSnapshot > 10);
    return {
      total: rules.length,
      active: active.length,
      inactive: rules.length - active.length,
      broad: broad.length,
    };
  }

  private async previewImpact(workspace: CompanyWorkspace, input: CorrectionRuleImpactInput, rule: CorrectionRuleSummary | null): Promise<CorrectionRuleImpact> {
    const counterparty = input.counterparty.trim();
    if (!counterparty) throw new ExpectedRouteError("La contrepartie de la règle est requise.", 400);
    const pseudoRule = { counterparty, active: input.active !== false };
    const [transactions, conflicts] = await Promise.all([
      prisma.transaction.findMany({
        where: { fiscalYearId: workspace.fiscalYear.id },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 500,
      }),
      this.findConflictingRules(workspace, input),
    ]);
    const matches = transactions.filter((transaction) => ruleMatchesTransaction(pseudoRule, transaction));
    const warnings = buildWarnings(counterparty, matches.length, transactions.length, conflicts.length);
    return {
      rule,
      count: matches.length,
      health: conflicts.length > 0 ? "conflict" : warnings.length > 0 ? "broad" : "healthy",
      warnings,
      conflicts,
      transactions: matches.slice(0, 20).map(summarizeTransaction),
    };
  }

  private async requireRule(workspace: CompanyWorkspace, ruleId: string): Promise<CorrectionRule> {
    const rule = await prisma.correctionRule.findFirst({ where: { id: ruleId, fiscalYearId: workspace.fiscalYear.id } });
    if (!rule) throw new ExpectedRouteError("Règle de correction introuvable.", 404);
    return rule;
  }
}

function buildWarnings(counterparty: string, matchCount: number, totalTransactions: number, conflictCount: number) {
  const warnings: string[] = [];
  if (counterparty.length < 4) warnings.push("Règle potentiellement trop large : contrepartie très courte.");
  if (totalTransactions > 0 && matchCount / totalTransactions > 0.25) warnings.push("Règle potentiellement trop large : elle matche plus de 25 % des transactions.");
  if (matchCount > 10) warnings.push("Règle à surveiller : impact élevé sur l'historique.");
  if (conflictCount > 0) warnings.push("Règle en concurrence avec une règle existante.");
  return warnings;
}

function summarizeTransaction(transaction: Transaction) {
  return {
    id: transaction.id,
    date: transaction.date.toISOString(),
    label: transaction.label,
    amount: transaction.amount.toString(),
  };
}

function summarizeRule(rule: CorrectionRule): CorrectionRuleSummary {
  return {
    id: rule.id,
    counterparty: rule.counterparty,
    preferredAccount: rule.preferredAccount,
    preferredAccountLabel: rule.preferredAccountLabel,
    preferredVatRate: rule.preferredVatRate?.toString() ?? null,
    vatOperationNature: rule.vatOperationNature,
    condition: rule.condition,
    active: rule.active,
    sourceTransactionId: rule.sourceTransactionId,
    note: rule.note,
    matchCountSnapshot: rule.matchCountSnapshot,
    lastMatchedAt: rule.lastMatchedAt?.toISOString() ?? null,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}
