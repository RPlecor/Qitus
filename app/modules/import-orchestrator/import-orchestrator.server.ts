import type { ImportSource, ImportStatus, Import, Prisma } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { parseBankCsv } from "../import-pipeline/parsers";
import type { ColumnMapping } from "../import-pipeline/types";
import { categorizeImport } from "../categorization/categorization-flow.server";
import { writeEntriesForImport } from "../ledger/ledger-flow.server";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import {
  BullMqImportExecutor,
  importExecutionMode,
  InlineImportExecutor,
  type ImportExecutionResult,
  type ImportExecutor,
  type ImportJobStep,
  type ImportRunner,
} from "./import-executor.server";
import { ImportFileStore } from "./import-file-store.server";
import { ImportSideEffects } from "./import-side-effects.server";
import { ImportStore } from "./import-store.server";

export type CsvImportUpload = {
  filename: string;
  content: string;
  sourceType?: ImportSource;
  bankAccountId?: string | null;
};

export type ImportStatusOverview = {
  id: string;
  status: ImportStatus;
  currentStep: string | null;
  progress: number;
  totalRows: number;
  parsedRows: number;
  categorizedRows: number;
  reviewRows: number;
  durationMs: number | null;
  error: { code: string | null; message: string | null };
  actions: {
    needsMapping: boolean;
    canRetry: boolean;
    canRetryCategorization: boolean;
  };
};

export type ImportOrchestratorOptions = {
  executor?: ImportExecutor;
  config?: RuntimeConfig;
  activity?: ActivityLogCenter;
  meterUsage?: boolean;
  store?: ImportStore;
  fileStore?: ImportFileStore;
  sideEffects?: ImportSideEffects;
};

export class ImportOrchestrator implements ImportRunner {
  private readonly config: RuntimeConfig;
  private readonly store: ImportStore;
  private readonly fileStore: ImportFileStore;
  private readonly sideEffects: ImportSideEffects;
  private executor?: ImportExecutor;

  constructor(options: ImportOrchestratorOptions = {}) {
    this.config = options.config ?? getRuntimeConfig();
    this.store = options.store ?? new ImportStore();
    this.fileStore = options.fileStore ?? new ImportFileStore();
    this.sideEffects = options.sideEffects ?? new ImportSideEffects(options.activity ?? new ActivityLogCenter(), undefined, options.meterUsage ?? true);
    this.executor = options.executor;
  }

  async startCsvImport(workspace: CompanyWorkspace, file: CsvImportUpload): Promise<{ import: Import; execution: ImportExecutionResult }> {
    await this.sideEffects.assertCanStartImport(workspace);
    const importRow = await this.store.createPendingImport(workspace, file);
    const storageKey = await this.fileStore.storeCSV(importRow.id, file);
    await this.store.updateImport(importRow.id, { storageKey });
    await this.record(workspace, "import.queued", importRow.id, { filename: file.filename });
    await this.sideEffects.recordImportUsage(workspace, importRow.id, file);
    const execution = await this.resolveExecutor().execute({ importId: importRow.id, step: "detect-and-parse" });
    const refreshed = await this.store.findImportOrThrow(importRow.id);
    return { import: refreshed, execution };
  }

  async continueWithColumnMapping(workspace: CompanyWorkspace, importId: string, mapping: ColumnMapping) {
    await this.requireWorkspaceImport(workspace, importId);
    const cleanMapping = normalizeColumnMapping(mapping);
    await this.store.updateImport(importId, {
      columnMapping: cleanMapping as Prisma.InputJsonObject,
      status: "PARSING",
      currentStep: "detect-and-parse",
      progress: 10,
      lastErrorCode: null,
      lastErrorMessage: null,
      errorMessage: null,
    });
    await this.record(workspace, "import.mapping_submitted", importId, { mapping: cleanMapping });
    const execution = await this.resolveExecutor().execute({ importId, step: "detect-and-parse" });
    return { import: await this.store.findImportOrThrow(importId), execution };
  }

