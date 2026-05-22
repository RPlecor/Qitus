import Decimal from "decimal.js";
import type { JournalEntryDraft } from "../ledger/ledger-writer";

export type DashboardKpis = {
  revenue: number;
  expenses: number;
  result: number;
  cash: number;
};

export function computeDashboardKpis(entries: JournalEntryDraft[]): DashboardKpis {
  let revenue = new Decimal(0);
  let expenses = new Decimal(0);
  let cash = new Decimal(0);

  for (const entry of entries) {
    for (const line of entry.lines) {
      const balance = new Decimal(line.debit).minus(line.credit);
      if (line.account.startsWith("70")) revenue = revenue.plus(new Decimal(line.credit).minus(line.debit));
      if (line.account.startsWith("6")) expenses = expenses.plus(balance);
      if (line.account.startsWith("512")) cash = cash.plus(balance);
    }
  }

  const result = revenue.minus(expenses);
  return {
    revenue: money(revenue),
    expenses: money(expenses),
    result: money(result),
    cash: money(cash),
  };
}

function money(value: Decimal) {
  return value.toDecimalPlaces(2).toNumber();
}
