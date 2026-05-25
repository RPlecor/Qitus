import { ImportStatus, type Import } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ImportHistory } from "../app/modules/import-history/import-history.server";

describe("ImportHistory", () => {
  it("summarizes review imports for the UI without leaking Prisma shape", () => {
    const summary = new ImportHistory().summarizeImport(importRow({ status: "REVIEW", reviewRows: 2 }));

    expect(summary).toMatchObject({
      filename: "qonto-export-2025.csv",
      format: "qonto",
      parsedRows: 42,
      categorizedRows: 42,
      reviewRows: 2,
      lightReviewRows: 0,
      currentStep: "complete",
      progress: 100,
      statusKind: "warn",
      actions: {
        canRetryCategorization: true,
      },
    });
  });

  it("does not expose categorization retry for an empty review import", () => {
    const summary = new ImportHistory().summarizeImport(importRow({ status: "REVIEW", parsedRows: 0 }));

    expect(summary.actions.canRetryCategorization).toBe(false);
  });

  it.each([
    ["DONE", "done"],
    ["ERROR", "error"],
    ["CATEGORIZING", "pending"],
  ] as const)("maps %s to %s", (status, statusKind) => {
    expect(new ImportHistory().summarizeImport(importRow({ status })).statusKind).toBe(statusKind);
  });
});

function importRow(overrides: Partial<Import> & { status: ImportStatus }): Import {
  const { status, ...rest } = overrides;
  return {
    id: "import_1",
    fiscalYearId: "fy_1",
    bankAccountId: "bank_1",
    sourceType: "CSV_UPLOAD",
    originalFilename: "qonto-export-2025.csv",
    storageKey: null,
    fileFormat: "qonto",
    fileEncoding: null,
    fileSeparator: ";",
    detectedColumns: [],
    columnMapping: null,
    status,
    currentStep: "complete",
    progress: 100,
    totalRows: 42,
    parsedRows: 42,
    categorizedRows: 42,
    reviewRows: 0,
    lightReviewRows: 0,
    errorMessage: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    retryCount: 0,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    createdAt: new Date("2026-05-19T08:00:00.000Z"),
    updatedAt: new Date("2026-05-19T08:00:00.000Z"),
    ...rest,
  };
}
