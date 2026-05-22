import { DocumentType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildDocumentFreshness } from "../app/modules/documents/document-freshness-center.server";

describe("DocumentFreshnessCenter", () => {
  it("marks documents stale when a business event is newer than generation", () => {
    const freshness = buildDocumentFreshness([
      {
        id: "doc_fec",
        type: DocumentType.FEC,
        filename: "fec.txt",
        generatedAt: new Date("2025-12-31T10:00:00.000Z"),
      },
    ], [
      {
        code: "closing_adjustment_approved",
        label: "Dernière OD validée : CCA",
        at: "2025-12-31T11:00:00.000Z",
      },
    ]);

    expect(freshness.staleCount).toBe(1);
    expect(freshness.documents[0]).toMatchObject({
      filename: "fec.txt",
      isStale: true,
      statusLabel: "À régénérer",
    });
  });

  it("keeps documents fresh when generation is newer than business events", () => {
    const freshness = buildDocumentFreshness([
      {
        id: "doc_fec",
        type: DocumentType.FEC,
        filename: "fec.txt",
        generatedAt: new Date("2025-12-31T12:00:00.000Z"),
      },
    ], [
      {
        code: "journal_entry_updated",
        label: "Dernière écriture",
        at: "2025-12-31T11:00:00.000Z",
      },
    ]);

    expect(freshness.staleCount).toBe(0);
    expect(freshness.documents[0].statusLabel).toBe("À jour");
  });
});
