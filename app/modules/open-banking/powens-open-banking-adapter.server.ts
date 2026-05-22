import { createHmac } from "node:crypto";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import type { OpenBankingProviderAdapter, ProviderBankAccount, ProviderBankTransaction, ProviderSyncPayload } from "./open-banking-provider-types.server";
import { addDays, fallbackTransactionId, maskIban, parseJsonResponse, safeEqual } from "./open-banking-adapter-utils.server";
import { LocalEncryptedProviderCredentialVault, type ProviderCredentialVault } from "./provider-credential-vault.server";

const DEFAULT_POWENS_BASE_URL = "https://example.biapi.pro/2.0";

export class PowensOpenBankingAdapter implements OpenBankingProviderAdapter {
  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly fetcher: typeof fetch = fetch,
    private readonly vault: ProviderCredentialVault = new LocalEncryptedProviderCredentialVault(config)
  ) {}

  getInfo() {
    return { providerLabel: "Powens", selectionMode: "provider_webview" as const };
  }

  async listInstitutions() {
    return [];
  }

  async createConsent(input: { state: string; redirectUri: string }) {
    this.assertConfigured();
    const token = await this.userToken();
    await this.vault.putSecret(secretKey(input.state), token);
    const code = await this.request<{ code: string }>("/auth/token/code", {
      headers: this.headers(token),
    });
    const url = new URL(`${this.baseUrl()}/webauth`);
    url.searchParams.set("client_id", this.config.openBankingClientId ?? "");
    url.searchParams.set("token", code.code);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("state", input.state);
    return {
      provider: "powens",
      consentUrl: url.toString(),
      providerConnectionId: `powens-pending:${stablePowensUserId(input.state)}`,
      consentExpiresAt: addDays(180).toISOString(),
      metadata: { state: input.state, powensUserId: stablePowensUserId(input.state) },
    };
  }

  async exchangeCallback(input: { state?: string | null; requisitionId?: string | null; code?: string | null }) {
    this.assertConfigured();
    const connectionId = input.requisitionId ?? input.code;
    if (!connectionId) throw new ExpectedRouteError("Callback Powens incomplet : id_connection manquant.", 400);
    const token = input.state ? await this.vault.getSecret(secretKey(input.state)) : null;
    if (token) await this.vault.putSecret(secretKey(connectionId), token);
    return {
      providerConnectionId: String(connectionId),
      consentExpiresAt: addDays(180).toISOString(),
      metadata: { state: input.state ?? null, connectionId },
    };
  }

  async sync(input: { providerConnectionId: string }): Promise<ProviderSyncPayload> {
    this.assertConfigured();
    const token = await this.vault.getSecret(secretKey(input.providerConnectionId));
    if (!token) throw new ExpectedRouteError("Token Powens introuvable dans le coffre provider. Relance le consentement bancaire.", 409);
    const accounts = await this.fetchAccounts(token, input.providerConnectionId);
    const transactions = await this.fetchTransactions(token, accounts);
    return { providerConnectionId: input.providerConnectionId, consentExpiresAt: addDays(180).toISOString(), accounts, transactions };
  }

  async disconnect(input: { providerConnectionId: string }) {
    const token = await this.vault.getSecret(secretKey(input.providerConnectionId));
    if (token) {
      await this.request(`/users/me/connections/${encodeURIComponent(input.providerConnectionId)}`, { method: "DELETE", headers: this.headers(token), allowEmpty: true }).catch(() => undefined);
    }
    await this.vault.deleteSecret(secretKey(input.providerConnectionId));
  }

  async verifyWebhook(rawBody: string, signature: string | null) {
    if (!signature || !this.config.openBankingWebhookSecret) return false;
    const expected = createHmac("sha256", this.config.openBankingWebhookSecret).update(rawBody).digest("hex");
    return safeEqual(signature, expected);
  }

  private async userToken() {
    const response = await this.request<{ auth_token?: string; access_token?: string }>("/auth/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.config.openBankingClientId,
        client_secret: this.config.openBankingClientSecret,
      }),
    });
    const token = response.auth_token ?? response.access_token;
    if (!token) throw new ExpectedRouteError("Powens n'a pas retourné de token utilisateur.", 502);
    return token;
  }

  private async fetchAccounts(token: string, connectionId: string) {
    const accounts = await this.request<{ accounts?: PowensAccount[] }>(`/users/me/connections/${encodeURIComponent(connectionId)}/accounts?all`, { headers: this.headers(token) })
      .catch(() => this.request<{ accounts?: PowensAccount[] }>("/users/me/accounts?all", { headers: this.headers(token) }));
    return (accounts.accounts ?? [])
      .filter((account) => !account.disabled && !account.deleted)
      .map((account): ProviderBankAccount => ({
        providerAccountId: String(account.id),
        name: account.name ?? account.original_name ?? "Compte bancaire Powens",
        ibanMasked: maskIban(account.iban),
        currency: account.currency?.id ?? account.currency?.code ?? "EUR",
        balance: Number(account.balance ?? 0),
        status: "ACTIVE",
      }));
  }

  private async fetchTransactions(token: string, accounts: ProviderBankAccount[]) {
    const accountIds = new Set(accounts.map((account) => account.providerAccountId));
    const transactions: ProviderBankTransaction[] = [];
    let next: string | null = `${this.baseUrl()}/users/me/transactions?limit=1000`;
    while (next) {
      const page: PowensTransactionsList = await this.request<PowensTransactionsList>(next, { headers: this.headers(token), absolute: true });
      for (const tx of page.transactions ?? []) {
        const accountId = String(tx.id_account ?? tx.account?.id ?? "");
        if (accountId && accountIds.size > 0 && !accountIds.has(accountId)) continue;
        if (tx.deleted) continue;
        const amount = Number(tx.value ?? tx.amount ?? 0);
        const label = tx.wording ?? tx.original_wording ?? tx.label ?? "Transaction Powens";
        transactions.push({
          providerTransactionId: `powens:${accountId || "account"}:${tx.id ?? fallbackTransactionId("powens", tx.date, amount, label)}`,
          providerAccountId: accountId || "powens-account",
          date: tx.date ?? tx.application_date ?? tx.rdate ?? new Date().toISOString().slice(0, 10),
          label,
          counterparty: tx.counterparty ?? undefined,
          amount,
          currency: tx.currency?.id ?? tx.currency?.code ?? "EUR",
        });
      }
      next = page._links?.next?.href ?? null;
    }
    return transactions;
  }

  private headers(token: string) {
    return { authorization: `Bearer ${token}`, accept: "application/json", "content-type": "application/json" };
  }

  private async request<T = unknown>(pathOrUrl: string, init: RequestInit & { allowEmpty?: boolean; absolute?: boolean } = {}): Promise<T> {
    const url = init.absolute ? pathOrUrl : `${this.baseUrl()}${pathOrUrl}`;
    return parseJsonResponse<T>(await this.fetcher(url, init), "Powens", init.allowEmpty);
  }

  private baseUrl() {
    return (this.config.openBankingBaseUrl ?? DEFAULT_POWENS_BASE_URL).replace(/\/+$/, "");
  }

  private assertConfigured() {
    if (!this.config.openBankingBaseUrl) throw new ExpectedRouteError("Configuration Powens incomplète : OPEN_BANKING_BASE_URL est requis.", 500);
    if (!this.config.openBankingClientId || !this.config.openBankingClientSecret) {
      throw new ExpectedRouteError("Configuration Powens incomplète : OPEN_BANKING_CLIENT_ID et OPEN_BANKING_CLIENT_SECRET sont requis.", 500);
    }
  }
}

type PowensAccount = {
  id: string | number;
  name?: string;
  original_name?: string;
  iban?: string;
  balance?: string | number;
  disabled?: string | null;
  deleted?: string | null;
  currency?: { id?: string; code?: string };
};

type PowensTransactionsList = {
  transactions?: PowensTransaction[];
  _links?: { next?: { href?: string | null } };
};

type PowensTransaction = {
  id?: string | number;
  id_account?: string | number;
  account?: { id?: string | number };
  date?: string;
  application_date?: string;
  rdate?: string;
  value?: string | number;
  amount?: string | number;
  wording?: string;
  original_wording?: string;
  label?: string;
  counterparty?: string;
  deleted?: string | null;
  currency?: { id?: string; code?: string };
};

function stablePowensUserId(state: string) {
  return createHmac("sha256", "paperasse-powens-user").update(state.split(":").slice(0, 2).join(":") || state).digest("hex");
}

function secretKey(key: string) {
  return `powens:${key}`;
}
