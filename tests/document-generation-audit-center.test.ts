import { describe, expect, it, vi } from "vitest";
import { DocumentGenerationAuditCenter, toGenerationAudit } from "../app/modules/documents/document-generation-audit-center.server";

describe("DocumentGenerationAuditCenter", () => {
  it("records success and failure through ActivityLog", async () => {
    const activity = { recordActivity: vi.fn(), listActivity: vi.fn() };
    const center = new DocumentGenerationAuditCenter(activity as never);
    await center.recordGenerationSuccess({} as never, {
      types: ["fec"],
      startedAt: "2026-05-19T10:00:00.000Z",
      documents: [{
        id: "doc_1",
        type: "FEC",
        filename: "fec.txt",
        format: "txt",
        sizeBytes: 12,
        entriesCount: 40,
        generatedBy: "script:generate-fec",
        scriptVersion: "abc123",
        generatedAt: "2026-05-19T10:00:01.000Z",
        status: "READY",
        errorMessage: null,
      }],
    });
    await center.recordGenerationFailure({} as never, { types: ["fec"], startedAt: "2026-05-19T10:00:00.000Z", userMessage: "boom" });
    expect(activity.recordActivity).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "document_generation.succeeded" }));
    expect(activity.recordActivity).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "document_generation.failed" }));
  });

  it("turns activity rows into readable generation audit items", () => {
    expect(toGenerationAudit({
      id: "log_1",
      action: "document_generation.succeeded",
      entityType: "document_generation",
      entityId: "doc_1",
      metadata: { types: ["fec"], filenames: ["fec.txt"], scriptVersion: "abc123", entriesCount: 40, durationMs: 12, userMessage: "ok" },
      createdAt: "2026-05-19T10:00:00.000Z",
    })).toMatchObject({
      status: "succeeded",
      label: "Dernière génération réussie",
      filenames: ["fec.txt"],
      scriptVersion: "abc123",
      entriesCount: 40,
    });
  });
});
