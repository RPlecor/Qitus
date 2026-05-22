import { Prisma } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { absMoney, daysBetween, money, ReconciliationCore } from "./reconciliation-core.server";

const THIRD_PARTY_PREFIXES = ["401", "411", "467"];

export class ThirdPartyMatchingCenter {
  constructor(private readonly core = new ReconciliationCore()) {}

  async runThirdPartyMatching(workspace: CompanyWorkspace) {
    const run = await this.core.getOrCreateRun(workspace, "THIRD_PARTY");
    const lines = await prisma.journalLine.findMany({
      where: {
        journalEntry: { fiscalYearId: workspace.fiscalYear.id },
        OR: THIRD_PARTY_PREFIXES.map((prefix) => ({ account: { startsWith: prefix } })),
      },
      include: { journalEntry: true },
      orderBy: [{ account: "asc" }],
    });
    const used = new Set<string>();
    const matches = [];
    const issues = [];

    for (const left of lines) {
      if (used.has(left.id)) continue;
      const leftNet = money(Number(left.debit) - Number(left.credit));
      const right = lines.find((candidate) => {
        if (candidate.id === left.id || used.has(candidate.id) || candidate.account !== left.account) return false;
        const rightNet = money(Number(candidate.debit) - Number(candidate.credit));
        return Math.abs(leftNet + rightNet) < 0.01;
      });
      if (right) {
        used.add(left.id);
        used.add(right.id);
        matches.push({
          runId: run.id,
          kind: "THIRD_PARTY" as const,
          leftEntityType: "journalLine",
          leftEntityId: left.id,
          rightEntityType: "journalLine",
          rightEntityId: right.id,
          status: "AUTO_MATCHED" as const,
          amountDifference: new Prisma.Decimal(0),
          dateDifferenceDays: Math.abs(daysBetween(left.journalEntry.date, right.journalEntry.date)),
          confidence: new Prisma.Decimal(0.9),
        });
        continue;
      }
      issues.push({
        issueKey: `THIRD_PARTY_OPEN_ITEM:account:${left.account}:entry:${left.journalEntryId}`,
        code: "THIRD_PARTY_OPEN_ITEM",
        severity: "WARNING" as const,
        entityType: "journalLine",
        entityId: left.id,
        note: `${left.account} ${left.journalEntry.label}`,
      });
      matches.push({
        runId: run.id,
        kind: "THIRD_PARTY" as const,
        leftEntityType: "journalLine",
        leftEntityId: left.id,
        status: "UNMATCHED" as const,
        amountDifference: new Prisma.Decimal(absMoney(leftNet)),
        dateDifferenceDays: 0,
        confidence: new Prisma.Decimal(0),
      });
    }

    await this.core.replaceRunData(workspace, "THIRD_PARTY", {
      matches,
      issues,
      metadata: { lines: lines.length, accounts: THIRD_PARTY_PREFIXES },
    });
    return this.summarizeThirdPartyMatching(workspace);
  }

  async listOpenItems(workspace: CompanyWorkspace, filters: { account?: string | null; status?: string | null } = {}) {
    const run = await prisma.reconciliationRun.findUnique({ where: { fiscalYearId_kind: { fiscalYearId: workspace.fiscalYear.id, kind: "THIRD_PARTY" } } });
    if (!run) return [];
    return prisma.reconciliationMatch.findMany({
      where: {
        runId: run.id,
        kind: "THIRD_PARTY",
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.account ? { OR: [{ leftEntityId: { contains: filters.account } }, { note: { contains: filters.account } }] } : {}),
      },
      orderBy: [{ status: "desc" }, { createdAt: "asc" }],
    });
  }

  async confirmThirdPartyMatch(workspace: CompanyWorkspace, input: { matchId: string; note?: string | null }) {
    const match = await prisma.reconciliationMatch.findFirst({
      where: { id: input.matchId, run: { fiscalYearId: workspace.fiscalYear.id, kind: "THIRD_PARTY" } },
    });
    if (!match) throw new ExpectedRouteError("Lettrage tiers introuvable.", 404);
    return prisma.reconciliationMatch.update({ where: { id: match.id }, data: { status: "USER_MATCHED", note: input.note ?? match.note } });
  }

  async getThirdPartyMatchDetail(workspace: CompanyWorkspace, matchId: string) {
    const match = await prisma.reconciliationMatch.findFirst({
      where: { id: matchId, run: { fiscalYearId: workspace.fiscalYear.id, kind: "THIRD_PARTY" } },
    });
    if (!match) throw new ExpectedRouteError("Lettrage tiers introuvable.", 404);
    const [leftLine, rightLine] = await Promise.all([
      prisma.journalLine.findUnique({ where: { id: match.leftEntityId }, include: { journalEntry: true } }),
      match.rightEntityId ? prisma.journalLine.findUnique({ where: { id: match.rightEntityId }, include: { journalEntry: true } }) : null,
    ]);
    return {
      match,
      leftLine,
      rightLine,
      reason: match.status === "AUTO_MATCHED" || match.status === "USER_MATCHED" ? "Deux lignes tiers se soldent." : "Solde tiers ouvert à documenter.",
    };
  }

  async summarizeThirdPartyMatching(workspace: CompanyWorkspace) {
    return this.core.summarizeRun(workspace, "THIRD_PARTY");
  }
}
