import type { CorrectionRule } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { parseVatOperationNature as parseVatNaturePolicy, parseVatRate as parseVatRatePolicy } from "../vat/vat-rate-policy";
import { CorrectionRuleImpactCenter } from "./correction-rule-impact-center.server";

export type CorrectionRuleSummary = {
  id: string;
  counterparty: string;
  preferredAccount: string;
  preferredAccountLabel: string | null;
  preferredVatRate: string | null;
  vatOperationNature: string | null;
  condition: string | null;
  active: boolean;
  sourceTransactionId: string | null;
  note: string | null;
  matchCountSnapshot: number;
  lastMatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export class CorrectionRuleCenter {
  constructor(
    private readonly activity = new ActivityLogCenter(),
    private readonly impactCenter = new CorrectionRuleImpactCenter()
  ) {}

  async listRules(workspace: CompanyWorkspace, filters: { active?: boolean | null; search?: string | null } = {}) {
    const rows = await prisma.correctionRule.findMany({
      where: {
        fiscalYearId: workspace.fiscalYear.id,
        active: typeof filters.active === "boolean" ? filters.active : undefined,
        counterparty: filters.search ? { contains: filters.search, mode: "insensitive" } : undefined,
      },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    });
    return rows.map(summarizeRule);
  }

  async createRuleFromTransaction(
    workspace: CompanyWorkspace,
    input: { transactionId: string; preferredAccount: string; preferredAccountLabel?: string | null; preferredVatRate?: string | number | null; vatOperationNature?: string | null; note?: string | null }
  ) {
    const transaction = await prisma.transaction.findFirstOrThrow({
      where: { id: input.transactionId, fiscalYearId: workspace.fiscalYear.id },
    });
    return this.createRule(workspace, {
      counterparty: transaction.counterparty ?? transaction.normalizedLabel,
      preferredAccount: input.preferredAccount,
      preferredAccountLabel: input.preferredAccountLabel ?? null,
      preferredVatRate: input.preferredVatRate ?? null,
      vatOperationNature: input.vatOperationNature ?? null,
      sourceTransactionId: transaction.id,
      note: input.note ?? null,
    });
  }

  async createRule(
    workspace: CompanyWorkspace,
    input: { counterparty: string; preferredAccount: string; preferredAccountLabel?: string | null; preferredVatRate?: string | number | null; vatOperationNature?: string | null; condition?: string | null; sourceTransactionId?: string | null; note?: string | null }
  ) {
    const counterparty = input.counterparty.trim();
    if (!counterparty) throw new ExpectedRouteError("La contrepartie de la règle est requise.", 400);
    const existing = await prisma.correctionRule.findFirst({
      where: { fiscalYearId: workspace.fiscalYear.id, counterparty, preferredAccount: input.preferredAccount },
    });
    const row = existing
      ? await prisma.correctionRule.update({
          where: { id: existing.id },
          data: { active: true, disabledAt: null, preferredAccountLabel: input.preferredAccountLabel, preferredVatRate: parseVatRate(input.preferredVatRate), vatOperationNature: parseVatOperationNature(input.vatOperationNature), condition: input.condition, note: input.note },
        })
      : await prisma.correctionRule.create({
          data: {
            fiscalYearId: workspace.fiscalYear.id,
            counterparty,
            preferredAccount: input.preferredAccount,
            preferredAccountLabel: input.preferredAccountLabel,
            preferredVatRate: parseVatRate(input.preferredVatRate),
            vatOperationNature: parseVatOperationNature(input.vatOperationNature),
            condition: input.condition,
            sourceTransactionId: input.sourceTransactionId,
            note: input.note,
          },
        });
    await this.refreshRuleImpact(workspace, row.id);
    await this.activity.recordActivity(workspace, {
      action: existing ? "correction_rule.updated" : "correction_rule.created",
      entityType: "correction_rule",
      entityId: row.id,
      metadata: { counterparty, preferredAccount: input.preferredAccount },
    });
    return summarizeRule(await prisma.correctionRule.findUniqueOrThrow({ where: { id: row.id } }));
  }

  async updateRule(
    workspace: CompanyWorkspace,
    ruleId: string,
    input: { active?: boolean; counterparty?: string; preferredAccount?: string; preferredAccountLabel?: string | null; condition?: string | null; note?: string | null }
  ) {
    const current = await this.requireRule(workspace, ruleId);
    const row = await prisma.correctionRule.update({
      where: { id: current.id },
      data: {
        counterparty: input.counterparty?.trim() || undefined,
        preferredAccount: input.preferredAccount || undefined,
        preferredAccountLabel: input.preferredAccountLabel,
        condition: input.condition,
        note: input.note,
        active: input.active,
        disabledAt: input.active === false ? new Date() : input.active === true ? null : undefined,
      },
    });
    await this.refreshRuleImpact(workspace, row.id);
    await this.activity.recordActivity(workspace, {
      action: row.active ? "correction_rule.updated" : "correction_rule.disabled",
      entityType: "correction_rule",
      entityId: row.id,
      metadata: { counterparty: row.counterparty, preferredAccount: row.preferredAccount },
    });
    return summarizeRule(await prisma.correctionRule.findUniqueOrThrow({ where: { id: row.id } }));
  }

  async deleteRule(workspace: CompanyWorkspace, ruleId: string) {
    const current = await this.requireRule(workspace, ruleId);
    await prisma.correctionRule.update({ where: { id: current.id }, data: { active: false, disabledAt: new Date() } });
    await this.activity.recordActivity(workspace, {
      action: "correction_rule.disabled",
      entityType: "correction_rule",
      entityId: current.id,
      metadata: { counterparty: current.counterparty, preferredAccount: current.preferredAccount },
    });
    return { deleted: false, disabled: true };
  }

  async previewRuleImpact(workspace: CompanyWorkspace, ruleId: string) {
    return this.impactCenter.previewRuleImpact(workspace, ruleId);
  }

  private async refreshRuleImpact(workspace: CompanyWorkspace, ruleId: string) {
    const impact = await this.impactCenter.previewRuleImpact(workspace, ruleId);
    await prisma.correctionRule.update({
      where: { id: ruleId },
      data: {
        matchCountSnapshot: impact.count,
        lastMatchedAt: impact.count > 0 ? new Date() : null,
      },
    });
  }

  private async requireRule(workspace: CompanyWorkspace, ruleId: string): Promise<CorrectionRule> {
    const rule = await prisma.correctionRule.findFirst({ where: { id: ruleId, fiscalYearId: workspace.fiscalYear.id } });
    if (!rule) throw new ExpectedRouteError("Règle de correction introuvable.", 404);
    return rule;
  }
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

function parseVatOperationNature(value: string | null | undefined) {
  return parseVatNaturePolicy(value) as never;
}

function parseVatRate(value: string | number | null | undefined) {
  return parseVatRatePolicy(value);
}
