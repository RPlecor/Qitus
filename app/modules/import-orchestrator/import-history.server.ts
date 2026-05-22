import type { Import, ImportStatus } from "@prisma/client";
import { canRetryCategorization } from "./import-actions.server";
import { ImportStore } from "./import-store.server";

export type ImportSummary = {
  id: string;
  createdAt: string;
  filename: string;
  format: string;
  totalRows: number;
  parsedRows: number;
  categorizedRows: number;
  reviewRows: number;
  currentStep: string | null;
  progress: number;
  durationMs: number | null;
  errorMessage: string | null;
  status: ImportStatus;
  statusKind: "done" | "warn" | "error" | "pending";
  actions: {
    needsMapping: boolean;
    canRetry: boolean;
    canRetryCategorization: boolean;
  };
};

export class ImportHistory {
  constructor(private readonly store = new ImportStore()) {}

  async listImports(fiscalYearId: string): Promise<ImportSummary[]> {
    const imports = await this.store.listImports(fiscalYearId);
    return imports.map((importRow) => this.summarizeImport(importRow));
  }

  summarizeImport(importRow: Import): ImportSummary {
    return {
      id: importRow.id,
      createdAt: importRow.createdAt.toISOString(),
      filename: importRow.originalFilename ?? "Import CSV",
      format: importRow.fileFormat ?? "inconnu",
      totalRows: importRow.totalRows,
      parsedRows: importRow.parsedRows,
      categorizedRows: importRow.categorizedRows,
      reviewRows: importRow.reviewRows,
      currentStep: importRow.currentStep,
      progress: importRow.progress,
      durationMs: importRow.durationMs,
      errorMessage: importRow.lastErrorMessage ?? importRow.errorMessage,
      status: importRow.status,
      statusKind: statusKind(importRow.status),
      actions: {
        needsMapping: importRow.status === "NEEDS_MAPPING",
        canRetry: importRow.status === "ERROR",
        canRetryCategorization: canRetryCategorization(importRow),
      },
    };
  }
}

function statusKind(status: ImportStatus): ImportSummary["statusKind"] {
  if (status === "DONE") return "done";
  if (status === "REVIEW" || status === "NEEDS_MAPPING") return "warn";
  if (status === "ERROR") return "error";
  return "pending";
}
