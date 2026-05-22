import type { ProviderBankTransaction } from "./open-banking-provider-types.server";

export type NormalizedBankFeedTransaction = {
  sourceId: string;
  date: string;
  label: string;
  counterparty?: string;
  amount: number;
  currency: string;
  providerAccountId: string;
};

export class BankFeedNormalizer {
  normalizeTransactions(transactions: ProviderBankTransaction[]): NormalizedBankFeedTransaction[] {
    return transactions.map((transaction) => ({
      sourceId: transaction.providerTransactionId,
      date: transaction.date,
      label: transaction.label.trim(),
      counterparty: transaction.counterparty?.trim() || undefined,
      amount: Math.round(transaction.amount * 100) / 100,
      currency: transaction.currency || "EUR",
      providerAccountId: transaction.providerAccountId,
    }));
  }

  toQontoCsv(transactions: NormalizedBankFeedTransaction[]) {
    const header = [
      "ID de l'opération",
      "Date de l'opération",
      "Libellé de l'opération",
      "Montant total (EUR)",
      "Sens",
      "Contrepartie",
      "Référence",
      "Catégorie",
    ];
    const rows = transactions.map((transaction) => [
      transaction.sourceId,
      transaction.date,
      transaction.label,
      String(transaction.amount).replace(".", ","),
      transaction.amount < 0 ? "debit" : "credit",
      transaction.counterparty ?? "",
      `open-banking:${transaction.providerAccountId}:${transaction.sourceId}`,
      "Open Banking",
    ]);
    return [header.join(";"), ...rows.map((row) => row.map(csv).join(";"))].join("\n");
  }
}

function csv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
