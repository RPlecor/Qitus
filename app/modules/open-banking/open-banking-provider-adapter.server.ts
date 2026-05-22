import { createHmac } from "node:crypto";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { BridgeOpenBankingAdapter } from "./bridge-open-banking-adapter.server";
import { GoCardlessBankAccountDataAdapter } from "./gocardless-open-banking-adapter.server";
import { MockOpenBankingAdapter } from "./mock-open-banking-adapter.server";
import { PowensOpenBankingAdapter } from "./powens-open-banking-adapter.server";
import { safeEqual } from "./open-banking-adapter-utils.server";
import type { OpenBankingProviderAdapter, ProviderSyncPayload } from "./open-banking-provider-types.server";
export type { CallbackResult, ConsentResult, OpenBankingProviderAdapter, OpenBankingProviderInfo, ProviderBankAccount, ProviderBankTransaction, ProviderSyncPayload } from "./open-banking-provider-types.server";

export class UnsupportedHttpOpenBankingProviderAdapter implements OpenBankingProviderAdapter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  getInfo() {
    return { providerLabel: this.config.openBankingProvider, selectionMode: "provider_webview" as const };
  }

  async createConsent(): Promise<never> {
    throw new ExpectedRouteError(`Open Banking ${this.config.openBankingProvider} non branché.`, 501);
  }

  async exchangeCallback(): Promise<never> {
    throw new ExpectedRouteError(`Callback Open Banking ${this.config.openBankingProvider} non branché.`, 501);
  }

  async sync(): Promise<never> {
    throw new ExpectedRouteError(`Synchronisation Open Banking ${this.config.openBankingProvider} non branchée.`, 501);
  }

  async disconnect() {
    throw new ExpectedRouteError(`Déconnexion Open Banking ${this.config.openBankingProvider} non branchée.`, 501);
  }

  async verifyWebhook(rawBody: string, signature: string | null) {
    if (!signature || !this.config.openBankingWebhookSecret) return false;
    const expected = createHmac("sha256", this.config.openBankingWebhookSecret).update(rawBody).digest("hex");
    return safeEqual(signature, expected);
  }
}

export function createOpenBankingProviderAdapter(config: RuntimeConfig = getRuntimeConfig()): OpenBankingProviderAdapter {
  if (config.openBankingProvider === "mock") return new MockOpenBankingAdapter();
  if (config.openBankingProvider === "disabled") {
    throw new ExpectedRouteError("Open Banking désactivé. Active OPEN_BANKING_PROVIDER=mock ou un provider agréé.", 409);
  }
  if (config.openBankingProvider === "gocardless") return new GoCardlessBankAccountDataAdapter(config);
  if (config.openBankingProvider === "bridge") return new BridgeOpenBankingAdapter(config);
  if (config.openBankingProvider === "powens") return new PowensOpenBankingAdapter(config);
  return new UnsupportedHttpOpenBankingProviderAdapter(config);
}

export { MockOpenBankingAdapter } from "./mock-open-banking-adapter.server";
export { GoCardlessBankAccountDataAdapter } from "./gocardless-open-banking-adapter.server";
export { BridgeOpenBankingAdapter } from "./bridge-open-banking-adapter.server";
export { PowensOpenBankingAdapter } from "./powens-open-banking-adapter.server";
