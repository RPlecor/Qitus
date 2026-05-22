import { Prisma, type ReconciliationRunKind, type ReconciliationRunStatus } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";

export type ReconciliationSummary = {
  kind: ReconciliationRunKind;
  status: ReconciliationRunStatus | "MISSING";
  totalMatches: number;
  matched: number;
  unmatched: number;
  ignored: number;
  difference: number;
  openIssues: number;
  resolvedIssues: number;
  ignoredIssues: number;
  progress: number;
};

export type ReconciliationIssueInput = {
  issueKey: string;
  code: string;
  severity: "BLOCKING" | "WARNING";
  entityType: string;
  entityId: string;
  note?: string | null;
};

export class ReconciliationCore {
  async getOrCreateRun(workspace: CompanyWorkspace, kind: ReconciliationRunKind) {
    return prisma.reconciliationRun.upsert({
      where: { fiscalYearId_kind: { fiscalYearId: workspace.fiscalYear.id, kind } },
      create: {
        fiscalYearId: workspace.fiscalYear.id,
        kind,
        status: "DRAFT",
        startedAt: new Date(),
      },
      update: {
        startedAt: new Date(),
      },
    });
  }

  async replaceRunData(
    workspace: CompanyWorkspace,
    kind: ReconciliationRunKind,
    input: {
      matches: Prisma.ReconciliationMatchCreateManyInput[];
      issues: ReconciliationIssueInput[];
      metadata?: Prisma.InputJsonValue;
      forceStatus?: ReconciliationRunStatus;
    }
  ) {
    const run = await this.getOrCreateRun(workspace, kind);
    await prisma.$transaction([
      prisma.reconciliationMatch.deleteMany({ where: { runId: run.id } }),
      prisma.reconciliationIssue.deleteMany({ where: { runId: run.id, status: "OPEN" } }),
    ]);
    if (input.matches.length > 0) {
      await prisma.reconciliationMatch.createMany({ data: input.matches.map((match) => ({ ...match, runId: run.id })) });
    }
    for (const issue of input.issues) {
      await prisma.reconciliationIssue.upsert({
        where: { runId_issueKey: { runId: run.id, issueKey: issue.issueKey } },
        create: { ...issue, runId: run.id },
        update: {
          code: issue.code,
          severity: issue.severity,
          entityType: issue.entityType,
          entityId: issue.entityId,
          note: issue.note,
        },
      });
    }
    const status = input.forceStatus ?? (input.issues.some((issue) => issue.severity === "BLOCKING") ? "BLOCKED" : "READY");
    return prisma.reconciliationRun.update({
      where: { id: run.id },
      data: {
        status,
        completedAt: status === "COMPLETED" ? new Date() : null,
        metadataJson: input.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async summarizeRun(workspace: CompanyWorkspace, kind: ReconciliationRunKind): Promise<ReconciliationSummary> {
    const run = await prisma.reconciliationRun.findUnique({
      where: { fiscalYearId_kind: { fiscalYearId: workspace.fiscalYear.id, kind } },
      include: { matches: true, issues: true },
    });
    if (!run) {
      return { kind, status: "MISSING", totalMatches: 0, matched: 0, unmatched: 0, ignored: 0, difference: 0, openIssues: 0, resolvedIssues: 0, ignoredIssues: 0, progress: 0 };
    }
    const matched = run.matches.filter((match) => match.status === "AUTO_MATCHED" || match.status === "USER_MATCHED").length;
    const ignored = run.matches.filter((match) => match.status === "IGNORED").length;
    const unmatched = run.matches.filter((match) => match.status === "UNMATCHED").length;
    const difference = run.matches.filter((match) => match.status === "DIFFERENCE").length;
    const done = matched + ignored;
    const total = run.matches.length + run.issues.filter((issue) => issue.status === "OPEN").length;
    return {
      kind,
      status: run.status,
      totalMatches: run.matches.length,
      matched,
      unmatched,
      ignored,
      difference,
      openIssues: run.issues.filter((issue) => issue.status === "OPEN").length,
      resolvedIssues: run.issues.filter((issue) => issue.status === "RESOLVED").length,
      ignoredIssues: run.issues.filter((issue) => issue.status === "IGNORED").length,
      progress: total === 0 ? 100 : Math.round((done / total) * 100),
    };
  }

  async markRunCompletedIfReady(runId: string) {
    const [openIssues, openMatches] = await Promise.all([
      prisma.reconciliationIssue.count({ where: { runId, status: "OPEN", severity: "BLOCKING" } }),
      prisma.reconciliationMatch.count({ where: { runId, status: { in: ["UNMATCHED", "DIFFERENCE"] } } }),
    ]);
    if (openIssues === 0 && openMatches === 0) {
      await prisma.reconciliationRun.update({ where: { id: runId }, data: { status: "COMPLETED", completedAt: new Date() } });
    }
  }
}

export function money(value: number | string | Prisma.Decimal | null | undefined) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

export function absMoney(value: number | string | Prisma.Decimal | null | undefined) {
  return Math.abs(money(value));
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) - Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())) / 86_400_000);
}
