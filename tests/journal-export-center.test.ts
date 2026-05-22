import { describe, expect, it } from "vitest";
import { JournalExportCenter } from "../app/modules/journal/journal-export-center.server";

describe("JournalExportCenter", () => {
  it("exports stable escaped CSV rows", async () => {
    const explorer = {
      async listEntries() {
        return {
          entries: [{
            id: "je_1",
            num: 1,
            date: "2025-01-03T00:00:00.000Z",
            journal: "BQ",
            ref: null,
            source: "IMPORT",
            label: "OVH, \"cloud\"",
            lines: [{ id: "l1", account: "6135", accountLabel: "Cloud", debit: "29.99", credit: "0" }],
          }],
        };
      },
    };

    const csv = await new JournalExportCenter(explorer as never).exportCsv({} as never);
    expect(csv.split("\n")[0]).toBe("\"num\",\"date\",\"journal\",\"source\",\"label\",\"account\",\"accountLabel\",\"debit\",\"credit\"");
    expect(csv).toContain("\"OVH, \"\"cloud\"\"\"");
  });
});
