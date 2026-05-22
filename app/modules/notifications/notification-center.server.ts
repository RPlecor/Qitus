import { Prisma, type Notification, type NotificationSeverity, type NotificationType } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import type { NotificationSource, NotificationSpec } from "./notification-source.server";
import { defaultNotificationSources } from "./notification-sources.server";

export type NotificationFilters = {
  type?: string | null;
  severity?: string | null;
  unreadOnly?: boolean;
  includeDismissed?: boolean;
  limit?: number;
};

export type NotificationSummary = {
  total: number;
  unread: number;
  blocking: number;
  warning: number;
};

export type NotificationListItem = {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
  metadata: unknown;
};

export type NotificationCenterOptions = {
  sources?: NotificationSource[];
  activity?: ActivityLogCenter;
};

export class NotificationCenter {
  private readonly sources: NotificationSource[];
  private readonly activity: ActivityLogCenter;

  constructor(options: NotificationCenterOptions = {}) {
    this.sources = options.sources ?? defaultNotificationSources();
    this.activity = options.activity ?? new ActivityLogCenter();
  }

  async refreshNotifications(workspace: CompanyWorkspace) {
    const specs = await this.buildNotificationSpecs(workspace);
    const activeKeys = new Set(specs.map((spec) => spec.dedupeKey));
    const notifications = await Promise.all(specs.map((spec) => this.upsertNotification(workspace, spec)));
    await prisma.notification.updateMany({
      where: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        dedupeKey: { notIn: [...activeKeys] },
        dismissedAt: null,
        expiresAt: null,
      },
      data: { expiresAt: new Date() },
    });
    return notifications.map(summarizeNotification);
  }

  async listNotifications(workspace: CompanyWorkspace, filters: NotificationFilters = {}) {
    await this.refreshNotifications(workspace);
    const rows = await prisma.notification.findMany({
      where: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        type: parseNotificationType(filters.type),
        severity: parseSeverity(filters.severity),
        readAt: filters.unreadOnly ? null : undefined,
        dismissedAt: filters.includeDismissed ? undefined : null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: clampLimit(filters.limit),
    });
    return rows.map(summarizeNotification);
  }

  async getNotificationSummary(workspace: CompanyWorkspace): Promise<NotificationSummary> {
    const notifications = await this.listNotifications(workspace, { limit: 250 });
    return {
      total: notifications.length,
      unread: notifications.filter((notification) => !notification.read).length,
      blocking: notifications.filter((notification) => notification.severity === "BLOCKING").length,
      warning: notifications.filter((notification) => notification.severity === "WARNING").length,
    };
  }

  async markAsRead(workspace: CompanyWorkspace, notificationId: string) {
    const notification = await this.requireNotification(workspace, notificationId);
    const updated = await prisma.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } });
    await this.activity.recordActivity(workspace, { action: "notification.read", entityType: "notification", entityId: notification.id, metadata: { type: notification.type } });
    return summarizeNotification(updated);
  }

  async markAllAsRead(workspace: CompanyWorkspace) {
    await prisma.notification.updateMany({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, readAt: null, dismissedAt: null },
      data: { readAt: new Date() },
    });
    await this.activity.recordActivity(workspace, { action: "notification.read_all", entityType: "notification", entityId: workspace.fiscalYear.id });
  }

  async dismissNotification(workspace: CompanyWorkspace, notificationId: string) {
    const notification = await this.requireNotification(workspace, notificationId);
    const updated = await prisma.notification.update({ where: { id: notification.id }, data: { dismissedAt: new Date(), readAt: notification.readAt ?? new Date() } });
    await this.activity.recordActivity(workspace, { action: "notification.dismissed", entityType: "notification", entityId: notification.id, metadata: { type: notification.type } });
    return summarizeNotification(updated);
  }

  private async buildNotificationSpecs(workspace: CompanyWorkspace): Promise<NotificationSpec[]> {
    const specs = await Promise.all(this.sources.map((source) => source.listNotificationSpecs(workspace)));
    return specs.flat();
  }

  private async upsertNotification(workspace: CompanyWorkspace, spec: NotificationSpec) {
    return prisma.notification.upsert({
      where: { companyId_fiscalYearId_dedupeKey: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, dedupeKey: spec.dedupeKey } },
      create: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        userId: workspace.user.id,
        type: spec.type,
        severity: spec.severity,
        title: spec.title,
        body: spec.body,
        href: spec.href,
        dedupeKey: spec.dedupeKey,
        expiresAt: spec.expiresAt,
        metadataJson: spec.metadata as Prisma.InputJsonValue | undefined,
      },
      update: {
        type: spec.type,
        severity: spec.severity,
        title: spec.title,
        body: spec.body,
        href: spec.href,
        expiresAt: spec.expiresAt ?? null,
        metadataJson: spec.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private async requireNotification(workspace: CompanyWorkspace, notificationId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
    });
    if (!notification) throw new ExpectedRouteError("Notification introuvable.", 404);
    return notification;
  }
}

function summarizeNotification(row: Notification): NotificationListItem {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    body: row.body,
    href: row.href,
    read: Boolean(row.readAt),
    dismissed: Boolean(row.dismissedAt),
    createdAt: row.createdAt.toISOString(),
    metadata: row.metadataJson,
  };
}

function parseNotificationType(value?: string | null): NotificationType | undefined {
  const allowed: NotificationType[] = ["TRANSACTION_REVIEW", "IMPORT_STATUS", "DOCUMENT_STALE", "VAT_ALERT", "FISCAL_DEADLINE", "REGULATORY_FRESHNESS", "CLOSING_BLOCKER", "USAGE_LIMIT"];
  return allowed.includes(value as NotificationType) ? value as NotificationType : undefined;
}

function parseSeverity(value?: string | null): NotificationSeverity | undefined {
  const allowed: NotificationSeverity[] = ["INFO", "WARNING", "BLOCKING"];
  return allowed.includes(value as NotificationSeverity) ? value as NotificationSeverity : undefined;
}

function clampLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) return 100;
  return Math.min(Math.max(limit, 1), 250);
}
