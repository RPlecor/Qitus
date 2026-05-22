import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { JournalExplorer, type JournalExplorerQuery, type JournalEntrySummary } from "./journal-explorer.server";

export class JournalExportCenter {
  constructor(private readonly explorer = new JournalExplorer()) {}

  async exportCsv(workspace: CompanyWorkspace, query: JournalExplorerQuery = {}) {
    const result = await this.explorer.listEntries(workspace, { ...query, page: 1, pageSize: 100 });
    const rows = [["num", "date", "journal", "source", "label", "account", "accountLabel", "debit", "credit"]];
    for (const entry of result.entries) {
      for (const line of entry.lines) {
        rows.push([
          String(entry.num),
          entry.date.slice(0, 10),
          entry.journal,
          entry.source,
          entry.label,
          line.account,
          line.accountLabel ?? "",
          line.debit,
          line.credit,
        ]);
      }
    }
    return rows.map((row) => row.map(csvCell).join(",")).join("\n");
  }

  async exportJson(workspace: CompanyWorkspace, query: JournalExplorerQuery = {}) {
    return this.explorer.listEntries(workspace, { ...query, page: 1, pageSize: 100 });
  }

  async exportFecPreview(workspace: CompanyWorkspace, query: JournalExplorerQuery = {}) {
    const result = await this.explorer.listEntries(workspace, { ...query, page: 1, pageSize: 100 });
    return result.entries.flatMap(toFecPreviewRows);
  }
}

function toFecPreviewRows(entry: JournalEntrySummary) {
  return entry.lines.map((line) => ({
    JournalCode: entry.journal,
    EcritureNum: entry.num,
    EcritureDate: entry.date.slice(0, 10).replace(/-/g, ""),
    CompteNum: line.account,
    CompteLib: line.accountLabel ?? "",
    EcritureLib: entry.label,
    Debit: line.debit,
    Credit: line.credit,
  }));
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
