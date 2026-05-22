import { describe, expect, it } from "vitest";
import { JournalAuditCenter } from "../app/modules/journal/journal-audit-center.server";

describe("JournalAuditCenter", () => {
  it("reports an exportable balanced journal", async () => {
    const explorer = { async listEntries() { return result([entry("je_1", [{ debit: "10", credit: "0" }, { debit: "0", credit: "10" }])]); } };
    const audit = await new JournalAuditCenter(explorer as never).getAuditSummary({} as never);
    expect(audit).toMatchObject({ status: "exportable", label: "Journal équilibré", issueCount: 0 });
  });

  it("detects entries without lines and invalid lines", async () => {
    const explorer = { async listEntries() { return result([
      entry("je_empty", []),
      entry("je_zero", [{ debit: "0", credit: "0" }]),
      entry("je_double", [{ debit: "10", credit: "10" }]),
    ]); } };
    const audit = await new JournalAuditCenter(explorer as never).getAuditSummary({} as never);
    expect(audit.status).toBe("needs_attention");
    expect(audit.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["ENTRY_WITHOUT_LINES", "LINE_WITHOUT_AMOUNT", "LINE_DOUBLE_SIDED"]));
  });
});

function result(entries: unknown[]) {
  return {
    entries,
    facets: { journals: ["BQ"], sources: ["IMPORT"], accounts: ["5121"] },
    summary: { entriesCount: entries.length, linesCount: 2, debitTotal: 10, creditTotal: 10, balanced: true },
  };
}

function entry(id: string, lines: Array<{ debit: string; credit: string }>) {
  return {
    id,
    num: 1,
    date: "2025-01-01T00:00:00.000Z",
    journal: "BQ",
    ref: null,
    label: id,
    source: "IMPORT",
    lines: lines.map((line, index) => ({ id: `${id}_${index}`, account: "5121", accountLabel: null, ...line })),
  };
}
