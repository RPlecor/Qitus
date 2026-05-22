import { createHmac } from "node:crypto";
import { createEInvoiceProviderAdapter, type EInvoiceProviderAdapter } from "./e-invoice-provider-adapter.server";

export type EInvoiceProviderContractStep = {
  code: string;
  label: string;
  status: "passed" | "failed" | "skipped";
  message: string;
};

export class EInvoiceProviderContractTestKit {
  constructor(private readonly adapter: EInvoiceProviderAdapter = createEInvoiceProviderAdapter()) {}

  describeContract() {
    return {
      requiredSteps: [
        "status",
        "connect",
        "callback",
        "sync",
        "download",
        "webhook",
        "acknowledge",
        "disconnect",
      ],
      invariant: "Aucune étape du contrat provider ne crée d'écriture comptable.",
    };
  }

  async runContractTest() {
    const steps: EInvoiceProviderContractStep[] = [];
    let providerConnectionId: string | null = null;
    let providerInvoiceId: string | null = null;

    const status = await capture(steps, "status", "Lire le statut provider", () => this.adapter.getStatus(), (result) => result.configured ? "Provider configuré." : result.safeMessage);
    await capture(steps, "connect", "Créer une connexion provider", async () => {
      const connection = await this.adapter.createConnection({ companyId: "contract-test-company" });
      providerConnectionId = connection.providerConnectionId;
      return connection;
    }, (result) => `Connexion ${result.status}, mandat ${result.mandateStatus}.`);
    await capture(steps, "callback", "Traiter un callback provider", () => this.adapter.completeCallback(new Request("http://qitus.local/e-invoice/callback")), (result) => `Callback ${result.status}.`);
    await capture(steps, "sync", "Lister les factures entrantes", async () => {
      const invoices = await this.adapter.listIncomingInvoices({ providerConnectionId });
      providerInvoiceId = invoices[0]?.sourceId ?? null;
      return invoices;
    }, (result) => `${result.length} payload(s) provider.`);
    await capture(steps, "download", "Télécharger le payload source", async () => {
      if (!providerInvoiceId) throw new Error("Aucune facture provider à télécharger.");
      return this.adapter.downloadInvoicePayload(providerInvoiceId);
    }, (result) => `${result.filename} (${result.mimeType}).`);
    await capture(steps, "webhook", "Vérifier un webhook provider", async () => {
      const body = JSON.stringify({ id: "contract-test-webhook", type: "invoice.available", providerConnectionId, providerInvoiceId, status: "AVAILABLE" });
      const secret = process.env.E_INVOICE_PROVIDER_WEBHOOK_SECRET;
      const headers = new Headers({ "content-type": "application/json" });
      if (secret) headers.set("x-qitus-signature", createHmac("sha256", secret).update(body).digest("hex"));
      const valid = await this.adapter.verifyWebhook(new Request("http://qitus.local/webhooks/e-invoice-provider", { method: "POST", body, headers }), body);
      if (!valid) throw new Error("Signature webhook refusée.");
      return valid;
    }, () => "Webhook accepté.");
    await capture(steps, "acknowledge", "Acquitter un statut facture", async () => {
      if (!providerInvoiceId || !this.adapter.acknowledgeInvoiceStatus) return "skipped";
      await this.adapter.acknowledgeInvoiceStatus(providerInvoiceId, "READ");
      return "acknowledged";
    }, (result) => result === "skipped" ? "Acquittement optionnel non implémenté." : "Acquittement accepté.");
    await capture(steps, "disconnect", "Révoquer la connexion provider", async () => {
      if (!providerConnectionId) throw new Error("Aucune connexion provider à révoquer.");
      await this.adapter.disconnect(providerConnectionId);
      return true;
    }, () => "Déconnexion acceptée.");

    const failed = steps.filter((step) => step.status === "failed").length;
    const passed = steps.filter((step) => step.status === "passed").length;
    return {
      status: failed === 0 ? "passed" : "failed",
      summary: { passed, failed, total: steps.length },
      providerConfigured: status?.configured ?? false,
      steps,
    };
  }
}

async function capture<T>(
  steps: EInvoiceProviderContractStep[],
  code: string,
  label: string,
  fn: () => Promise<T>,
  message: (result: T) => string
): Promise<T | null> {
  try {
    const result = await fn();
    steps.push({ code, label, status: "passed", message: message(result) });
    return result;
  } catch (error) {
    steps.push({ code, label, status: "failed", message: error instanceof Error ? error.message : "Étape échouée." });
    return null;
  }
}