  async retryImport(workspace: CompanyWorkspace, importId: string) {
    await this.requireWorkspaceImport(workspace, importId);
    await this.store.updateImport(importId, {
      retryCount: { increment: 1 },
      status: "PENDING",
      currentStep: "queued",
      progress: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      errorMessage: null,
    });
    await this.record(workspace, "import.retry_requested", importId, {});
    const execution = await this.resolveExecutor().execute({ importId, step: "detect-and-parse" });
    return { import: await this.store.findImportOrThrow(importId), execution };
  }

  async retryCategorization(workspace: CompanyWorkspace, importId: string) {
    await this.requireWorkspaceImport(workspace, importId);
    await this.store.updateImport(importId, {
      retryCount: { increment: 1 },
      status: "CATEGORIZING",
      currentStep: "categorize",
      progress: 60,
      lastErrorCode: null,
      lastErrorMessage: null,
      errorMessage: null,
    });
    await this.record(workspace, "import.retry_categorization_requested", importId, {});
    const execution = await this.resolveExecutor().execute({ importId, step: "categorize" });
    return { import: await this.store.findImportOrThrow(importId), execution };
  }

  async getImportStatus(workspace: CompanyWorkspace, importId: string): Promise<ImportStatusOverview> {
    const importRow = await this.requireWorkspaceImport(workspace, importId);
    return summarizeImportStatus(importRow);
  }

  async runImportJob(request: { importId: string; step: ImportJobStep }): Promise<void> {
    const workspace = await this.workspaceForImport(request.importId);
    try {
      if (request.step === "detect-and-parse") {
        await this.detectParseAndContinue(workspace, request.importId);
        return;
      }
      await this.categorizeAndWriteLedger(workspace, request.importId);
    } catch (error) {
      await this.markFailed(workspace, request.importId, request.step, error);
      throw error;
    }
  }

  private async detectParseAndContinue(workspace: CompanyWorkspace, importId: string) {
    await this.markStep(workspace, importId, "detect-and-parse", "PARSING", 10);
    const importRow = await this.store.findImportOrThrow(importId);
    const content = await this.fileStore.readCSV(importRow.storageKey);
    const mapping = parseStoredMapping(importRow.columnMapping);
    const parsed = parseBankCsv({ content, mapping });

    await this.store.updateImport(importId, {
      fileFormat: parsed.detection.format,
      fileSeparator: parsed.detection.separator,
      detectedColumns: parsed.detection.columns,
      totalRows: parsed.rowCount,
      parsedRows: parsed.transactions.length,
      status: parsed.detection.needsMapping ? "NEEDS_MAPPING" : "PARSING",
      currentStep: parsed.detection.needsMapping ? "await-mapping" : "create-transactions",
      progress: parsed.detection.needsMapping ? 30 : 35,
    });
    await this.record(workspace, "import.step_completed", importId, { step: "detect-and-parse", rows: parsed.rowCount });

    if (parsed.detection.needsMapping) return;

    await this.markStep(workspace, importId, "create-transactions", "PARSING", 40);
    const created = await this.store.createTransactionsIdempotently(workspace.fiscalYear.id, importId, parsed.transactions);
    await this.store.updateImport(importId, { parsedRows: parsed.transactions.length, currentStep: "categorize", progress: 55 });
    await this.record(workspace, "import.step_completed", importId, { step: "create-transactions", createdRows: created });

    await this.categorizeAndWriteLedger(workspace, importId);
  }

  private async categorizeAndWriteLedger(workspace: CompanyWorkspace, importId: string) {
    await this.markStep(workspace, importId, "categorize", "CATEGORIZING", 65);
    const categorization = await categorizeImport(importId);
    await this.record(workspace, "import.step_completed", importId, { step: "categorize", categorizedRows: categorization.suggestions.length });

    await this.markStep(workspace, importId, "write-ledger", "CATEGORIZING", 85);
    const ledger = await writeEntriesForImport(importId);
    await this.record(workspace, "import.step_completed", importId, { step: "write-ledger", ledgerEntries: ledger.length });

    const importRow = await this.store.findImportOrThrow(importId);
    const status = importRow.reviewRows > 0 ? "REVIEW" : "DONE";
    await this.store.updateImport(importId, {
      status,
      currentStep: "complete",
      progress: 100,
      completedAt: new Date(),
      durationMs: elapsedMs(importRow.startedAt),
    });
    await this.record(workspace, "import.completed", importId, {
      categorizedRows: importRow.categorizedRows,
      reviewRows: importRow.reviewRows,
      ledgerEntries: ledger.length,
    });
  }

