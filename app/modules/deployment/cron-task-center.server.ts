import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { getDevCompanyWorkspace, type CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { NotificationCenter } from "../notifications/notification-center.server";
import { RegulatoryFreshnessCenter } from "../regulatory/regulatory-freshness-center.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export class CronTaskCenter {
  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async runRegulatoryFreshnessCheck(workspace?: CompanyWorkspace) {
    workspace ??= await getDevCompanyWorkspace();
    await new RegulatoryFreshnessCenter().recordFreshnessCheck(workspace, { source: "cron", ok: true });
    return { task: "regulatory_freshness", status: "done" as const };
  }

  async refreshFiscalDeadlineNotifications(workspace?: CompanyWorkspace) {
    workspace ??= await getDevCompanyWorkspace();
    const notifications = await new NotificationCenter().refreshNotifications(workspace);
    await this.activity.recordActivity(workspace, {
      action: "cron.notifications_refreshed",
      entityType: "cron",
      entityId: "notifications",
      metadata: { count: notifications.length },
    });
    return { task: "notifications", status: "done" as const, count: notifications.length };
  }

  async cleanupTemporaryWorkdirs(root = path.join(process.cwd(), "tmp")) {
    const maxAgeMs = this.config.workdirCleanupMaxAgeMinutes * 60_000;
    const now = Date.now();
    let deleted = 0;
    for (const entry of await readdir(root).catch(() => [])) {
      const candidate = path.join(root, entry);
      const stats = await stat(candidate).catch(() => null);
      if (!stats) continue;
      if (now - stats.mtimeMs <= maxAgeMs) continue;
      await rm(candidate, { recursive: true, force: true });
      deleted += 1;
    }
    return { task: "cleanup_workdirs", status: "done" as const, deleted };
  }

  async getCronStatus() {
    return {
      mode: this.config.cronMode,
      workdirCleanupMaxAgeMinutes: this.config.workdirCleanupMaxAgeMinutes,
      tasks: ["regulatory_freshness", "notifications", "cleanup_workdirs"],
    };
  }
}
