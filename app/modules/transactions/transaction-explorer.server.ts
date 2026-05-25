import { Prisma, type Categorization, type CorrectionRule, type JournalEntry, type JournalLine, type Transaction } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { isTransactionInLightReview, isTransactionInReview } from "./transaction-review-state";

export type TransactionBusinessStatus = "NEEDS_REVIEW" | "REVIEW_LIGHT" | "AUTO_APPLIED" | "CATEGORIZED" | "CONFIRMED" | "CORRECTED" | "HAS_RULE";
export type TransactionDirection = "all" | "debit" | "credit";

export type TransactionExplorerQuery = {
  page?: number;
  pageSize?: number;
  status?: "all" | "review" | "review_light" | "auto_applied" | "categorized" | "confirmed" | "corrected" | "has_rule";
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  account?: string | null;
  direction?: TransactionDirection;
};

export type TransactionListItem = {
  id: string;
  date: string;
  label: string;
  counterparty: string | null;
  amount: string;
  direction: "debit" | "credit";
  account: string;
  confidence: string | null;
  categorizationStatus: string | null;
  businessStatus: TransactionBusinessStatus;
  needsReview: boolean;
  needsLightReview: boolean;
  autoApplied: boolean;
  hasRule: boolean;
  journalEntryId: string | null;
};

export type TransactionFacets = {
  total: number;
  review: number;
  reviewLight: number;
  autoApplied: number;
  categorized: number;
  confirmed: number;
  corrected: number;
  hasRule: number;
  debit: number;
  credit: number;
};

type TransactionWithRelations = Transaction & {
  categorization: Categorization | null;
  journalEntry: (JournalEntry & { lines: JournalLine[] }) | null;
};

export class TransactionExplorer {
  async listTransactions(workspace: CompanyWorkspace, query: TransactionExplorerQuery = {}) {
    const page = clampInt(query.page, 1, 9999, 1);
    const pageSize = clampInt(query.pageSize, 5, 100, 25);
    const [rows, rules] = await Promise.all([
      prisma.transaction.findMany({
        where: buildWhere(workspace.fiscalYear.id, query),
        include: { categorization: true, journalEntry: { include: { lines: true } } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.correctionRule.findMany({ where: { fiscalYearId: workspace.fiscalYear.id, active: true } }),
    ]);

    const all = rows.map((transaction) => summarizeTransaction(transaction, rules));
    const filtered = all.filter((transaction) => matchesPostFilters(transaction, query));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return {
      transactions: filtered.slice(start, start + pageSize),
      page: safePage,
      pageSize,
      total,
      totalPages,
      facets: buildFacets(all),
    };
  }

  async getTransactionDetail(workspace: CompanyWorkspace, transactionId: string) {
    const [transaction, rules] = await Promise.all([
      prisma.transaction.findFirstOrThrow({
        where: { id: transactionId, fiscalYearId: workspace.fiscalYear.id },
        include: { categorization: true, journalEntry: { include: { lines: true } } },
      }),
      prisma.correctionRule.findMany({ where: { fiscalYearId: workspace.fiscalYear.id, active: true } }),
    ]);
    const summary = summarizeTransaction(transaction, rules);
    return {
      ...summary,
      currency: transaction.currency,
      sourceId: transaction.sourceId,
      sourceRef: transaction.sourceRef,
      sourceCategory: transaction.sourceCategory,
      notes: transaction.notes,
      normalizedLabel: transaction.normalizedLabel,
      categorization: transaction.categorization,
      journalEntry: transaction.journalEntry ? {
        id: transaction.journalEntry.id,
        num: transaction.journalEntry.num,
        journal: transaction.journalEntry.journal,
        label: transaction.journalEntry.label,
        lines: transaction.journalEntry.lines.map((line) => ({
          account: line.account,
          accountLabel: line.accountLabel,
          debit: line.debit.toString(),
          credit: line.credit.toString(),
        })),
      } : null,
      matchingRules: rules.filter((rule) => ruleMatchesTransaction(rule, transaction)).map(summarizeRuleMatch),
    };
  }

  async getTransactionFacets(workspace: CompanyWorkspace, query: TransactionExplorerQuery = {}) {
    return (await this.listTransactions(workspace, { ...query, page: 1, pageSize: 1 })).facets;
  }

  async summarizeTransactionState(workspace: CompanyWorkspace) {
    const result = await this.listTransactions(workspace, { page: 1, pageSize: 1 });
    return result.facets;
  }
}

function buildWhere(fiscalYearId: string, query: TransactionExplorerQuery): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { fiscalYearId };
  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { label: { contains: search, mode: "insensitive" } },
      { normalizedLabel: { contains: search, mode: "insensitive" } },
      { counterparty: { contains: search, mode: "insensitive" } },
      { sourceRef: { contains: search, mode: "insensitive" } },
    ];
  }
  if (query.dateFrom || query.dateTo) {
    where.date = {
      gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
      lte: query.dateTo ? new Date(query.dateTo) : undefined,
    };
  }
  if (query.direction === "debit") where.amount = { lt: 0 };
  if (query.direction === "credit") where.amount = { gt: 0 };
  return where;
}

