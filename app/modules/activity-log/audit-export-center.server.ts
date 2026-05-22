import { ActivityLogCenter, type ActivityLogFilters } from "./activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";

export class AuditExportCenter {
  constructor(private readonly activity = new ActivityLogCenter()) {}

  async exportActivityCsv(workspace: CompanyWorkspace, filters: ActivityLogFilters = {}) {
    return this.activity.exportActivityCsv(workspace, filters);
  }

  async exportAuditJson(workspace: CompanyWorkspace, filters: ActivityLogFilters = {}) {
    const activity = await this.activity.listActivity(workspace, { ...filters, limit: filters.limit ?? 1000 });
    return {
      company: { id: workspace.company.id, name: workspace.company.name },
      fiscalYear: {
        id: workspace.fiscalYear.id,
        startDate: workspace.fiscalYear.startDate.toISOString(),
        endDate: workspace.fiscalYear.endDate.toISOString(),
        status: workspace.fiscalYear.status,
      },
      generatedAt: new Date().toISOString(),
      activity,
    };
  }

  async getAuditCoverage(workspace: CompanyWorkspace) {
    const rows = await this.activity.listActivity(workspace, { limit: 1000 });
    const actions = new Set(rows.map((row) => row.action));
    const entityTypes = new Set(rows.map((row) => row.entityType).filter(Boolean));
    return {
      activityCount: rows.length,
      actionCount: actions.size,
      entityTypes: [...entityTypes],
      hasImports: [...actions].some((action) => action.startsWith("import.")),
      hasDocuments: [...actions].some((action) => action.startsWith("document")),
      hasClosing: [...actions].some((action) => action.startsWith("annual_closing.")),
      hasPrivacy: [...actions].some((action) => action.startsWith("privacy.")),
    };
  }
}
