import type { UsageEventKind } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { ExpectedRouteError } from "../route-errors.server";
import { UsageMeter } from "./usage-meter.server";

export type EntitlementCapability = "chat" | "import" | "ai-categorization";

export type EntitlementStatus = {
  capability: EntitlementCapability;
  kind: UsageEventKind;
  allowed: boolean;
  blockedReason: "monthly_quota" | "rate_limit" | null;
  summary: Awaited<ReturnType<UsageMeter["getUsageSummary"]>>;
};

export class EntitlementGate {
  constructor(
    private readonly usage = new UsageMeter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async assertCanUse(workspace: CompanyWorkspace, capability: EntitlementCapability, quantity = 1) {
    const kind = usageKindForCapability(capability);
    const status = await this.getEntitlementStatus(workspace, capability, quantity);
    if (!status.allowed) await this.recordLimitReached(workspace, status);
    if (status.blockedReason === "monthly_quota") {
      throw new ExpectedRouteError(`Quota ${capabilityLabel(capability)} atteint pour ce mois. Consultez /abonnement.`, 402);
    }
    if (status.blockedReason === "rate_limit") {
      throw new ExpectedRouteError(`Limite minute atteinte pour ${capabilityLabel(capability)}. Réessayez dans quelques instants.`, 429);
    }
    return { kind };
  }

  async recordUsage(workspace: CompanyWorkspace, capability: EntitlementCapability, metadata: Record<string, unknown> = {}) {
    return this.usage.recordUsage(workspace, { kind: usageKindForCapability(capability), metadata });
  }

  async getEntitlementStatus(workspace: CompanyWorkspace, capability: EntitlementCapability, quantity = 1): Promise<EntitlementStatus> {
    const kind = usageKindForCapability(capability);
    const summary = await this.usage.getUsageSummary(workspace);
    if (await this.usage.wouldExceed(workspace, kind, quantity)) {
      return { capability, kind, allowed: false, blockedReason: "monthly_quota", summary };
    }
    if (await this.usage.wouldExceedRateLimit(workspace, quantity)) {
      return { capability, kind, allowed: false, blockedReason: "rate_limit", summary };
    }
    return { capability, kind, allowed: true, blockedReason: null, summary };
  }

  private async recordLimitReached(workspace: CompanyWorkspace, status: EntitlementStatus) {
    await this.activity.recordActivity(workspace, {
      action: "usage.limit_reached",
      entityType: "usage",
      entityId: status.capability,
      metadata: {
        capability: status.capability,
        kind: status.kind,
        reason: status.blockedReason,
        periodKey: status.summary.periodKey,
        usage: status.summary.usage,
        limits: status.summary.subscription.limits,
        rateLimit: status.summary.rateLimit,
      },
    });
  }
}

export function usageKindForCapability(capability: EntitlementCapability): UsageEventKind {
  if (capability === "import") return "IMPORT";
  if (capability === "ai-categorization") return "AI_CATEGORIZATION";
  return "AI_CHAT_MESSAGE";
}

function capabilityLabel(capability: EntitlementCapability) {
  if (capability === "import") return "d'import";
  if (capability === "ai-categorization") return "IA";
  return "chat IA";
}
