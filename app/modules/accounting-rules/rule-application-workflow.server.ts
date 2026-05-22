import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../db.server";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { AccountingRulePackCenter } from "./accounting-rule-pack-center.server";
import { RuleImpactPreviewCenter } from "./rule-impact-preview-center.server";

export class RuleApplicationWorkflow {
  constructor(
    private readonly packs = new AccountingRulePackCenter(),
    private readonly preview = new RuleImpactPreviewCenter(),
    private readonly activity = new ActivityLogCenter(),
    private readonly db: PrismaClient = prisma
  ) {}

  async getRuleUpdateStatus(workspace: CompanyWorkspace) {
    const activePack = await this.packs.getActiveRulePack();
    if (!activePack) return { status: "missing_pack" as const, activePack: null, application: null, impact: null };
    const application = await this.db.accountingRuleApplication.findUnique({
      where: {
        companyId_fiscalYearId_rulePackId: {
          companyId: workspace.company.id,
          fiscalYearId: workspace.fiscalYear.id,
          rulePackId: activePack.id,
        },
      },
    });
    const impact = application?.impactJson ?? await this.preview.previewRulePackImpact(workspace, activePack.id);
    return {
      status: application ? application.status.toLowerCase() : "available",
      activePack,
      application,
      impact,
    };
  }

  async applyActiveRulePackToWorkspace(workspace: CompanyWorkspace) {
    const activePack = await this.packs.getActiveRulePack();
    if (!activePack) {
      const pack = await this.packs.syncSeedRulePack();
      return this.applyPack(workspace, pack.id);
    }
    return this.applyPack(workspace, activePack.id);
  }

  async markImpactsForExistingData(workspace: CompanyWorkspace) {
    return this.getRuleUpdateStatus(workspace);
  }

  private async applyPack(workspace: CompanyWorkspace, rulePackId: string) {
    const impact = await this.preview.previewRulePackImpact(workspace, rulePackId);
    const application = await this.db.accountingRuleApplication.upsert({
      where: {
        companyId_fiscalYearId_rulePackId: {
          companyId: workspace.company.id,
          fiscalYearId: workspace.fiscalYear.id,
          rulePackId,
        },
      },
      update: {
        status: "AUTO_APPLIED",
        appliedAt: new Date(),
        impactJson: impact,
        note: "Application automatique aux futurs imports. Les données existantes restent inchangées.",
      },
      create: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        rulePackId,
        status: "AUTO_APPLIED",
        appliedAt: new Date(),
        impactJson: impact,
        note: "Application automatique aux futurs imports. Les données existantes restent inchangées.",
      },
    });
    await this.activity.recordActivity(workspace, {
      action: "accounting_rule_update.applied",
      entityType: "accounting_rule_pack",
      entityId: rulePackId,
      metadata: {
        affectedTransactionCount: impact.affectedTransactionCount,
        conflictCount: impact.conflictCount,
      },
    });
    return { application, impact };
  }
}
