import { describe, expect, it, vi } from "vitest";
import { ImportCleanupCenter, type ImportCleanupPreview } from "../app/modules/import-orchestrator/import-cleanup-center.server";

const workspace = {
  user: { id: "user_1" },
  company: { id: "company_1" },
  fiscalYear: { id: "fy_1", status: "OPEN" },
} as never;

describe("ImportCleanupCenter", () => {
  it("previews a single import deletion without leaking storage details", async () => {
    const store = fakeStore(preview({ importIds: ["import_1"], importCount: 1, transactionCount: 42, journalEntryCount: 40, journalLineCount: 80 }));
    const center = new ImportCleanupCenter(store);

    await expect(center.previewImportDeletion(workspace, "import_1")).resolves.toMatchObject({
      importCount: 1,
      transactionCount: 42,
      journalEntryCount: 40,
      journalLineCount: 80,
      sources: ["CSV_UPLOAD"],
    });
  });

  it("requires an explicit confirmation before deleting an import", async () => {
    const store = fakeStore(preview({ importIds: ["import_1"], importCount: 1 }));
    const center = new ImportCleanupCenter(store);

    await expect(center.deleteImport(workspace, { importId: "import_1", confirmation: "oui" })).rejects.toThrow('Saisissez exactement "SUPPRIMER"');
    expect(store.deleteImports).not.toHaveBeenCalled();
  });

  it("deletes imports through the store and records activity", async () => {
    const store = fakeStore(preview({ importIds: ["import_1"], importCount: 1, transactionCount: 2, journalEntryCount: 2, journalLineCount: 4 }));
    const activity = { recordActivity: vi.fn(async () => ({})) };
    const center = new ImportCleanupCenter(store, activity as never);

    const result = await center.deleteImport(workspace, { importId: "import_1", confirmation: "SUPPRIMER" });

    expect(result).toMatchObject({ importCount: 1, transactionCount: 2, journalEntryCount: 2, journalLineCount: 4 });
    expect(result.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(store.deleteImports).toHaveBeenCalledWith(workspace, ["import_1"]);
    expect(activity.recordActivity).toHaveBeenCalledWith(workspace, expect.objectContaining({
      action: "import.deleted",
      entityType: "import",
      entityId: "import_1",
      metadata: expect.objectContaining({ importCount: 1, transactionCount: 2 }),
    }));
  });

  it("requires confirmation and records requested/completed activity for fiscal year reset", async () => {
    const store = fakeStore(preview({ importIds: ["import_1", "import_2"], importCount: 2, transactionCount: 5 }));
    const activity = { recordActivity: vi.fn(async () => ({})) };
    const center = new ImportCleanupCenter(store, activity as never);

    await expect(center.resetFiscalYearImports(workspace, { confirmation: "RESET" })).rejects.toThrow('Saisissez exactement "RESET IMPORTS"');

    await center.resetFiscalYearImports(workspace, { confirmation: "RESET IMPORTS" });

    expect(store.previewFiscalYearImportReset).toHaveBeenCalledWith(workspace);
    expect(store.deleteImports).toHaveBeenCalledWith(workspace, ["import_1", "import_2"]);
    expect(activity.recordActivity).toHaveBeenCalledWith(workspace, expect.objectContaining({ action: "import.reset_requested" }));
    expect(activity.recordActivity).toHaveBeenCalledWith(workspace, expect.objectContaining({ action: "import.reset_completed" }));
  });
});

function fakeStore(result: ImportCleanupPreview) {
  return {
    previewImportDeletion: vi.fn(async () => result),
    previewFiscalYearImportReset: vi.fn(async () => result),
    deleteImports: vi.fn(async () => result),
  };
}

function preview(overrides: Partial<ImportCleanupPreview>): ImportCleanupPreview {
  return {
    importIds: [],
    importCount: 0,
    transactionCount: 0,
    journalEntryCount: 0,
    journalLineCount: 0,
    sources: ["CSV_UPLOAD"] as never,
    warnings: ["Les documents dérivés devront être recalculés."],
    ...overrides,
  };
}
