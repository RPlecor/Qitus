import type { NotificationSeverity, NotificationType } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";

export type NotificationSpec = {
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  href?: string;
  primaryActionLabel?: string;
  dedupeKey: string;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
};

export type NotificationSource = {
  sourceKey: string;
  listNotificationSpecs(workspace: CompanyWorkspace): Promise<NotificationSpec[]>;
};
