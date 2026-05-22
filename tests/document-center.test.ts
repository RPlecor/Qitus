import { DocumentType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { assertReviewAllowsDocumentGeneration, DocumentGenerationBlockedError } from "../app/modules/accounting-review/accounting-review-center.server";
import { documentTypesForGeneration } from "../app/modules/documents/document-center.server";

describe("DocumentCenter", () => {
  it("selects the persisted document types replaced by each generation", () => {
    expect(documentTypesForGeneration(["fec"])).toEqual([DocumentType.FEC]);
    expect(documentTypesForGeneration(["statements"])).toEqual([
      DocumentType.BALANCE,
      DocumentType.BILAN,
      DocumentType.COMPTE_RESULTAT,
    ]);
  });

  it("deduplicates replacement targets when generation types overlap", () => {
    expect(documentTypesForGeneration(["fec", "statements", "fec"]).sort()).toEqual([
      DocumentType.BALANCE,
      DocumentType.BILAN,
      DocumentType.COMPTE_RESULTAT,
      DocumentType.FEC,
    ].sort());
  });

  it("uses the accounting preflight to block unsafe generation", () => {
    expect(() => assertReviewAllowsDocumentGeneration({
      status: "blocked",
      blockingCount: 1,
      warningCount: 0,
      controls: [],
      generatedAt: "2026-05-19T00:00:00.000Z",
    })).toThrow(DocumentGenerationBlockedError);
  });
});
