import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BridgeOpenBankingAdapter, GoCardlessBankAccountDataAdapter, PowensOpenBankingAdapter } from "../app/modules/open-banking/open-banking-provider-adapter.server";
import { LocalEncryptedProviderCredentialVault } from "../app/modules/open-banking/provider-credential-vault.server";
import { QontoConnectorAdapter } from "../app/modules/reconciliations/qonto-connector-adapter.server";
import { StripeConnectorAdapter } from "../app/modules/reconciliations/stripe-connector-adapter.server";
import { getRuntimeConfig } from "../app/modules/runtime-config.server";

async function main() {
  const config = getRuntimeConfig({ DATABASE_URL: "postgresql://localhost:5432/paperasse" });
  const goCardless = new GoCardlessBankAccountDataAdapter({ ...config, openBankingProvider: "gocardless", openBankingClientId: "id", openBankingClientSecret: "secret" }, fakeGoCardlessFetch);
  const bridgeRoot = await mkdtemp(path.join(os.tmpdir(), "paperasse-bridge-validate-"));
  const powensRoot = await mkdtemp(path.join(os.tmpdir(), "paperasse-powens-validate-"));
  const bridgeVault = new LocalEncryptedProviderCredentialVault({ ...config, providerSecretEncryptionKey: "validate-key" }, bridgeRoot);
  const powensVault = new LocalEncryptedProviderCredentialVault({ ...config, providerSecretEncryptionKey: "validate-key" }, powensRoot);
  const bridge = new BridgeOpenBankingAdapter({ ...config, openBankingProvider: "bridge", openBankingClientId: "bridge_client", openBankingClientSecret: "bridge_secret", openBankingWebhookSecret: "bridge_webhook", providerSecretEncryptionKey: "validate-key" }, fakeBridgeFetch, bridgeVault);
  const powens = new PowensOpenBankingAdapter({ ...config, openBankingProvider: "powens", openBankingBaseUrl: "https://paperasse.biapi.pro/2.0", openBankingClientId: "powens_client", openBankingClientSecret: "powens_secret", openBankingWebhookSecret: "powens_webhook", providerSecretEncryptionKey: "validate-key" }, fakePowensFetch, powensVault);
  const qonto = new QontoConnectorAdapter({ ...config, qontoId: "org", qontoApiSecret: "secret" }, fakeQontoFetch);
  const stripe = new StripeConnectorAdapter({ ...config, stripeConnectorSecret: "sk_test_123" }, fakeStripeFetch);

  const institutions = await goCardless.listInstitutions?.({ country: "FR" });
  const consent = await goCardless.createConsent({ state: "validate", redirectUri: "http://localhost/callback", institutionId: "SANDBOXFINANCE_SFIN0000" });
  const openBanking = await goCardless.sync({ providerConnectionId: consent.providerConnectionId ?? "req_1" });
  const bridgeConsent = await bridge.createConsent({ state: "validate:bridge", redirectUri: "http://localhost/callback" });
  await bridge.exchangeCallback({ state: "validate:bridge", code: bridgeConsent.providerConnectionId, requisitionId: "item_1" });
  const bridgePayload = await bridge.sync({ providerConnectionId: "item_1" });
  const powensConsent = await powens.createConsent({ state: "validate:powens", redirectUri: "http://localhost/callback" });
  if (!powensConsent.consentUrl.includes("/webauth")) throw new Error("Powens webview URL missing.");
  await powens.exchangeCallback({ state: "validate:powens", requisitionId: "connection_1" });
  const powensPayload = await powens.sync({ providerConnectionId: "connection_1" });
  const qontoPayload = await qonto.sync({ fiscalYearStart: new Date("2025-01-01"), fiscalYearEnd: new Date("2025-12-31") });
  const stripePayload = await stripe.sync({ fiscalYearStart: new Date("2025-01-01"), fiscalYearEnd: new Date("2025-12-31") });

  if (!institutions?.length) throw new Error("GoCardless institutions missing.");
  if (openBanking.transactions.length !== 1) throw new Error("GoCardless booked transaction was not normalized.");
  if (bridgePayload.transactions[0]?.providerTransactionId !== "bridge:5121:1") throw new Error("Bridge transaction was not normalized.");
  if (powensPayload.transactions[0]?.providerTransactionId !== "powens:7001:42") throw new Error("Powens transaction was not normalized.");
  if (qontoPayload.transactions[0]?.providerTransactionId !== "qonto:qtx_1") throw new Error("Qonto source id is not stable.");
  if (stripePayload.balanceTransactions.length !== 1 || stripePayload.payouts.length !== 1) throw new Error("Stripe reconciliation payload incomplete.");

  console.log(JSON.stringify({
    goCardless: { institutions: institutions.length, transactions: openBanking.transactions.length },
    bridge: { accounts: bridgePayload.accounts.length, transactions: bridgePayload.transactions.length },
    powens: { accounts: powensPayload.accounts.length, transactions: powensPayload.transactions.length },
    qonto: { transactions: qontoPayload.transactions.length },
    stripe: { balanceTransactions: stripePayload.balanceTransactions.length, payouts: stripePayload.payouts.length },
  }, null, 2));
  await rm(bridgeRoot, { recursive: true, force: true });
  await rm(powensRoot, { recursive: true, force: true });
}

