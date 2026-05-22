import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { EntitlementGate } from "../billing/entitlement-gate.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import type { CsvImportUpload } from "./import-orchestrator.server";

export class ImportSideEffects {
  constructor(
    private readonly activity = new ActivityLogCenter(),
    private readonly entitlements = new EntitlementGate(),
    private readonly meterUsage = true
  ) {}

  async assertCanStartImport(workspace: CompanyWorkspace) {
    if (this.meterUsage) await this.entitlements.assertCanUse(workspace, "import");
  }

  async recordImportUsage(workspace: CompanyWorkspace, importId: string, file: CsvImportUpload) {
    if (this.meterUsage) {
      await this.entitlements.recordUsage(workspace, "import", { importId, filename: file.filename });
    }
  }

  async recordImportActivity(workspace: CompanyWorkspace, action: string, entityId: string, metadata: Record<string, unknown> = {}) {
    await this.activity.recordActivity(workspace, { action, entityType: "import", entityId, metadata });
  }
}
