import { describe, expect, it } from "vitest";
import { BankFeedNormalizer } from "../app/modules/open-banking/bank-feed-normalizer.server";
import { createOpenBankingProviderAdapter, MockOpenBankingAdapter } from "../app/modules/open-banking/open-banking-provider-adapter.server";
import { getRuntimeConfig } from "../app/modules/runtime-config.server";

describe("Open Banking Phase 16 Modules", () => {
  it("normalizes provider movements into an import-compatible CSV", () => {
    const normalizer = new BankFeedNormalizer();
    const transactions = normalizer.normalizeTransactions([{
      providerTransactionId: "tx_1",
      providerAccountId: "acc_1",
      date: "2025-10-02",
      label: "VIR CLIENT",
      counterparty: "Client",
      amount: 1200,
      currency: "EUR",
    }]);

    expect(transactions).toEqual([expect.objectContaining({ sourceId: "tx_1", amount: 1200, providerAccountId: "acc_1" })]);
    expect(normalizer.toQontoCsv(transactions)).toContain("ID de l'opération");
    expect(normalizer.toQontoCsv(transactions)).toContain("open-banking:acc_1:tx_1");
  });

  it("uses mock provider without exposing secrets", async () => {
    const payload = await new MockOpenBankingAdapter().sync({ providerConnectionId: "mock-connection" });
    expect(payload.accounts[0].ibanMasked).toContain("****");
    expect(JSON.stringify(payload)).not.toContain("secret");
  });

  it("keeps disabled provider behind an explicit Adapter error", () => {
    expect(() => createOpenBankingProviderAdapter(getRuntimeConfig({
      DATABASE_URL: "postgresql://localhost:5432/paperasse",
      OPEN_BANKING_PROVIDER: "disabled",
    }))).toThrow("Open Banking désactivé");
  });
});