const fakeGoCardlessFetch = (async (url: string, init?: RequestInit) => {
  if (url.endsWith("/token/new/")) return json({ access: "token" });
  if (url.includes("/institutions/")) return json([{ id: "SANDBOXFINANCE_SFIN0000", name: "Sandbox Finance", countries: ["FR"] }]);
  if (url.endsWith("/agreements/enduser/")) return json({ id: "agreement_1" });
  if (url.endsWith("/requisitions/") && init?.method === "POST") return json({ id: "req_1", link: "https://bank.example/consent" });
  if (url.endsWith("/requisitions/req_1/")) return json({ id: "req_1", accounts: ["acc_1"] });
  if (url.endsWith("/accounts/acc_1/details/")) return json({ account: { iban: "FR761234567890", name: "Compte courant" } });
  if (url.endsWith("/accounts/acc_1/balances/")) return json({ balances: [{ balanceAmount: { amount: "1200.50", currency: "EUR" } }] });
  if (url.endsWith("/accounts/acc_1/transactions/")) return json({ transactions: { booked: [{ transactionId: "tx_1", bookingDate: "2025-03-01", transactionAmount: { amount: "-42.00", currency: "EUR" }, creditorName: "OVH", remittanceInformationUnstructured: "OVH CLOUD" }], pending: [] } });
  throw new Error(`Unexpected GoCardless URL ${url}`);
}) as unknown as typeof fetch;

const fakeBridgeFetch = (async (url: string) => {
  if (url.endsWith("/authorization/token")) return json({ access_token: "bridge_token" });
  if (url.endsWith("/connect-sessions")) return json({ id: "session_1", url: "https://connect.bridgeapi.io/session/session_1" });
  if (url.includes("/accounts?")) return json({ resources: [{ id: 5121, name: "Bridge Pro", iban: "FR761234567890", balance: 300, currency_code: "EUR" }] });
  if (url.includes("/transactions?")) return json({ resources: [{ id: 1, date: "2025-05-01", clean_description: "CLIENT BRIDGE", amount: 120, currency_code: "EUR", future: false }] });
  throw new Error(`Unexpected Bridge URL ${url}`);
}) as unknown as typeof fetch;

const fakePowensFetch = (async (url: string) => {
  if (url.endsWith("/auth/init")) return json({ auth_token: "powens_token" });
  if (url.endsWith("/auth/token/code")) return json({ code: "temporary_code" });
  if (url.includes("/connections/connection_1/accounts")) return json({ accounts: [{ id: 7001, name: "Powens Pro", iban: "FR761234567890", balance: "500", currency: { id: "EUR" } }] });
  if (url.includes("/transactions?")) return json({ transactions: [{ id: 42, id_account: 7001, date: "2025-06-01", wording: "CLIENT POWENS", value: "250", currency: { id: "EUR" } }], _links: { next: null } });
  throw new Error(`Unexpected Powens URL ${url}`);
}) as unknown as typeof fetch;

const fakeQontoFetch = (async (url: string) => {
  if (url.endsWith("/organization")) return json({ organization: { bank_accounts: [{ iban: "FR761234567890", name: "Qonto Principal", currency: "EUR", balance: "100" }] } });
  if (url.includes("/transactions?")) return json({ transactions: [{ transaction_id: "qtx_1", settled_at: "2025-04-01T10:00:00Z", amount: "72.00", side: "debit", currency: "EUR", label: "OVH CLOUD", status: "completed" }], meta: { current_page: 1, total_pages: 1, per_page: 100 } });
  throw new Error(`Unexpected Qonto URL ${url}`);
}) as unknown as typeof fetch;

const fakeStripeFetch = (async (url: string) => {
  if (url.includes("/balance_transactions?")) return json({ data: [{ id: "txn_1", type: "charge", created: 1735689600, amount: 12000, fee: 390, net: 11610, currency: "eur", payout: "po_1" }], has_more: false });
  if (url.includes("/payouts?")) return json({ data: [{ id: "po_1", amount: 11610, currency: "eur", arrival_date: 1735776000, status: "paid" }], has_more: false });
  throw new Error(`Unexpected Stripe URL ${url}`);
}) as unknown as typeof fetch;

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
