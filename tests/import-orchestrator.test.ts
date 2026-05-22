import { type Import } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { summarizeImportStatus } from "../app/modules/import-orchestrator/import-orchestrator.server";

describe("ImportOrchestrator status", () => {
  it("exposes mapping and retry actions from the Import lifecycle", () => {
    expect(summarizeImportStatus(importRow({ status: "NEEDS_MAPPING", currentStep: "await-mapping" })).actions).toEqual({
      needsMapping: true,
      canRetry: false,
      canRetryCategorization: false,
    });

    expect(summarizeImportStatus(importRow({
      status: "ERROR",
      parsedRows: 42,
      lastErrorMessage: "Codex indisponible",
    })).actions).toEqual({
      needsMapping: false,
      canRetry: true,
      canRetryCategorization: true,
    });

    expect(summarizeImportStatus(importRow({
      status: "REVIEW",
      parsedRows: 42,
      reviewRows: 42,
    })).actions).toEqual({
      needsMapping: false,
      canRetry: false,
      canRetryCategorization: true,
    });

    expect(summarizeImportStatus(importRow({
      status: "REVIEW",
      parsedRows: 0,
      reviewRows: 0,
    })).actions.canRetryCategorization).toBe(false);
  });
});

function importRow(overrides: Partial<Import>): Import {
  return {
    id: "import_1",
    fiscalYearId: "fy_1",
    bankAccountId: "bank_1",
    sourceType: "CSV_UPLOAD",
    originalFilename: "generic.csv",
    storageKey: "storage/imports/generic.csv",
    fileFormat: "generic",
    fileEncoding: null,
    fileSeparator: ",",
    detectedColumns: ["Date", "Label", "Amount"],
    columnMapping: null,
    status: "PENDING",
    currentStep: "queued",
    progress: 0,
    totalRows: 0,
    parsedRows: 0,
    categorizedRows: 0,
    reviewRows: 0,
    errorMessage: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    retryCount: 0,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    createdAt: new Date("2026-05-19T08:00:00.000Z"),
    updatedAt: new Date("2026-05-19T08:00:00.000Z"),
    ...overrides,
  };
}
