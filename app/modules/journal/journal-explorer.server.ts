import { Prisma, type EntrySource } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";

export type JournalExplorerQuery = {
  page?: number;
  pageSize?: number;
  journal?: string | null;
  source?: EntrySource | "all" | null;
  account?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string | null;
};

export type JournalEntrySummary = {
  id: string;
  num: number;
  date: string;
  journal: string;
  ref: string | null;
  label: string;
  source: EntrySource;
  lines: Array<{
    id: string;
    account: string;
    accountLabel: string | null;
    debit: string;
    credit: string;
  }>;
};

export type JournalSummary = {
  entriesCount: number;
  linesCount: number;
  debitTotal: number;
  creditTotal: number;
  balanced: boolean;
};

export type JournalFacets = {
  journals: string[];
  sources: EntrySource[];
  accounts: string[];
};

export class JournalExplorer {
  async listEntries(workspace: CompanyWorkspace, query: JournalExplorerQuery = {}) {
    const page = clampInt(query.page, 1, 9999, 1);
    const pageSize = clampInt(query.pageSize, 10, 100, 50);
    const where = buildWhere(workspace.fiscalYear.id, query);
    const [all, entries] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: { lines: true },
        orderBy: [{ date: "asc" }, { num: "asc" }],
      }),
      prisma.journalEntry.findMany({
        where,
        include: { lines: true },
        orderBy: [{ date: "asc" }, { num: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const total = all.length;
    return {
      entries: entries.map(summarizeEntry),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      facets: await this.getJournalFacets(workspace, query),
      summary: summarizeEntries(all.map(summarizeEntry)),
    };
  }

  async getEntryDetail(workspace: CompanyWorkspace, entryId: string) {
    const entry = await prisma.journalEntry.findFirstOrThrow({
      where: { id: entryId, fiscalYearId: workspace.fiscalYear.id },
      include: { lines: true, transactions: true },
    });
    return {
      ...summarizeEntry(entry),
      transactionIds: entry.transactions.map((transaction) => transaction.id),
    };
  }

  async getJournalFacets(workspace: CompanyWorkspace, _query: JournalExplorerQuery = {}): Promise<JournalFacets> {
    const entries = await prisma.journalEntry.findMany({
      where: { fiscalYearId: workspace.fiscalYear.id },
      include: { lines: true },
      orderBy: [{ journal: "asc" }],
    });
    return {
      journals: Array.from(new Set(entries.map((entry) => entry.journal))).sort(),
      sources: Array.from(new Set(entries.map((entry) => entry.source))).sort(),
      accounts: Array.from(new Set(entries.flatMap((entry) => entry.lines.map((line) => line.account)))).sort(),
    };
  }

  async summarizeJournal(workspace: CompanyWorkspace): Promise<JournalSummary> {
    const entries = await prisma.journalEntry.findMany({
      where: { fiscalYearId: workspace.fiscalYear.id },
      include: { lines: true },
    });
    return summarizeEntries(entries.map(summarizeEntry));
  }
}

const entrySources = new Set<string>(["IMPORT", "MANUAL", "CLOSING_ADJUSTMENT"]);

export function summarizeEntries(entries: JournalEntrySummary[]): JournalSummary {
  const debitTotal = entries.flatMap((entry) => entry.lines).reduce((sum, line) => sum + Number(line.debit), 0);
  const creditTotal = entries.flatMap((entry) => entry.lines).reduce((sum, line) => sum + Number(line.credit), 0);
  return {
    entriesCount: entries.length,
    linesCount: entries.reduce((sum, entry) => sum + entry.lines.length, 0),
    debitTotal,
    creditTotal,
    balanced: Math.abs(debitTotal - creditTotal) < 0.005,
  };
}

function buildWhere(fiscalYearId: string, query: JournalExplorerQuery): Prisma.JournalEntryWhereInput {
  return {
    fiscalYearId,
    journal: query.journal?.trim() ? query.journal.trim() : undefined,
    source: query.source && query.source !== "all" && entrySources.has(query.source) ? query.source : undefined,
    date: query.dateFrom || query.dateTo ? {
      gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
      lte: query.dateTo ? new Date(query.dateTo) : undefined,
    } : undefined,
    label: query.search?.trim() ? { contains: query.search.trim(), mode: "insensitive" } : undefined,
    lines: query.account?.trim() ? { some: { account: query.account.trim() } } : undefined,
  };
}

function summarizeEntry(entry: {
  id: string;
  num: number;
  date: Date;
  journal: string;
  ref: string | null;
  label: string;
  source: EntrySource;
  lines: Array<{ id: string; account: string; accountLabel: string | null; debit: unknown; credit: unknown }>;
}): JournalEntrySummary {
  return {
    id: entry.id,
    num: entry.num,
    date: entry.date.toISOString(),
    journal: entry.journal,
    ref: entry.ref,
    label: entry.label,
    source: entry.source,
    lines: entry.lines.map((line) => ({
      id: line.id,
      account: line.account,
      accountLabel: line.accountLabel,
      debit: String(line.debit),
      credit: String(line.credit),
    })),
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