  private async markStep(workspace: CompanyWorkspace, importId: string, step: string, status: ImportStatus, progress: number) {
    await this.store.updateImport(importId, { status, currentStep: step, progress });
    await this.record(workspace, "import.step_started", importId, { step });
  }

  private async markFailed(workspace: CompanyWorkspace, importId: string, step: string, error: unknown) {
    const message = errorMessage(error);
    await this.store.updateImport(importId, {
      status: "ERROR",
      currentStep: step,
      lastErrorCode: errorCode(error),
      lastErrorMessage: message,
      errorMessage: message,
      completedAt: new Date(),
    });
    await this.record(workspace, "import.step_failed", importId, { step, message });
    await this.record(workspace, "import.failed", importId, { message });
  }

  private async requireWorkspaceImport(workspace: CompanyWorkspace, importId: string) {
    return this.store.requireWorkspaceImport(workspace, importId);
  }

  private async workspaceForImport(importId: string): Promise<CompanyWorkspace> {
    return this.store.workspaceForImport(importId);
  }

  private resolveExecutor() {
    if (this.executor) return this.executor;
    this.executor = importExecutionMode(this.config) === "bullmq"
      ? new BullMqImportExecutor({ config: this.config })
      : new InlineImportExecutor(this);
    return this.executor;
  }

  private async record(workspace: CompanyWorkspace, action: string, entityId: string, metadata: Record<string, unknown>) {
    await this.sideEffects.recordImportActivity(workspace, action, entityId, metadata);
  }
}

export function summarizeImportStatus(importRow: Import): ImportStatusOverview {
  return {
    id: importRow.id,
    status: importRow.status,
    currentStep: importRow.currentStep,
    progress: importRow.progress,
    totalRows: importRow.totalRows,
    parsedRows: importRow.parsedRows,
    categorizedRows: importRow.categorizedRows,
    reviewRows: importRow.reviewRows,
    durationMs: importRow.durationMs,
    error: {
      code: importRow.lastErrorCode,
      message: importRow.lastErrorMessage ?? importRow.errorMessage,
    },
    actions: {
      needsMapping: importRow.status === "NEEDS_MAPPING",
      canRetry: importRow.status === "ERROR",
      canRetryCategorization: importRow.status === "ERROR" && importRow.parsedRows > 0,
    },
  };
}

function normalizeColumnMapping(mapping: ColumnMapping): ColumnMapping {
  const required = ["date", "label", "amount"] as const;
  for (const key of required) {
    if (!mapping[key]) throw new ExpectedRouteError(`Colonne requise manquante: ${key}.`);
  }
  return {
    date: mapping.date,
    label: mapping.label,
    amount: mapping.amount,
    ...optionalMappingField("counterparty", mapping.counterparty),
    ...optionalMappingField("sourceId", mapping.sourceId),
    ...optionalMappingField("sourceRef", mapping.sourceRef),
    ...optionalMappingField("sourceCategory", mapping.sourceCategory),
  };
}

function parseStoredMapping(value: Prisma.JsonValue | null): ColumnMapping | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return normalizeColumnMapping(value as ColumnMapping);
}

function elapsedMs(startedAt: Date | null) {
  return startedAt ? Math.max(0, Date.now() - startedAt.getTime()) : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.split("\n")[0] : String(error);
}

function errorCode(error: unknown) {
  if (error instanceof ExpectedRouteError) return `HTTP_${error.status}`;
  return "IMPORT_PIPELINE_ERROR";
}

function optionalMappingField(key: keyof ColumnMapping, value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? { [key]: trimmed } : {};
}
