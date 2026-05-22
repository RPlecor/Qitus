import { ExpectedRouteError } from "../route-errors.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { JournalExplorer, type JournalEntrySummary, type JournalSummary } from "./journal-explorer.server";

export type JournalAuditIssue = {
  code: "ENTRY_WITHOUT_LINES" | "LINE_WITHOUT_AMOUNT" | "LINE_DOUBLE_SIDED" | "ENTRY_UNBALANCED" | "UNEXPECTED_SOURCE";
  severity: "blocking" | "warning";
  entryId: string;
  entryNum: number;
  label: string;
  detail: string;
};

export type JournalAuditSummary = {
  status: "exportable" | "needs_attention";
  label: "Journal équilibré" | "Journal à vérifier";
  summary: JournalSummary;
  issueCount: number;
  blockingCount: number;
  warningCount: number;
  issues: JournalAuditIssue[];
  journals: string[];
};

export class JournalAuditCenter {
  constructor(private readonly explorer = new JournalExplorer()) {}

  async getAuditSummary(workspace: CompanyWorkspace): Promise<JournalAuditSummary> {
    const result = await this.explorer.listEntries(workspace, { page: 1, pageSize: 100 });
    const issues = [
      ...this.listImbalancesFromEntries(result.entries),
      ...this.listEntriesWithoutExpectedSourceFromEntries(result.entries),
    ];
    const blockingCount = issues.filter((issue) => issue.severity === "blocking").length;
    return {
      status: result.summary.balanced && blockingCount === 0 ? "exportable" : "needs_attention",
      label: result.summary.balanced && blockingCount === 0 ? "Journal équilibré" : "Journal à vérifier",
      summary: result.summary,
      issueCount: issues.length,
      blockingCount,
      warningCount: issues.length - blockingCount,
      issues,
      journals: result.facets.journals,
    };
  }

  async listImbalances(workspace: CompanyWorkspace) {
    const result = await this.explorer.listEntries(workspace, { page: 1, pageSize: 100 });
    return this.listImbalancesFromEntries(result.entries);
  }

  async listEntriesWithoutExpectedSource(workspace: CompanyWorkspace) {
    const result = await this.explorer.listEntries(workspace, { page: 1, pageSize: 100 });
    return this.listEntriesWithoutExpectedSourceFromEntries(result.entries);
  }

  async assertJournalIsExportable(workspace: CompanyWorkspace) {
    const audit = await this.getAuditSummary(workspace);
    if (audit.status !== "exportable") throw new ExpectedRouteError("Le journal contient des anomalies à corriger avant export.", 409);
    return audit;
  }

  private listImbalancesFromEntries(entries: JournalEntrySummary[]): JournalAuditIssue[] {
    return entries.flatMap((entry) => {
      const issues: JournalAuditIssue[] = [];
      if (entry.lines.length === 0) {
        issues.push(issue("ENTRY_WITHOUT_LINES", "blocking", entry, "Écriture sans ligne comptable."));
      }
      for (const line of entry.lines) {
        const debit = Number(line.debit);
        const credit = Number(line.credit);
        if (debit === 0 && credit === 0) issues.push(issue("LINE_WITHOUT_AMOUNT", "blocking", entry, `Ligne ${line.account} sans montant.`));
        if (debit > 0 && credit > 0) issues.push(issue("LINE_DOUBLE_SIDED", "blocking", entry, `Ligne ${line.account} avec débit et crédit simultanés.`));
      }
      const debit = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
      const credit = entry.lines.reduce((sum, line) => sum + Number(line.credit), 0);
      if (Math.abs(debit - credit) >= 0.005) issues.push(issue("ENTRY_UNBALANCED", "blocking", entry, "Débit et crédit de l'écriture ne sont pas égaux."));
      return issues;
    });
  }

  private listEntriesWithoutExpectedSourceFromEntries(entries: JournalEntrySummary[]): JournalAuditIssue[] {
    return entries.flatMap((entry) => {
      if (entry.journal === "BQ" && entry.source !== "IMPORT") {
        return [issue("UNEXPECTED_SOURCE", "warning", entry, "Une écriture BQ devrait venir d'un import bancaire.")];
      }
      if (entry.journal === "OD" && entry.source !== "CLOSING_ADJUSTMENT") {
        return [issue("UNEXPECTED_SOURCE", "warning", entry, "Une écriture OD devrait venir d'un ajustement de clôture validé.")];
      }
      return [];
    });
  }
}

function issue(code: JournalAuditIssue["code"], severity: JournalAuditIssue["severity"], entry: JournalEntrySummary, detail: string): JournalAuditIssue {
  return {
    code,
    severity,
    entryId: entry.id,
    entryNum: entry.num,
    label: entry.label,
    detail,
  };
}
