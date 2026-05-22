import type { ImportSource } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { ExpectedRouteError } from "../route-errors.server";
import { ImportCleanupStore } from "./import-cleanup-store.server";

export type ImportCleanupPreview = {
  importIds: string[];
  importCount: number;
  transactionCount: number;
  journalEntryCount: number;
  journalLineCount: number;
  sources: ImportSource[];
  warnings: string[];
};

export type ImportCleanupResult = ImportCleanupPreview & {
  deletedAt: string;
};

type ImportCleanupStoreLike = Pick<
  ImportCleanupStore,
  "previewImportDeletion" | "previewFiscalYearImportReset" | "deleteImports"
>;

type ActivityLike = Pick<ActivityLogCenter, "recordActivity">;

export class ImportCleanupCenter {
  constructor(
    private readonly store: ImportCleanupStoreLike = new ImportCleanupStore(),
    private readonly activity: ActivityLike = new ActivityLogCenter()
  ) {}

  async previewImportDeletion(workspace: CompanyWorkspace, importId: string): Promise<ImportCleanupPreview> {
    return this.store.previewImportDeletion(workspace, importId);
  }

  async deleteImport(workspace: CompanyWorkspace, input: { importId: string; confirmation: string }): Promise<ImportCleanupResult> {
    assertConfirmation(input.confirmation, "SUPPRIMER");
    const result = withDeletedAt(await this.store.deleteImports(workspace, [input.importId]));
    await this.activity.recordActivity(workspace, {
      action: "import.deleted",
      entityType: "import",
      entityId: input.importId,
      metadata: cleanupMetadata(result),
    });
    return result;
  }

  async previewFiscalYearImportReset(workspace: CompanyWorkspace): Promise<ImportCleanupPreview> {
    return this.store.previewFiscalYearImportReset(workspace);
  }

  async resetFiscalYearImports(workspace: CompanyWorkspace, input: { confirmation: string }): Promise<ImportCleanupResult> {
    assertConfirmation(input.confirmation, "RESET IMPORTS");
    const preview = await this.store.previewFiscalYearImportReset(workspace);
    await this.activity.recordActivity(workspace, {
      action: "import.reset_requested",
      entityType: "import",
      entityId: workspace.fiscalYear.id,
      metadata: cleanupMetadata(preview),
    });
    const result = withDeletedAt(await this.store.deleteImports(workspace, preview.importIds));
    await this.activity.recordActivity(workspace, {
      action: "import.reset_completed",
      entityType: "import",
      entityId: workspace.fiscalYear.id,
      metadata: cleanupMetadata(result),
    });
    return result;
  }
}

function assertConfirmation(value: string, expected: string) {
  if (value.trim() !== expected) {
    throw new ExpectedRouteError(`Confirmation invalide. Saisissez exactement "${expected}".`, 400);
  }
}

function withDeletedAt(preview: ImportCleanupPreview): ImportCleanupResult {
  return { ...preview, deletedAt: new Date().toISOString() };
}

function cleanupMetadata(preview: ImportCleanupPreview) {
  return {
    importCount: preview.importCount,
    transactionCount: preview.transactionCount,
    journalEntryCount: preview.journalEntryCount,
    journalLineCount: preview.journalLineCount,
    sources: preview.sources,
  };
}
