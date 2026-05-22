import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { AccountingRulePackCenter } from "../accounting-rules/accounting-rule-pack-center.server";
import { prisma } from "../db.server";

const MAX_REGULATORY_AGE_DAYS = 30;

export type RegulatoryFreshness = {
  status: "unknown" | "fresh" | "stale";
  label: string;
  lastCheckedAt: string | null;
  ageDays: number | null;
  activeRulePackVersion?: string | null;
  activeRulePackActivatedAt?: string | null;
};

export class RegulatoryFreshnessCenter {
  constructor(private readonly rulePacks = new AccountingRulePackCenter()) {}

  async getFreshness(workspace: CompanyWorkspace): Promise<RegulatoryFreshness> {
    const [latest, activeRulePack] = await Promise.all([
      prisma.activityLog.findFirst({
        where: { companyId: workspace.company.id, action: "regulatory_freshness.checked" },
        orderBy: { createdAt: "desc" },
      }),
      this.rulePacks.getActiveRulePack(),
    ]);
    if (!latest) {
      return {
        status: "unknown",
        label: "Fraîcheur réglementaire non vérifiée",
        lastCheckedAt: null,
        ageDays: null,
        activeRulePackVersion: activeRulePack?.version ?? null,
        activeRulePackActivatedAt: activeRulePack?.activatedAt?.toISOString() ?? null,
      };
    }
    const ageDays = Math.floor((Date.now() - latest.createdAt.getTime()) / 86_400_000);
    return {
      status: ageDays > MAX_REGULATORY_AGE_DAYS ? "stale" : "fresh",
      label: ageDays > MAX_REGULATORY_AGE_DAYS ? "Fraîcheur réglementaire à vérifier" : "Fraîcheur réglementaire vérifiée",
      lastCheckedAt: latest.createdAt.toISOString(),
      ageDays,
      activeRulePackVersion: activeRulePack?.version ?? null,
      activeRulePackActivatedAt: activeRulePack?.activatedAt?.toISOString() ?? null,
    };
  }

  async recordFreshnessCheck(workspace: CompanyWorkspace, input: { source?: string; ok?: boolean } = {}) {
    return prisma.activityLog.create({
      data: {
        companyId: workspace.company.id,
        userId: workspace.user.id,
        action: "regulatory_freshness.checked",
        entityType: "regulatory_freshness",
        entityId: workspace.fiscalYear.id,
        metadata: { source: input.source ?? "manual", ok: input.ok ?? true },
      },
    });
  }

  async buildRegulatoryNotifications(workspace: CompanyWorkspace) {
    const freshness = await this.getFreshness(workspace);
    if (freshness.status === "fresh") return [];
    return [{
      type: "REGULATORY_FRESHNESS" as const,
      severity: "WARNING" as const,
      title: freshness.label,
      body: freshness.status === "unknown"
        ? "Aucune vérification réglementaire locale n'a encore été enregistrée."
        : `Dernière vérification il y a ${freshness.ageDays} jours. Pack actif : ${freshness.activeRulePackVersion ?? "non initialisé"}.`,
      href: "/notifications",
      dedupeKey: "regulatory:freshness",
      metadata: freshness,
    }];
  }
}
