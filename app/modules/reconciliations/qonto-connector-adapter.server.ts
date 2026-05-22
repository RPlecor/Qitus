import type { ProviderBankAccount, ProviderBankTransaction, ProviderSyncPayload } from "../open-banking/open-banking-provider-types.server";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export type QontoBankAccount = {
  slug?: string;
  id?: string;
  iban?: string;
  name?: string;
  currency?: string;
  balance?: number | string;
};

type QontoOrganizationResponse = {
  organization?: {
    bank_accounts?: QontoBankAccount[];
  };
};

type QontoTransactionsResponse = {
  transactions?: QontoTransaction[];
  meta?: {
    current_page?: number;
    next_page?: number | null;
    total_pages?: number;
    total_count?: number;
    per_page?: number;
  };
};

type QontoTransaction = {
  transaction_id?: string;
  id?: string;
  settled_at?: string;
  emitted_at?: string;
  amount?: number | string;
  side?: "debit" | "credit";
  currency?: string;
  label?: string;
  reference?: string;
  category?: string;
  status?: string;
};

export class QontoConnectorAdapter {
  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async sync(input: { fiscalYearStart: Date; fiscalYearEnd: Date }): Promise<ProviderSyncPayload> {
    this.assertConfigured();
    const organization = await this.request<QontoOrganizationResponse>("/organization");
    const accounts = organization.organization?.bank_accounts ?? [];
    const providerAccounts: ProviderBankAccount[] = accounts.map((account) => ({
      providerAccountId: account.iban ?? account.slug ?? account.id ?? "qonto-account",
      name: account.name ?? account.slug ?? "Compte Qonto",
      ibanMasked: maskIban(account.iban),
      currency: account.currency ?? "EUR",
      balance: Number(account.balance ?? 0),
    }));
    const transactions: ProviderBankTransaction[] = [];

    for (const account of accounts) {
      const providerAccountId = account.iban ?? account.slug ?? account.id;
      if (!providerAccountId) continue;
      const accountTransactions = await this.listTransactions(account, input);
      for (const tx of accountTransactions) {
        const rawAmount = Math.abs(Number(tx.amount ?? 0));
        const amount = tx.side === "credit" ? rawAmount : -rawAmount;
        transactions.push({
          providerTransactionId: `qonto:${tx.transaction_id ?? tx.id ?? fallbackId(tx)}`,
          providerAccountId,
          date: dateOnly(tx.settled_at ?? tx.emitted_at),
          label: tx.label ?? tx.reference ?? "Transaction Qonto",
          counterparty: tx.label ?? undefined,
          amount,
          currency: tx.currency ?? "EUR",
        });
      }
    }

    return {
      providerConnectionId: this.config.qontoId ?? "qonto",
      consentExpiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      accounts: providerAccounts,
      transactions,
    };
  }

  private async listTransactions(account: QontoBankAccount, input: { fiscalYearStart: Date; fiscalYearEnd: Date }) {
    const transactions: QontoTransaction[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const params = new URLSearchParams({
        status: "completed",
        per_page: "100",
        current_page: String(page),
      });
      if (account.iban) params.set("iban", account.iban);
      if (account.id) params.set("bank_account_id", account.id);
      params.set("updated_at_from", input.fiscalYearStart.toISOString());
      params.set("updated_at_to", input.fiscalYearEnd.toISOString());
      const result = await this.request<QontoTransactionsResponse>(`/transactions?${params.toString()}`);
      transactions.push(...(result.transactions ?? []));
      const totalPages = result.meta?.total_pages ?? Math.ceil((result.meta?.total_count ?? transactions.length) / (result.meta?.per_page ?? 100));
      hasMore = Boolean(result.meta?.next_page) || page < totalPages;
      page += 1;
    }
    return transactions;
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetcher(`${QONTO_API_BASE}${path}`, {
      headers: {
        Authorization: `${this.config.qontoId}:${this.config.qontoApiSecret}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ExpectedRouteError(`Qonto a répondu ${response.status} : ${redact(body || response.statusText)}`, response.status >= 500 ? 502 : response.status);
    }
    return response.json() as Promise<T>;
  }

  private assertConfigured() {
    if (!this.config.qontoId || !this.config.qontoApiSecret) {
      throw new ExpectedRouteError("Connecteur Qonto live incomplet : QONTO_ID et QONTO_API_SECRET sont requis.", 500);
    }
  }
}

const QONTO_API_BASE = "https://thirdparty.qonto.com/v2";

function maskIban(iban?: string) {
  if (!iban) return undefined;
  return `${iban.slice(0, 4)}************${iban.slice(-4)}`;
}

function dateOnly(value: string | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function fallbackId(tx: QontoTransaction) {
  return [tx.settled_at ?? tx.emitted_at ?? "", tx.amount ?? "", tx.label ?? ""].join(":");
}

function redact(value: string) {
  return value.replace(/(secret|token|key|authorization)["']?\s*[:=]\s*["']?[^"',\s}]+/gi, "$1:[redacted]");
}
