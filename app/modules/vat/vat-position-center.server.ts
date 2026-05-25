import type { VatOperationNature } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { VatReferenceCenter } from "../official-references/vat-reference-center.server";

export type VatPositionFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
};

export type VatPositionRow = {
  entryId: string;
  entryNum: number;
  date: string;
  label: string;
  vatRate: string | null;
  nature: VatOperationNature | null;
  baseHt: number;
  deductible: number;
  collected: number;
  reverseChargeDue: number;
};

export type VatPosition = {
  periodStart: string;
  periodEnd: string;
  regime: string;
  exigibility: string;
  rows: VatPositionRow[];
  byRate: VatBucket[];
  byNature: VatBucket[];
  accounts: VatAccountBalance[];
  totals: {
    baseHt: number;
    deductible: number;
    collected: number;
    reverseChargeDue: number;
    net: number;
  };
};

export type VatBucket = {
  key: string;
  baseHt: number;
  deductible: number;
  collected: number;
  reverseChargeDue: number;
  net: number;
};

export type VatAccountBalance = {
  account: string;
  label: string;
  debit: number;
  credit: number;
  balance: number;
};

export class VatPositionCenter {
  constructor(private readonly vatReference = new VatReferenceCenter()) {}

  async getVatPosition(workspace: CompanyWorkspace, filters: VatPositionFilters = {}): Promise<VatPosition> {
    const period = resolvePeriod(workspace, filters);
    const vatAccounts = await this.vatReference.getVatAccountCodes();
    const accountRoles = await this.vatReference.getVatAccounts();
    const entries = await prisma.journalEntry.findMany({
      where: {
        fiscalYearId: workspace.fiscalYear.id,
        date: { gte: period.start, lte: period.end },
      },
      include: {
        lines: true,
        transactions: { include: { categorization: true } },
      },
      orderBy: [{ date: "asc" }, { num: "asc" }],
    });

    const rows = entries.flatMap((entry) => {
      const categorization = entry.transactions[0]?.categorization ?? null;
      const vatLines = entry.lines.filter((line) => vatAccounts.includes(line.account));
      if (vatLines.length === 0 && !categorization?.vatOperationNature && !categorization?.vatRate) return [];
      const baseHt = entry.lines
        .filter((line) => !vatAccounts.includes(line.account) && !line.account.startsWith("512"))
        .reduce((sum, line) => sum + Math.max(Number(line.debit), Number(line.credit)), 0);
      const deductible = vatLines.filter((line) => line.account === accountRoles.deductible).reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0);
      const collected = vatLines.filter((line) => line.account === accountRoles.collected).reduce((sum, line) => sum + Number(line.credit) - Number(line.debit), 0);
      const reverseChargeDue = vatLines.filter((line) => line.account === accountRoles.reverseCharge).reduce((sum, line) => sum + Number(line.credit) - Number(line.debit), 0);
      return [{
        entryId: entry.id,
        entryNum: entry.num,
        date: entry.date.toISOString().slice(0, 10),
        label: entry.label,
        vatRate: categorization?.vatRate?.toString() ?? null,
        nature: categorization?.vatOperationNature ?? null,
        baseHt: money(baseHt),
        deductible: money(deductible),
        collected: money(collected),
        reverseChargeDue: money(reverseChargeDue),
      }];
    });

    const accounts = await this.getVatAccountsBalance(workspace, filters);
    return {
      periodStart: period.start.toISOString().slice(0, 10),
      periodEnd: period.end.toISOString().slice(0, 10),
      regime: workspace.company.vatRegime,
      exigibility: workspace.company.vatExigibility,
      rows,
      byRate: summarizeRows(rows, (row) => row.vatRate ?? "sans_taux"),
      byNature: summarizeRows(rows, (row) => row.nature ?? "sans_nature"),
      accounts,
      totals: totalRows(rows),
    };
  }

  async summarizeByRate(workspace: CompanyWorkspace, filters: VatPositionFilters = {}) {
    return (await this.getVatPosition(workspace, filters)).byRate;
  }

  async summarizeByNature(workspace: CompanyWorkspace, filters: VatPositionFilters = {}) {
    return (await this.getVatPosition(workspace, filters)).byNature;
  }

  async getVatAccountsBalance(workspace: CompanyWorkspace, filters: VatPositionFilters = {}): Promise<VatAccountBalance[]> {
    const period = resolvePeriod(workspace, filters);
    const vatAccounts = await this.vatReference.getVatAccountCodes();
    const labels = await this.vatReference.getVatAccountLabels();
    const lines = await prisma.journalLine.findMany({
      where: {
        account: { in: vatAccounts },
        journalEntry: {
          fiscalYearId: workspace.fiscalYear.id,
          date: { gte: period.start, lte: period.end },
        },
      },
      select: { account: true, accountLabel: true, debit: true, credit: true },
    });
    const byAccount = new Map<string, VatAccountBalance>();
    for (const account of vatAccounts) {
      byAccount.set(account, { account, label: labels[account] ?? account, debit: 0, credit: 0, balance: 0 });
    }
    for (const line of lines) {
      const bucket = byAccount.get(line.account) ?? { account: line.account, label: line.accountLabel ?? labels[line.account] ?? line.account, debit: 0, credit: 0, balance: 0 };
      bucket.debit = money(bucket.debit + Number(line.debit));
      bucket.credit = money(bucket.credit + Number(line.credit));
      bucket.balance = money(bucket.debit - bucket.credit);
      byAccount.set(line.account, bucket);
    }
    return [...byAccount.values()];
  }
}

export function resolvePeriod(workspace: CompanyWorkspace, filters: VatPositionFilters = {}) {
  const start = filters.dateFrom ? new Date(filters.dateFrom) : workspace.fiscalYear.startDate;
  const end = filters.dateTo ? new Date(filters.dateTo) : workspace.fiscalYear.endDate;
  return {
    start: Number.isNaN(start.getTime()) ? workspace.fiscalYear.startDate : start,
    end: Number.isNaN(end.getTime()) ? workspace.fiscalYear.endDate : end,
  };
}

export function summarizeRows(rows: VatPositionRow[], keyFor: (row: VatPositionRow) => string): VatBucket[] {
  const buckets = new Map<string, VatBucket>();
  for (const row of rows) {
    const key = keyFor(row);
    const bucket = buckets.get(key) ?? { key, baseHt: 0, deductible: 0, collected: 0, reverseChargeDue: 0, net: 0 };
    bucket.baseHt = money(bucket.baseHt + row.baseHt);
    bucket.deductible = money(bucket.deductible + row.deductible);
    bucket.collected = money(bucket.collected + row.collected);
    bucket.reverseChargeDue = money(bucket.reverseChargeDue + row.reverseChargeDue);
    bucket.net = money(bucket.collected + bucket.reverseChargeDue - bucket.deductible);
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function totalRows(rows: VatPositionRow[]) {
  return rows.reduce((total, row) => ({
    baseHt: money(total.baseHt + row.baseHt),
    deductible: money(total.deductible + row.deductible),
    collected: money(total.collected + row.collected),
    reverseChargeDue: money(total.reverseChargeDue + row.reverseChargeDue),
    net: money(total.collected + row.collected + total.reverseChargeDue + row.reverseChargeDue - total.deductible - row.deductible),
  }), { baseHt: 0, deductible: 0, collected: 0, reverseChargeDue: 0, net: 0 });
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}
