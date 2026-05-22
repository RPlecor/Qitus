import type { OpenBankingProviderAdapter, ProviderSyncPayload } from "./open-banking-provider-types.server";
import { addDays } from "./open-banking-adapter-utils.server";

export class MockOpenBankingAdapter implements OpenBankingProviderAdapter {
  getInfo() {
    return { providerLabel: "Open Banking mock", selectionMode: "institution_select" as const };
  }

  async listInstitutions(input: { country: string }) {
    return [{ id: `SANDBOXFINANCE_${input.country || "FR"}`, name: "Sandbox Finance", countries: [input.country || "FR"], logo: null }];
  }

  async createConsent(input: { state: string; redirectUri: string }) {
    const url = new URL(input.redirectUri);
    url.searchParams.set("code", "mock-consent");
    url.searchParams.set("state", input.state);
    url.searchParams.set("requisitionId", "mock-connection");
    return { provider: "mock", consentUrl: url.toString(), providerConnectionId: "mock-connection" };
  }

  async exchangeCallback() {
    return { providerConnectionId: "mock-connection", consentExpiresAt: addDays(90).toISOString() };
  }

  async sync(input: { providerConnectionId: string }): Promise<ProviderSyncPayload> {
    return {
      providerConnectionId: input.providerConnectionId,
      consentExpiresAt: addDays(90).toISOString(),
      accounts: [{
        providerAccountId: "mock-account-5121",
        name: "Compte courant mock",
        ibanMasked: "FR76************1234",
        currency: "EUR",
        balance: 12750.42,
      }],
      transactions: [
        {
          providerTransactionId: "ob-mock-001",
          providerAccountId: "mock-account-5121",
          date: "2025-10-02",
          label: "VIR SEPA RECU CLIENT OPEN BANKING",
          counterparty: "Client Open Banking",
          amount: 1800,
          currency: "EUR",
        },
        {
          providerTransactionId: "ob-mock-002",
          providerAccountId: "mock-account-5121",
          date: "2025-10-04",
          label: "PRLV SEPA OVH CLOUD",
          counterparty: "OVH",
          amount: -72,
          currency: "EUR",
        },
      ],
    };
  }

  async disconnect() {}

  async verifyWebhook() {
    return true;
  }
}
