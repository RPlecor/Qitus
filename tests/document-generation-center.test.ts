import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  bankAccount: { findMany: vi.fn() },
  journalEntry: { findMany: vi.fn() },
  document: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
}));

vi.mock("../app/modules/db.server", () => ({ prisma: prismaMock }));

import { DocumentGenerationCenter } from "../app/modules/documents/document-generation-center.server";

describe("DocumentGenerationCenter", () => {
  beforeEach(() => {
    prismaMock.bankAccount.findMany.mockReset();
    prismaMock.journalEntry.findMany.mockReset();
    prismaMock.document.findMany.mockReset();
    prismaMock.document.deleteMany.mockReset();
    prismaMock.document.create.mockReset();
  });

  it("replaces existing documents of the generated type without duplicates", async () => {
    prismaMock.bankAccount.findMany.mockResolvedValue([{ id: "bank_1", label: "Banque", pcgAccount: "5121", fecAccount: "51211" }]);
    prismaMock.journalEntry.findMany.mockResolvedValue([journalEntry()]);
    prismaMock.document.findMany.mockResolvedValue([{ id: "old_doc", storageKey: "old/fec.txt" }]);
    prismaMock.document.create.mockImplementation(async ({ data }) => ({
      id: "new_doc",
      generatedAt: new Date("2025-01-02T00:00:00.000Z"),
      status: "READY",
      errorMessage: null,
      ...data,
    }));
    const generator = {
      async generate() {
        return [{
          type: "FEC",
          filename: "fec.txt",
          storageKey: "new/fec.txt",
          format: "txt",
          sizeBytes: 12,
          generatedBy: "script:generate-fec",
          scriptVersion: "abc123",
        }];
      },
    };
    const review = { async assertDocumentsCanBeGenerated() { return {}; } };
    const storage = { delete: vi.fn() };

    const created = await new DocumentGenerationCenter(generator as never, review as never, storage as never).generateDocuments(workspace(), { types: ["fec"] });

    expect(prismaMock.document.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["old_doc"] } } });
    expect(storage.delete).toHaveBeenCalledWith("old/fec.txt");
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ filename: "fec.txt", scriptVersion: "abc123" });
  });
});

function workspace() {
  return {
    company: { id: "company_1", name: "ACME", legalForm: "SASU", vatRegime: "FRANCHISE" },
    fiscalYear: { id: "fy_1", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") },
  } as never;
}

function journalEntry() {
  return {
    num: 1,
    date: new Date("2025-01-03"),
    journal: "BQ",
    ref: null,
    label: "OVH",
    source: "IMPORT",
    transactions: [{ id: "tx_1" }],
    lines: [
      { account: "6135", accountLabel: "Cloud", debit: "29.99", credit: "0" },
      { account: "5121", accountLabel: "Banque", debit: "0", credit: "29.99" },
    ],
  };
}
