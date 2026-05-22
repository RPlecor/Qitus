import { describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BridgeOpenBankingAdapter, GoCardlessBankAccountDataAdapter, PowensOpenBankingAdapter } from "../app/modules/open-banking/open-banking-provider-adapter.server";
import { LocalEncryptedProviderCredentialVault } from "../app/modules/open-banking/provider-credential-vault.server";
import { QontoConnectorAdapter } from "../app/modules/reconciliations/qonto-connector-adapter.server";
import { StripeConnectorAdapter } from "../app/modules/reconciliations/stripe-connector-adapter.server";
import { getRuntimeConfig } from "../app/modules/runtime-config.server";

const baseConfig = getRuntimeConfig({ DATABASE_URL: "postgresql://localhost:5432/paperasse" });

describe("live connector adapters", () => {
  it("creates GoCardless consent and syncs only booked transactions", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/token/new/")) return json({ access: "access_token" });
      if (url.includes("/institutions/")) return json([{ id: "SANDBOXFINANCE_SFIN0000", name: "Sandbox Finance", countries: ["FR"] }]);
      if (url.endsWith("/agreements/enduser/")) return json({ id: "agreement_1" });
      if (url.endsWith("/requisitions/") && init?.method === "POST") return json({ id: "req_1", link: "https://bank.example/consent" });
      if (url.endsWith("/requisitions/req_1/")) return json({ id: "req_1", accounts: ["acc_1"] });
      if (url.endsWith("/accounts/acc_1/details/")) return json({ account: { iban: "FR761234567890", name: "Compte courant" } });
      if (url.endsWith("/accounts/acc_1/balances/")) return json({ balances: [{ balanceAmount: { amount: "1200.50", currency: "EUR" } }] });
      if (url.endsWith("/accounts/acc_1/transactions/")) return json({
        transactions: {
          booked: [{ transactionId: "tx_1", bookingDate: "2025-03-01", transactionAmount: { amount: "-42.00", currency: "EUR" }, creditorName: "OVH", remittanceInformationUnstructured: "OVH CLOUD" }],
          pending: [{ transactionId: "pending_1", bookingDate: "2025-03-02", transactionAmount: { amount: "-10.00", currency: "EUR" } }],
        },
      });
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;
    const adapter = new GoCardlessBankAccountDataAdapter({ ...baseConfig, openBankingProvider: "gocardless", openBankingClientId: "secret_id", openBankingClientSecret: "secret_key" }, fetcher);

    await expect(adapter.listInstitutions?.({ country: "FR" })).resolves.toHaveLength(1);
    await expect(adapter.createConsent({ state: "state_1", redirectUri: "http://localhost/callback", institutionId: "SANDBOXFINANCE_SFIN0000" })).resolves.toMatchObject({ providerConnectionId: "req_1" });
    const payload = await adapter.sync({ providerConnectionId: "req_1" });

    expect(payload.accounts[0]).toMatchObject({ providerAccountId: "acc_1", ibanMasked: "FR76************7890" });
    expect(payload.transactions).toEqual([expect.objectContaining({ providerTransactionId: "gocardless:acc_1:tx_1", amount: -42 })]);
  });

  it("normalizes Qonto transactions with stable source ids", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/organization")) return json({ organization: { bank_accounts: [{ iban: "FR761234567890", name: "Qonto Principal", currency: "EUR", balance: "100" }] } });
      if (url.includes("/transactions?")) return json({ transactions: [{ transaction_id: "qtx_1", settled_at: "2025-04-01T10:00:00Z", amount: "72.00", side: "debit", currency: "EUR", label: "OVH CLOUD", status: "completed" }], meta: { current_page: 1, total_pages: 1, per_page: 100 } });
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;
    const adapter = new QontoConnectorAdapter({ ...baseConfig, qontoId: "org", qontoApiSecret: "secret" }, fetcher);

    const payload = await adapter.sync({ fiscalYearStart: new Date("2025-01-01"), fiscalYearEnd: new Date("2025-12-31") });
    expect(payload.accounts[0]).toMatchObject({ providerAccountId: "FR761234567890", name: "Qonto Principal" });
    expect(payload.transactions[0]).toMatchObject({ providerTransactionId: "qonto:qtx_1", amount: -72, label: "OVH CLOUD" });
  });

  it("fetches Stripe balance transactions and payouts for reconciliation", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("/balance_transactions?")) return json({ data: [{ id: "txn_1", type: "charge", created: 1735689600, amount: 12000, fee: 390, net: 11610, currency: "eur", payout: "po_1" }], has_more: false });
      if (url.includes("/payouts?")) return json({ data: [{ id: "po_1", amount: 11610, currency: "eur", arrival_date: 1735776000, status: "paid" }], has_more: false });
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;
    const adapter = new StripeConnectorAdapter({ ...baseConfig, stripeConnectorSecret: "sk_test_123" }, fetcher);

    const payload = await adapter.sync({ fiscalYearStart: new Date("2025-01-01"), fiscalYearEnd: new Date("2025-12-31") });
    expect(payload.balanceTransactions[0]).toMatchObject({ id: "txn_1", type: "charge", fee: 390 });
    expect(payload.payouts[0]).toMatchObject({ id: "po_1", amount: 11610 });
  });

  it("encrypts provider credentials outside Prisma", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "paperasse-provider-vault-"));
    const vault = new LocalEncryptedProviderCredentialVault({ ...baseConfig, providerSecretEncryptionKey: "test-key" }, root);
    await vault.putSecret("powens:connection", "user-token");
    await expect(vault.hasSecret("powens:connection")).resolves.toBe(true);
    await expect(vault.getSecret("powens:connection")).resolves.toBe("user-token");
    await vault.deleteSecret("powens:connection");
    await expect(vault.getSecret("powens:connection")).resolves.toBeNull();
    await rm(root, { recursive: true, force: true });
  });

  it("creates Bridge sessions and syncs accounts/transactions without future movements", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "paperasse-bridge-vault-"));
    const vault = new LocalEncryptedProviderCredentialVault({ ...baseConfig, providerSecretEncryptionKey: "test-key" }, root);
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/authorization/token")) return json({ access_token: "bridge_token" });
      if (url.endsWith("/connect-sessions")) return json({ id: "session_1", url: "https://connect.bridgeapi.io/session/session_1" });
      if (url.includes("/accounts?")) return json({ resources: [{ id: 5121, name: "Bridge Pro", iban: "FR761234567890", balance: 300, currency_code: "EUR" }] });
      if (url.includes("/transactions?")) return json({ resources: [
        { id: 1, date: "2025-05-01", clean_description: "CLIENT BRIDGE", amount: 120, currency_code: "EUR", future: false },
        { id: 2, date: "2026-01-01", clean_description: "FUTURE", amount: 10, currency_code: "EUR", future: true },
      ] });
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;
    const adapter = new BridgeOpenBankingAdapter({ ...baseConfig, openBankingProvider: "bridge", openBankingClientId: "client", openBankingClientSecret: "secret", openBankingWebhookSecret: "webhook", providerSecretEncryptionKey: "test-key" }, fetcher, vault);

    const consent = await adapter.createConsent({ state: "company:fy:123", redirectUri: "http://localhost/callback" });
    expect(consent).toMatchObject({ providerConnectionId: "bridge-session:session_1", consentUrl: "https://connect.bridgeapi.io/session/session_1" });
    await expect(adapter.exchangeCallback({ state: "company:fy:123", code: "bridge-session:session_1", requisitionId: "item_1" })).resolves.toMatchObject({ providerConnectionId: "item_1" });
    const payload = await adapter.sync({ providerConnectionId: "item_1" });
    expect(payload.accounts[0]).toMatchObject({ providerAccountId: "5121", ibanMasked: "FR76************7890" });
    expect(payload.transactions).toEqual([expect.objectContaining({ providerTransactionId: "bridge:5121:1", amount: 120 })]);
    await rm(root, { recursive: true, force: true });
  });

  it("creates Powens webview sessions and syncs active accounts/transactions", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "paperasse-powens-vault-"));
    const vault = new LocalEncryptedProviderCredentialVault({ ...baseConfig, providerSecretEncryptionKey: "test-key" }, root);
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/init")) return json({ auth_token: "powens_token" });
      if (url.endsWith("/auth/token/code")) return json({ code: "temporary_code" });
      if (url.includes("/connections/connection_1/accounts")) return json({ accounts: [{ id: 7001, name: "Powens Pro", iban: "FR761234567890", balance: "500", currency: { id: "EUR" } }] });
      if (url.includes("/transactions?")) return json({ transactions: [{ id: 42, id_account: 7001, date: "2025-06-01", wording: "CLIENT POWENS", value: "250", currency: { id: "EUR" } }], _links: { next: null } });
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;
    const adapter = new PowensOpenBankingAdapter({ ...baseConfig, openBankingProvider: "powens", openBankingBaseUrl: "https://paperasse.biapi.pro/2.0", openBankingClientId: "client", openBankingClientSecret: "secret", openBankingWebhookSecret: "webhook", providerSecretEncryptionKey: "test-key" }, fetcher, vault);

    const consent = await adapter.createConsent({ state: "company:fy:123", redirectUri: "http://localhost/callback" });
    expect(consent.consentUrl).toContain("/webauth");
    await expect(adapter.exchangeCallback({ state: "company:fy:123", requisitionId: "connection_1" })).resolves.toMatchObject({ providerConnectionId: "connection_1" });
    const payload = await adapter.sync({ providerConnectionId: "connection_1" });
    expect(payload.accounts[0]).toMatchObject({ providerAccountId: "7001", name: "Powens Pro" });
    expect(payload.transactions[0]).toMatchObject({ providerTransactionId: "powens:7001:42", amount: 250 });
    await adapter.disconnect({ providerConnectionId: "connection_1" });
    await expect(vault.getSecret("powens:connection_1")).resolves.toBeNull();
    await rm(root, { recursive: true, force: true });
  });
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
