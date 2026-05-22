import { createHmac } from "node:crypto";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import type { OpenBankingProviderAdapter, ProviderBankAccount, ProviderBankTransaction, ProviderSyncPayload } from "./open-banking-provider-types.server";
import { addDays, fallbackTransactionId, maskIban, parseJsonResponse, safeEqual } from "./open-banking-adapter-utils.server";

const GO_CARDLESS_BANK_DATA_BASE = "https://bankaccountdata.gocardless.com/api/v2";

export class GoCardlessBankAccountDataAdapter implements OpenBankingProviderAdapter {
  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly fetcher: typeof fetch = fetch
  ) {}

  getInfo() {
    return { providerLabel: "GoCardless Bank Account Data", selectionMode: "institution_select" as const };
  }

  async listInstitutions(input: { country: string }) {
    this.assertConfigured();
    const token = await this.accessToken();
    const institutions = await this.request<Array<{ id: string; name: string; countries?: string[]; logo?: string | null }>>(`/institutions/?country=${encodeURIComponent(input.country || "FR")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return institutions.map((institution) => ({
      id: institution.id,
      name: institution.name,
      countries: institution.countries,
      logo: institution.logo ?? null,
    }));
  }

  async createConsent(input: { state: string; redirectUri: string; institutionId?: string | null }) {
    this.assertConfigured();
    if (!input.institutionId) throw new ExpectedRouteError("Sélectionne un établissement bancaire avant de lancer le consentement.", 400);
    const token = await this.accessToken();
    const agreement = await this.request<{ id: string }>("/agreements/enduser/", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        institution_id: input.institutionId,
        max_historical_days: 730,
        access_valid_for_days: 90,
        access_scope: ["balances", "details", "transactions"],
      }),
    });
    const requisition = await this.request<{ id: string; link: string }>("/requisitions/", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        redirect: input.redirectUri,
        institution_id: input.institutionId,
        reference: input.state,
        agreement: agreement.id,
        user_language: "FR",
      }),
    });
    return { provider: "gocardless", consentUrl: requisition.link, providerConnectionId: requisition.id };
  }

  async exchangeCallback(input: { requisitionId?: string | null }) {
    this.assertConfigured();
    if (!input.requisitionId) throw new ExpectedRouteError("Callback GoCardless incomplet : requisition manquante.", 400);
    const token = await this.accessToken();
    await this.request<{ id: string; accounts?: string[] }>(`/requisitions/${encodeURIComponent(input.requisitionId)}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { providerConnectionId: input.requisitionId, consentExpiresAt: addDays(90).toISOString() };
  }

  async sync(input: { providerConnectionId: string }): Promise<ProviderSyncPayload> {
    this.assertConfigured();
    const token = await this.accessToken();
    const requisition = await this.request<{ id: string; accounts?: string[] }>(`/requisitions/${encodeURIComponent(input.providerConnectionId)}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const accounts: ProviderBankAccount[] = [];
    const transactions: ProviderBankTransaction[] = [];

    for (const accountId of requisition.accounts ?? []) {
      const [details, balances, accountTransactions] = await Promise.all([
        this.request<GoCardlessAccountDetails>(`/accounts/${encodeURIComponent(accountId)}/details/`, { headers: { Authorization: `Bearer ${token}` } }),
        this.request<GoCardlessBalances>(`/accounts/${encodeURIComponent(accountId)}/balances/`, { headers: { Authorization: `Bearer ${token}` } }),
        this.request<GoCardlessTransactions>(`/accounts/${encodeURIComponent(accountId)}/transactions/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const account = details.account ?? {};
      const firstBalance = balances.balances?.[0];
      accounts.push({
        providerAccountId: accountId,
        name: account.name ?? account.ownerName ?? account.iban ?? "Compte bancaire",
        ibanMasked: maskIban(account.iban),
        currency: firstBalance?.balanceAmount?.currency ?? account.currency ?? "EUR",
        balance: Number(firstBalance?.balanceAmount?.amount ?? 0),
      });

      for (const tx of accountTransactions.transactions?.booked ?? []) {
        const amount = Number(tx.transactionAmount?.amount ?? 0);
        const label = tx.remittanceInformationUnstructuredArray?.join(" ") || tx.remittanceInformationUnstructured || tx.additionalInformation || "Transaction bancaire";
        transactions.push({
          providerTransactionId: `gocardless:${accountId}:${tx.transactionId || fallbackTransactionId("gocardless", tx.bookingDate ?? tx.valueDate, amount, label)}`,
          providerAccountId: accountId,
          date: tx.bookingDate ?? tx.valueDate ?? new Date().toISOString().slice(0, 10),
          label,
          counterparty: tx.creditorName ?? tx.debtorName ?? undefined,
          amount,
          currency: tx.transactionAmount?.currency ?? "EUR",
        });
      }
    }

    return {
      providerConnectionId: input.providerConnectionId,
      consentExpiresAt: addDays(90).toISOString(),
      accounts,
      transactions,
    };
  }

  async disconnect(input: { providerConnectionId: string }) {
    this.assertConfigured();
    const token = await this.accessToken();
    await this.request(`/requisitions/${encodeURIComponent(input.providerConnectionId)}/`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      allowEmpty: true,
    });
  }

  async verifyWebhook(rawBody: string, signature: string | null) {
    if (!signature || !this.config.openBankingWebhookSecret) return false;
    const expected = createHmac("sha256", this.config.openBankingWebhookSecret).update(rawBody).digest("hex");
    return safeEqual(signature, expected);
  }

  private async accessToken() {
    const token = await this.request<{ access: string }>("/token/new/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret_id: this.config.openBankingClientId,
        secret_key: this.config.openBankingClientSecret,
      }),
    });
    return token.access;
  }

  private async request<T = unknown>(path: string, init: RequestInit & { allowEmpty?: boolean } = {}): Promise<T> {
    return parseJsonResponse<T>(await this.fetcher(`${GO_CARDLESS_BANK_DATA_BASE}${path}`, init), "GoCardless Bank Account Data", init.allowEmpty);
  }

  private assertConfigured() {
    if (!this.config.openBankingClientId || !this.config.openBankingClientSecret) {
      throw new ExpectedRouteError("Configuration GoCardless incomplète : OPEN_BANKING_CLIENT_ID et OPEN_BANKING_CLIENT_SECRET sont requis.", 500);
    }
  }
}

type GoCardlessAccountDetails = {
  account?: {
    iban?: string;
    name?: string;
    ownerName?: string;
    currency?: string;
  };
};

type GoCardlessBalances = {
  balances?: Array<{ balanceAmount?: { amount?: string; currency?: string } }>;
};

type GoCardlessTransactions = {
  transactions?: {
    booked?: GoCardlessTransaction[];
    pending?: GoCardlessTransaction[];
  };
};

type GoCardlessTransaction = {
  transactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  creditorName?: string;
  debtorName?: string;
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  additionalInformation?: string;
  transactionAmount?: { amount?: string; currency?: string };
};
