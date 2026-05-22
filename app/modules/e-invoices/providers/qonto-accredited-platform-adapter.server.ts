import { ExpectedRouteError } from "../../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../../runtime-config.server";
import type { EInvoiceProviderAdapter, EInvoiceProviderLifecycleStatus, EInvoiceProviderStatus } from "../e-invoice-provider-adapter.server";

export class QontoAccreditedPlatformAdapter implements EInvoiceProviderAdapter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  async getStatus(): Promise<EInvoiceProviderStatus> {
    const missingConfig = this.missingConfig();
    return {
      provider: "qonto_pa",
      providerLabel: "Qonto PA",
      mode: "live",
      configured: missingConfig.length === 0,
      receptionCompliant: false,
      safeMessage: missingConfig.length === 0
        ? "Qonto PA est sélectionnée, mais la réception conforme reste bloquée tant que le contrat API PA/sandbox n'est pas validé."
        : `Configuration Qonto PA incomplète : ${missingConfig.join(", ")}.`,
      missingConfig,
      capabilities: ["qonto_pa_candidate", "guarded_adapter", "provider_contract_pending"],
    };
  }

  async createConnection(): Promise<never> {
    this.assertConfigured();
    this.throwContractPending("Connexion Qonto PA");
  }

  async completeCallback(): Promise<never> {
    this.throwContractPending("Callback Qonto PA");
  }

  async listIncomingInvoices(): Promise<never> {
    this.assertConfigured();
    this.throwContractPending("Synchronisation Qonto PA");
  }

  async downloadInvoicePayload(): Promise<never> {
    this.throwContractPending("Téléchargement facture Qonto PA");
  }

  async acknowledgeInvoiceStatus(_providerInvoiceId: string, _status: EInvoiceProviderLifecycleStatus): Promise<never> {
    this.throwContractPending("Acquittement statut Qonto PA");
  }

  async disconnect(): Promise<never> {
    this.throwContractPending("Déconnexion Qonto PA");
  }

  async verifyWebhook() {
    return false;
  }

  parseWebhook(rawBody: string) {
    if (!rawBody.trim()) return {};
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      return {
        eventId: stringValue(parsed.eventId) ?? stringValue(parsed.id),
        eventType: stringValue(parsed.eventType) ?? stringValue(parsed.type),
        providerConnectionId: stringValue(parsed.providerConnectionId) ?? stringValue(parsed.connectionId),
        providerInvoiceId: stringValue(parsed.providerInvoiceId) ?? stringValue(parsed.invoiceId),
        providerStatus: parseLifecycleStatus(stringValue(parsed.providerStatus) ?? stringValue(parsed.status)),
        metadata: safeMetadata(parsed),
      };
    } catch {
      return {};
    }
  }

  private missingConfig() {
    const missing: string[] = [];
    if (!this.config.qontoPaBaseUrl) missing.push("QONTO_PA_BASE_URL");
    if (!this.config.qontoPaClientId) missing.push("QONTO_PA_CLIENT_ID");
    if (!this.config.qontoPaClientSecret) missing.push("QONTO_PA_CLIENT_SECRET");
    if (!this.config.qontoPaWebhookSecret) missing.push("QONTO_PA_WEBHOOK_SECRET");
    if ((this.config.appEnv === "staging" || this.config.appEnv === "production") && !this.config.providerSecretEncryptionKey) missing.push("PROVIDER_SECRET_ENCRYPTION_KEY");
    return missing;
  }

  private assertConfigured() {
    const missing = this.missingConfig();
    if (missing.length > 0) throw new ExpectedRouteError(`Configuration Qonto PA incomplète : ${missing.join(", ")}.`, 409);
  }

  private throwContractPending(operation: string): never {
    throw new ExpectedRouteError(
      `${operation} non activée : Qitus attend la documentation API PA/sandbox Qonto et un contract test validé avant tout appel réseau.`,
      501
    );
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseLifecycleStatus(value?: string): EInvoiceProviderLifecycleStatus | undefined {
  const normalized = value?.toUpperCase();
  const statuses = ["RECEIVED", "AVAILABLE", "READ", "MATCHED", "ACCOUNTED", "REJECTED", "CANCELLED", "ERROR"];
  return statuses.includes(normalized ?? "") ? normalized as EInvoiceProviderLifecycleStatus : undefined;
}

function safeMetadata(parsed: Record<string, unknown>) {
  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (/secret|token|password|authorization|key/i.test(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") clone[key] = value;
  }
  return clone;
}
