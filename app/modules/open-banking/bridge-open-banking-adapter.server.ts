import { createHmac } from "node:crypto";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import type { OpenBankingProviderAdapter, ProviderBankAccount, ProviderBankTransaction, ProviderSyncPayload } from "./open-banking-provider-types.server";
import { addDays, fallbackTransactionId, maskIban, parseJsonResponse, safeEqual } from "./open-banking-adapter-utils.server";
import { LocalEncryptedProviderCredentialVault, type ProviderCredentialVault } from "./provider-credential-vault.server";

const BRIDGE_BASE_URL = "https://api.bridgeapi.io";
const BRIDGE_VERSION = "2025-01-15";

export class BridgeOpenBankingAdapter implements OpenBankingProviderAdapter {
  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly fetcher: typeof fetch = fetch,
    private readonly vault: ProviderCredentialVault = new LocalEncryptedProviderCredentialVault(config)
  ) {}

  getInfo() {
    return { providerLabel: "Bridge API", selectionMode: "provider_webview" as const };
  }

  async listInstitutions() {
    return [];
  }

  async createConsent(input: { state: string; redirectUri: string }) {
    this.assertConfigured();
    const token = await this.userAccessToken(input.state);
    const session = await this.request<BridgeConnectSession>("/v3/aggregation/connect-sessions", {
      method: "POST",
      headers: this.headers(token),
      body: JSON.stringify({
        user_email: bridgeEmail(input.state),
        callback_url: input.redirectUri,
      }),
    });
    await this.vault.putSecret(secretKey(session.id), token);
    await this.vault.putSecret(secretKey(`bridge-session:${session.id}`), token);
    return {
      provider: "bridge",
      consentUrl: session.url,
      providerConnectionId: `bridge-session:${session.id}`,
      consentExpiresAt: addDays(90).toISOString(),
      metadata: { state: input.state, sessionId: session.id },
    };
  }

  async exchangeCallback(input: { state?: string | null; requisitionId?: string | null; code?: string | null }) {
    this.assertConfigured();
    const sessionId = input.code ?? input.requisitionId ?? undefined;
    const itemId = providerConnectionId(input);
    if (!itemId) throw new ExpectedRouteError("Callback Bridge incomplet : item_id manquant.", 400);
    if (sessionId) {
      const token = await this.vault.getSecret(secretKey(sessionId.replace(/^bridge-session:/, ""))) ?? await this.vault.getSecret(secretKey(sessionId));
      if (token) await this.vault.putSecret(secretKey(itemId), token);
    }
    return { providerConnectionId: itemId, consentExpiresAt: addDays(90).toISOString(), metadata: { state: input.state ?? null, itemId } };
  }

  async sync(input: { providerConnectionId: string }): Promise<ProviderSyncPayload> {
    this.assertConfigured();
    const token = await this.vault.getSecret(secretKey(input.providerConnectionId));
    if (!token) throw new ExpectedRouteError("Token Bridge introuvable dans le coffre provider. Relance le consentement bancaire.", 409);
    const accounts = await this.fetchAccounts(token, input.providerConnectionId);
    const transactions: ProviderBankTransaction[] = [];
    for (const account of accounts) transactions.push(...await this.fetchTransactions(token, account.providerAccountId));
    return { providerConnectionId: input.providerConnectionId, consentExpiresAt: addDays(90).toISOString(), accounts, transactions };
  }

  async disconnect(input: { providerConnectionId: string }) {
    if (!this.config.openBankingClientId || !this.config.openBankingClientSecret) return;
    const token = await this.vault.getSecret(secretKey(input.providerConnectionId));
    if (token) {
      await this.request(`/v3/aggregation/items/${encodeURIComponent(input.providerConnectionId)}`, { method: "DELETE", headers: this.headers(token), allowEmpty: true }).catch(() => undefined);
    }
    await this.vault.deleteSecret(secretKey(input.providerConnectionId));
  }

  async verifyWebhook(rawBody: string, signature: string | null) {
    if (!signature || !this.config.openBankingWebhookSecret) return false;
    const expected = createHmac("sha256", this.config.openBankingWebhookSecret).update(rawBody).digest("hex");
    return safeEqual(signature, expected);
  }

  private async userAccessToken(state: string) {
    const response = await this.request<{ access_token: string }>("/v3/aggregation/authorization/token", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ external_user_id: stableBridgeUserId(state) }),
    });
    return response.access_token;
  }

  private async fetchAccounts(token: string, itemId: string) {
    const accounts: ProviderBankAccount[] = [];
    for await (const account of this.paginate<BridgeAccount>(`/v3/aggregation/accounts?limit=500&item_id=${encodeURIComponent(itemId)}`, token)) {
      if (String(account.data_access ?? "").toLowerCase() === "disabled") continue;
      accounts.push({
        providerAccountId: String(account.id),
        name: account.name ?? account.clean_name ?? account.bank_name ?? "Compte bancaire Bridge",
        ibanMasked: maskIban(account.iban),
        currency: account.currency_code ?? account.currency ?? "EUR",
        balance: Number(account.balance ?? account.accounting_balance ?? 0),
        status: "ACTIVE",
      });
    }
    return accounts;
  }

  private async fetchTransactions(token: string, accountId: string) {
    const transactions: ProviderBankTransaction[] = [];
    for await (const tx of this.paginate<BridgeTransaction>(`/v3/aggregation/transactions?limit=500&account_id=${encodeURIComponent(accountId)}`, token)) {
      if (tx.future === true) continue;
      const amount = Number(tx.amount ?? 0);
      const label = tx.clean_description ?? tx.provider_description ?? tx.description ?? "Transaction Bridge";
      transactions.push({
        providerTransactionId: `bridge:${accountId}:${tx.id ?? fallbackTransactionId("bridge", tx.date, amount, label)}`,
        providerAccountId: accountId,
        date: tx.date ?? tx.booking_date ?? new Date().toISOString().slice(0, 10),
        label,
        counterparty: tx.counterparty_name ?? undefined,
        amount,
        currency: tx.currency_code ?? tx.currency ?? "EUR",
      });
    }
    return transactions;
  }

  private async *paginate<T>(path: string, token: string): AsyncGenerator<T> {
    let next: string | null = `${BRIDGE_BASE_URL}${path}`;
    while (next) {
      const page: BridgeList<T> = await this.request<BridgeList<T>>(next, { headers: this.headers(token), absolute: true });
      for (const item of page.resources ?? page.data ?? []) yield item;
      next = page.pagination?.next_uri ?? page.next_uri ?? page._links?.next?.href ?? null;
      if (!next && page.has_more && page.next_cursor) {
        const url = new URL(`${BRIDGE_BASE_URL}${path}`);
        url.searchParams.set("starting_after", page.next_cursor);
        next = url.toString();
      }
    }
  }

  private headers(token?: string) {
    return {
      "Bridge-Version": BRIDGE_VERSION,
      "Client-Id": this.config.openBankingClientId ?? "",
      "Client-Secret": this.config.openBankingClientSecret ?? "",
      accept: "application/json",
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async request<T = unknown>(pathOrUrl: string, init: RequestInit & { allowEmpty?: boolean; absolute?: boolean } = {}): Promise<T> {
    const url = init.absolute ? pathOrUrl : `${BRIDGE_BASE_URL}${pathOrUrl}`;
    return parseJsonResponse<T>(await this.fetcher(url, init), "Bridge API", init.allowEmpty);
  }

  private assertConfigured() {
    if (!this.config.openBankingClientId || !this.config.openBankingClientSecret) {
      throw new ExpectedRouteError("Configuration Bridge incomplète : OPEN_BANKING_CLIENT_ID et OPEN_BANKING_CLIENT_SECRET sont requis.", 500);
    }
  }
}

type BridgeConnectSession = { id: string; url: string };
type BridgeList<T> = { resources?: T[]; data?: T[]; pagination?: { next_uri?: string | null }; _links?: { next?: { href?: string | null } }; has_more?: boolean; next_cursor?: string; next_uri?: string | null };
type BridgeAccount = { id: string | number; name?: string; clean_name?: string; bank_name?: string; iban?: string; currency?: string; currency_code?: string; balance?: number; accounting_balance?: number; data_access?: string };
type BridgeTransaction = { id?: string | number; date?: string; booking_date?: string; clean_description?: string; provider_description?: string; description?: string; amount?: number; currency?: string; currency_code?: string; counterparty_name?: string; future?: boolean };

function stableBridgeUserId(state: string) {
  return createHmac("sha256", "paperasse-bridge-user").update(state.split(":").slice(0, 2).join(":") || state).digest("hex");
}

function bridgeEmail(state: string) {
  return `paperasse-${stableBridgeUserId(state).slice(0, 16)}@example.invalid`;
}

function providerConnectionId(input: { requisitionId?: string | null; code?: string | null }) {
  const raw = input.requisitionId ?? input.code;
  if (!raw) return undefined;
  return raw.startsWith("bridge-session:") ? undefined : String(raw);
}

function secretKey(providerConnectionId: string) {
  return `bridge:${providerConnectionId}`;
}
