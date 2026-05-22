import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  document: { findMany: vi.fn(), findFirstOrThrow: vi.fn() },
}));

vi.mock("../app/modules/db.server", () => ({ prisma: prismaMock }));

import { DocumentCatalog } from "../app/modules/documents/document-catalog.server";

describe("DocumentCatalog", () => {
  beforeEach(() => {
    prismaMock.document.findMany.mockReset();
    prismaMock.document.findFirstOrThrow.mockReset();
  });

  it("lists documents with freshness and production metadata", async () => {
    prismaMock.document.findMany.mockResolvedValue([documentRow("doc_1")]);
    const freshness = {
      async getFreshness() {
        return {
          documents: [{
            documentId: "doc_1",
            type: "FEC",
            filename: "fec.txt",
            generatedAt: "2025-01-01T00:00:00.000Z",
            isStale: false,
            statusLabel: "À jour",
            reasons: [],
          }],
        };
      },
    };
    const documents = await new DocumentCatalog({} as never, freshness as never).listDocuments(workspace());
    expect(documents[0]).toMatchObject({
      id: "doc_1",
      filename: "fec.txt",
      scriptVersion: "abc123",
      entriesCount: 40,
      freshness: { statusLabel: "À jour" },
    });
  });
});

function workspace() {
  return { fiscalYear: { id: "fy_1" } } as never;
}

function documentRow(id: string) {
  return {
    id,
    type: "FEC",
    filename: "fec.txt",
    format: "txt",
    storageKey: "key",
    sizeBytes: 123,
    entriesCount: 40,
    generatedBy: "script:generate-fec",
    scriptVersion: "abc123",
    generatedAt: new Date("2025-01-01T00:00:00.000Z"),
    status: "READY",
    errorMessage: null,
  };
}