export function summarizeTransaction(transaction: TransactionWithRelations, rules: CorrectionRule[]): TransactionListItem {
  const amount = Number(transaction.amount);
  const hasRule = rules.some((rule) => ruleMatchesTransaction(rule, transaction));
  const businessStatus = businessStatusFor(transaction.categorization, hasRule);
  return {
    id: transaction.id,
    date: transaction.date.toISOString(),
    label: transaction.label,
    counterparty: transaction.counterparty,
    amount: transaction.amount.toString(),
    direction: amount < 0 ? "debit" : "credit",
    account: displayAccount(amount, transaction.categorization),
    confidence: transaction.categorization?.confidence ?? null,
    categorizationStatus: transaction.categorization?.status ?? null,
    businessStatus,
    needsReview: businessStatus === "NEEDS_REVIEW",
    needsLightReview: businessStatus === "REVIEW_LIGHT",
    autoApplied: businessStatus === "AUTO_APPLIED",
    hasRule,
    journalEntryId: transaction.journalEntryId,
  };
}

export function businessStatusFor(
  categorization: Pick<Categorization, "status" | "source"> | null,
  hasRule = false
): TransactionBusinessStatus {
  if (isTransactionInReview(categorization)) return "NEEDS_REVIEW";
  if (isTransactionInLightReview(categorization)) return "REVIEW_LIGHT";
  if (categorization?.status === "AUTO_APPLIED") return "AUTO_APPLIED";
  if (categorization?.source === "MANUAL" || categorization?.status === "USER_CORRECTED" || categorization?.status === "MANUAL") return "CORRECTED";
  if (categorization?.status === "USER_CONFIRMED") return "CONFIRMED";
  if (hasRule) return "HAS_RULE";
  return "CATEGORIZED";
}

export function ruleMatchesTransaction(rule: Pick<CorrectionRule, "counterparty" | "active">, transaction: Pick<Transaction, "counterparty" | "normalizedLabel" | "label">) {
  if (!rule.active) return false;
  const haystack = `${transaction.counterparty ?? ""} ${transaction.normalizedLabel} ${transaction.label}`.toLowerCase();
  return haystack.includes(rule.counterparty.toLowerCase());
}

function summarizeRuleMatch(rule: CorrectionRule) {
  return {
    id: rule.id,
    counterparty: rule.counterparty,
    preferredAccount: rule.preferredAccount,
    preferredAccountLabel: rule.preferredAccountLabel,
    condition: rule.condition,
  };
}

function matchesPostFilters(transaction: TransactionListItem, query: TransactionExplorerQuery) {
  if (query.account?.trim() && transaction.account !== query.account.trim()) return false;
  if (!query.status || query.status === "all") return true;
  const statusMap: Record<Exclude<NonNullable<TransactionExplorerQuery["status"]>, "all">, TransactionBusinessStatus> = {
    review: "NEEDS_REVIEW",
    review_light: "REVIEW_LIGHT",
    auto_applied: "AUTO_APPLIED",
    categorized: "CATEGORIZED",
    confirmed: "CONFIRMED",
    corrected: "CORRECTED",
    has_rule: "HAS_RULE",
  };
  return transaction.businessStatus === statusMap[query.status];
}

function buildFacets(transactions: TransactionListItem[]): TransactionFacets {
  return {
    total: transactions.length,
    review: transactions.filter((transaction) => transaction.businessStatus === "NEEDS_REVIEW").length,
    reviewLight: transactions.filter((transaction) => transaction.businessStatus === "REVIEW_LIGHT").length,
    autoApplied: transactions.filter((transaction) => transaction.businessStatus === "AUTO_APPLIED").length,
    categorized: transactions.filter((transaction) => transaction.businessStatus === "CATEGORIZED").length,
    confirmed: transactions.filter((transaction) => transaction.businessStatus === "CONFIRMED").length,
    corrected: transactions.filter((transaction) => transaction.businessStatus === "CORRECTED").length,
    hasRule: transactions.filter((transaction) => transaction.businessStatus === "HAS_RULE").length,
    debit: transactions.filter((transaction) => transaction.direction === "debit").length,
    credit: transactions.filter((transaction) => transaction.direction === "credit").length,
  };
}

function displayAccount(amount: number, categorization: { accountDebit: string | null; accountCredit: string | null } | null) {
  if (!categorization) return "";
  return amount >= 0 ? categorization.accountCredit ?? "" : categorization.accountDebit ?? "";
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
