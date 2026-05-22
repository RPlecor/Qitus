import { Prisma, type UsageEventKind } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { SubscriptionCenter, type SubscriptionState } from "./subscription-center.server";

export type UsageSummary = {
  periodKey: string;
  subscription: SubscriptionState;
  usage: {
    aiCalls: number;
    chatMessages: number;
    aiCategorizations: number;
    imports: number;
  };
  remaining: {
    aiCalls: number;
    imports: number;
  };
  rateLimit: {
    requestsLastMinute: number;
    limit: number;
    remaining: number;
  };
};

export type UsageRecordInput = {
  kind: UsageEventKind;
  quantity?: number;
  metadata?: Record<string, unknown>;
};

export class UsageMeter {
  constructor(private readonly subscriptions = new SubscriptionCenter()) {}

  async getUsageSummary(workspace: CompanyWorkspace, now = new Date()): Promise<UsageSummary> {
    const periodKey = getPeriodKey(now);
    const [subscription, chatMessages, aiCategorizations, imports] = await Promise.all([
      this.subscriptions.getSubscription(workspace),
      this.sumUsage(workspace.company.id, "AI_CHAT_MESSAGE", periodKey),
      this.sumUsage(workspace.company.id, "AI_CATEGORIZATION", periodKey),
      this.sumUsage(workspace.company.id, "IMPORT", periodKey),
    ]);
    const aiCalls = chatMessages + aiCategorizations;
    const requestsLastMinute = await this.sumRecentUsage(workspace.company.id, oneMinuteAgo(now));
    return {
      periodKey,
      subscription,
      usage: { aiCalls, chatMessages, aiCategorizations, imports },
      remaining: {
        aiCalls: Math.max(0, subscription.limits.aiCallsPerMonth - aiCalls),
        imports: Math.max(0, subscription.limits.importsPerMonth - imports),
      },
      rateLimit: {
        requestsLastMinute,
        limit: subscription.limits.requestsPerMinute,
        remaining: Math.max(0, subscription.limits.requestsPerMinute - requestsLastMinute),
      },
    };
  }

  async recordUsage(workspace: CompanyWorkspace, input: UsageRecordInput) {
    return prisma.usageEvent.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        userId: workspace.user.id,
        kind: input.kind,
        quantity: input.quantity ?? 1,
        periodKey: getPeriodKey(),
        metadataJson: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async wouldExceed(workspace: CompanyWorkspace, kind: UsageEventKind, quantity = 1) {
    const summary = await this.getUsageSummary(workspace);
    if (kind === "IMPORT") return summary.usage.imports + quantity > summary.subscription.limits.importsPerMonth;
    if (kind === "AI_CHAT_MESSAGE" || kind === "AI_CATEGORIZATION") {
      return summary.usage.aiCalls + quantity > summary.subscription.limits.aiCallsPerMonth;
    }
    return false;
  }

  async wouldExceedRateLimit(workspace: CompanyWorkspace, quantity = 1, now = new Date()) {
    const summary = await this.getUsageSummary(workspace, now);
    return summary.rateLimit.requestsLastMinute + quantity > summary.subscription.limits.requestsPerMinute;
  }

  private async sumUsage(companyId: string, kind: UsageEventKind, periodKey: string) {
    const result = await prisma.usageEvent.aggregate({
      where: { companyId, kind, periodKey },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  private async sumRecentUsage(companyId: string, since: Date) {
    const result = await prisma.usageEvent.aggregate({
      where: { companyId, createdAt: { gte: since } },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }
}

export function getPeriodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function oneMinuteAgo(date: Date) {
  return new Date(date.getTime() - 60_000);
}
