import { ExpectedRouteError } from "../../route-errors.server";
import type { EInvoiceProviderAdapter } from "../e-invoice-provider-adapter.server";

// Template for a concrete Plateforme Agreee Adapter.
// Copy this file for a real PA only after contract, sandbox and API docs are available.
export class ConcreteAccreditedPlatformAdapterTemplate implements EInvoiceProviderAdapter {
  async getStatus() {
    return {
      provider: "template",
      providerLabel: "Template PA",
      mode: "live" as const,
      configured: false,
      receptionCompliant: false,
      safeMessage: "Adapter PA template non activable.",
      missingConfig: ["E_INVOICE_PROVIDER_BASE_URL", "E_INVOICE_PROVIDER_CLIENT_ID", "E_INVOICE_PROVIDER_CLIENT_SECRET"],
      capabilities: [],
    };
  }

  async createConnection(): Promise<never> {
    throw new ExpectedRouteError("Adapter PA concret non implemente.", 501);
  }
  async completeCallback(): Promise<never> {
    throw new ExpectedRouteError("Callback PA concret non implemente.", 501);
  }
  async listIncomingInvoices(): Promise<never> {
    throw new ExpectedRouteError("Synchronisation PA concrete non implementee.", 501);
  }
  async downloadInvoicePayload(): Promise<never> {
    throw new ExpectedRouteError("Telechargement PA concret non implemente.", 501);
  }
  async disconnect() {}
  async verifyWebhook() {
    return false;
  }
}
