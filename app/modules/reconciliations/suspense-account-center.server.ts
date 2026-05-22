import { Prisma } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { absMoney, money, ReconciliationCore } from "./reconciliation-core.server";

const SUSPENSE_PREFIXES = ["471", "467", "511", "580"];

export class SuspenseAccountCenter {
  constructor(private readonly core = new ReconciliationCore()) {}

  async listSuspenseItems(workspace: CompanyWorkspace) {
    await this.ensureRun(workspace);
    const run = await prisma.reconciliationRun.findUniqueOrThrow({ where: { fiscalYearId_kind: { fiscalYearId: workspace.fiscalYear.id, kind: "SUSPENSE" } } });
    return prisma.reconciliationIssue.findMany({
      where: { runId: run.id },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
  }

  async getSuspenseItem(workspace: CompanyWorkspace, issueKey: string) {
    await this.ensureRun(workspace);
    const issue = await prisma.reconciliationIssue.findFirst({
      where: { issueKey, run: { fiscalYearId: workspace.fiscalYear.id, kind: "SUSPENSE" } },
    });
    if (!issue) throw new ExpectedRouteError("Compte d'attente introuvable.", 404);
    const line = issue.entityType === "journalLine" ? await prisma.journalLine.findUnique({ where: { id: issue.entityId }, include: { journalEntry: true } }) : null;
    return {
      issue,
      line,
      action: "Corriger la transaction, créer une règle ou préparer une OD validable en Phase 14.",
    };
  }

  async resolveSuspenseItem(workspace: CompanyWorkspace, input: { issueKey: string; status: "RESOLVED" | "IGNORED"; note: string }) {
    const { issue } = await this.getSuspenseItem(workspace, input.issueKey);
    return prisma.reconciliationIssue.update({
      where: { id: issue.id },
      data: { status: input.status, note: input.note },
    });
  }

  async summarizeSuspenseAccounts(workspace: CompanyWorkspace) {
    await this.ensureRun(workspace);
    return this.core.summarizeRun(workspace, "SUSPENSE");
  }

  private async ensureRun(workspace: CompanyWorkspace) {
    const run = await this.core.getOrCreateRun(workspace, "SUSPENSE");
    const lines = await prisma.journalLine.findMany({
      where: {
        journalEntry: { fiscalYearId: workspace.fiscalYear.id },
        OR: SUSPENSE_PREFIXES.map((prefix) => ({ account: { startsWith: prefix } })),
      },
      include: { journalEntry: true },
    });
    const matches = lines.map((line) => ({
      runId: run.id,
      kind: "SUSPENSE" as const,
      leftEntityType: "journalLine",
      leftEntityId: line.id,
      status: "UNMATCHED" as const,
      amountDifference: new Prisma.Decimal(absMoney(Number(line.debit) - Number(line.credit))),
      dateDifferenceDays: 0,
      confidence: new Prisma.Decimal(0),
      note: line.journalEntry.label,
    }));
    const issues = lines
      .filter((line) => Math.abs(money(Number(line.debit) - Number(line.credit))) > 0.005)
      .map((line) => ({
        issueKey: `SUSPENSE_ACCOUNT_OPEN:account:${line.account}:line:${line.id}`,
        code: "SUSPENSE_ACCOUNT_OPEN",
        severity: "BLOCKING" as const,
        entityType: "journalLine",
        entityId: line.id,
        note: `${line.account} ${line.journalEntry.label}`,
      }));
    await this.core.replaceRunData(workspace, "SUSPENSE", {
      matches,
      issues,
      metadata: { accounts: SUSPENSE_PREFIXES, lines: lines.length },
    });
  }
}
