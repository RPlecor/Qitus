import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  journalEntry: { findMany: vi.fn(), findFirstOrThrow: vi.fn() },
}));

vi.mock("../app/modules/db.server", () => ({ prisma: prismaMock }));

import { JournalExplorer, summarizeEntries } from "../app/modules/journal/journal-explorer.server";

describe("JournalExplorer", () => {
  beforeEach(() => {
    prismaMock.journalEntry.findMany.mockReset();
    prismaMock.journalEntry.findFirstOrThrow.mockReset();
  });

  it("filters, paginates and summarizes journal entries", async () => {
    const entries = [entry("je_1", "BQ", "IMPORT", "5121", "29.99", "29.99")];
    prismaMock.journalEntry.findMany
      .mockResolvedValueOnce(entries)
      .mockResolvedValueOnce(entries)
      .mockResolvedValueOnce(entries);

    const result = await new JournalExplorer().listEntries(workspace(), { journal: "BQ", account: "5121", pageSize: 50 });

    expect(prismaMock.journalEntry.findMany.mock.calls[0][0].where).toMatchObject({
      fiscalYearId: "fy_1",
      journal: "BQ",
      lines: { some: { account: "5121" } },
    });
    expect(result.summary).toMatchObject({ entriesCount: 1, linesCount: 2, balanced: true });
    expect(result.entries[0].journal).toBe("BQ");
  });

  it("detects an unbalanced journal summary", () => {
    expect(summarizeEntries([{
      id: "je_1",
      num: 1,
      date: "2025-01-01T00:00:00.000Z",
      journal: "BQ",
      ref: null,
      label: "Unbalanced",
      source: "IMPORT",
      lines: [{ id: "l1", account: "5121", accountLabel: null, debit: "10", credit: "0" }],
    }]).balanced).toBe(false);
  });
});

function workspace() {
  return { fiscalYear: { id: "fy_1" } } as never;
}

function entry(id: string, journal: string, source: string, account: string, debit: string, credit: string) {
  return {
    id,
    num: 1,
    date: new Date("2025-01-03T00:00:00.000Z"),
    journal,
    ref: null,
    label: "OVH",
    source,
    lines: [
      { id: `${id}_1`, account, accountLabel: "Banque", debit, credit: "0" },
      { id: `${id}_2`, account: "6135", accountLabel: "Cloud", debit: "0", credit },
    ],
  };
}
