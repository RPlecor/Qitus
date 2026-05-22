import { createHmac } from "node:crypto";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export type EInvoiceProviderModeLabel = "disabled" | "mock" | "sandbox" | "generic_pa" | "live";
export type EInvoiceProviderMandateStatus = "UNKNOWN" | "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKED" | "ERROR";
export type EInvoiceProviderLifecycleStatus = "RECEIVED" | "AVAILABLE" | "READ" | "MATCHED" | "ACCOUNTED" | "REJECTED" | "CANCELLED" | "ERROR";

export type EInvoiceProviderInvoice = {
  sourceId: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
  providerStatus?: EInvoiceProviderLifecycleStatus;
  providerReceivedAt?: Date;
  providerProof?: Record<string, unknown>;
  providerMetadata?: Record<string, unknown>;
};

export type EInvoiceProviderStatus = {
  provider: string;
  providerLabel: string;
  mode: EInvoiceProviderModeLabel;
  configured: boolean;
  receptionCompliant: boolean;
  safeMessage: string;
  missingConfig: string[];
  capabilities: string[];
};

export type EInvoiceProviderConnectionResult = {
  redirectUrl: string | null;
  providerConnectionId: string;
  providerCompanyId?: string | null;
  status: "PENDING" | "ACTIVE" | "ERROR";
  mandateStatus: EInvoiceProviderMandateStatus;
  safeLabel: string;
  capabilities?: string[];
  safeMetadata?: Record<string, unknown>;
};

export type EInvoiceProviderCallbackResult = {
  providerConnectionId: string;
  providerCompanyId?: string | null;
  status: "ACTIVE" | "ERROR";
  mandateStatus?: EInvoiceProviderMandateStatus;
  safeLabel?: string;
  safeMetadata?: Record<string, unknown>;
};

export type EInvoiceProviderWebhookPayload = {
  eventId?: string;
  eventType?: string;
  providerConnectionId?: string;
  providerInvoiceId?: string;
  providerStatus?: EInvoiceProviderLifecycleStatus;
  providerReceivedAt?: string;
  metadata?: Record<string, unknown>;
};

export type EInvoiceProviderAdapter = {
  getStatus(): Promise<EInvoiceProviderStatus>;
  createConnection(input?: { companyId?: string; callbackUrl?: string }): Promise<EInvoiceProviderConnectionResult>;
  completeCallback(request: Request): Promise<EInvoiceProviderCallbackResult>;
  listIncomingInvoices(input?: { providerConnectionId?: string | null }): Promise<EInvoiceProviderInvoice[]>;
  downloadInvoicePayload(providerInvoiceId: string): Promise<EInvoiceProviderInvoice>;
  acknowledgeInvoiceStatus?(providerInvoiceId: string, status: EInvoiceProviderLifecycleStatus): Promise<void>;
  disconnect(providerConnectionId: string): Promise<void>;
  verifyWebhook(request: Request, rawBody: string): Promise<boolean>;
  parseWebhook?(rawBody: string): EInvoiceProviderWebhookPayload;
};

export class MockEInvoiceProviderAdapter implements EInvoiceProviderAdapter {
  async getStatus(): Promise<EInvoiceProviderStatus> {
    return {
      provider: "mock",
      providerLabel: "PA mock Qitus",
      mode: "mock",
      configured: true,
      receptionCompliant: false,
      safeMessage: "Provider facture électronique mock prêt pour valider le parcours sandbox.",
      missingConfig: [],
      capabilities: ["incoming_invoices", "structured_payloads", "webhook_test"],
    };
  }

  async createConnection(): Promise<EInvoiceProviderConnectionResult> {
    return {
      redirectUrl: null,
      providerConnectionId: "mock-e-invoice-provider",
      providerCompanyId: "mock-company-qitus",
      status: "ACTIVE",
      mandateStatus: "ACTIVE",
      safeLabel: "PA mock Qitus",
      capabilities: ["incoming_invoices", "structured_payloads", "webhook_test"],
      safeMetadata: { environment: "sandbox", receptionCompliant: false },
    };
  }

  async completeCallback(): Promise<EInvoiceProviderCallbackResult> {
    return {
      providerConnectionId: "mock-e-invoice-provider",
      providerCompanyId: "mock-company-qitus",
      status: "ACTIVE",
      mandateStatus: "ACTIVE",
      safeLabel: "PA mock Qitus",
      safeMetadata: { environment: "sandbox" },
    };
  }

  async listIncomingInvoices() {
    return [mockInvoice()];
  }

  async downloadInvoicePayload(providerInvoiceId: string) {
    if (providerInvoiceId !== "mock-ubl-ovh-2025-001") throw new ExpectedRouteError("Facture provider mock introuvable.", 404);
    return mockInvoice();
  }

  async acknowledgeInvoiceStatus() {}

  async disconnect() {}

  async verifyWebhook(request: Request, rawBody: string) {
    return verifyConfiguredSignature(request, rawBody, getRuntimeConfig().eInvoiceProviderWebhookSecret);
  }

  parseWebhook(rawBody: string): EInvoiceProviderWebhookPayload {
    return parseProviderWebhookPayload(rawBody);
  }
}

export class AccreditedPlatformSandboxAdapter implements EInvoiceProviderAdapter {
  async getStatus(): Promise<EInvoiceProviderStatus> {
    return {
      provider: "sandbox",
      providerLabel: "Sandbox PA Qitus",
      mode: "sandbox",
      configured: true,
      receptionCompliant: false,
      safeMessage: "Sandbox PA stricte prête : elle teste les cas provider sans valoir réception PA réelle.",
      missingConfig: [],
      capabilities: ["incoming_invoices", "structured_payloads", "webhook_test", "status_acknowledgement", "edge_cases"],
    };
  }

  async createConnection(): Promise<EInvoiceProviderConnectionResult> {
    return {
      redirectUrl: null,
      providerConnectionId: "sandbox-pa-connection",
      providerCompanyId: "sandbox-pa-company",
      status: "ACTIVE",
      mandateStatus: "ACTIVE",
      safeLabel: "Sandbox PA Qitus",
      capabilities: ["incoming_invoices", "structured_payloads", "webhook_test", "status_acknowledgement", "edge_cases"],
      safeMetadata: {
        environment: "sandbox",
        receptionCompliant: false,
        cases: ["duplicate", "rejected", "cancelled", "invalid_xml", "missing_visual"],
      },
    };
  }

  async completeCallback(): Promise<EInvoiceProviderCallbackResult> {
    return {
      providerConnectionId: "sandbox-pa-connection",
      providerCompanyId: "sandbox-pa-company",
      status: "ACTIVE",
      mandateStatus: "ACTIVE",
      safeLabel: "Sandbox PA Qitus",
      safeMetadata: { environment: "sandbox" },
    };
  }

  async listIncomingInvoices() {
    return [
      sandboxInvoice("sandbox-ubl-ovh-2025-001", "SANDBOX-OVH-2025-001", "AVAILABLE"),
      sandboxInvoice("sandbox-ubl-ovh-2025-001", "SANDBOX-OVH-2025-001", "AVAILABLE", { duplicateCase: true }),
      sandboxInvoice("sandbox-rejected-2025-002", "SANDBOX-REJECTED-2025-002", "REJECTED"),
      sandboxInvoice("sandbox-cancelled-2025-003", "SANDBOX-CANCELLED-2025-003", "CANCELLED"),
      invalidSandboxInvoice(),
    ];
  }

  async downloadInvoicePayload(providerInvoiceId: string) {
    const invoice = (await this.listIncomingInvoices()).find((item) => item.sourceId === providerInvoiceId);
    if (!invoice) throw new ExpectedRouteError("Facture sandbox PA introuvable.", 404);
    return invoice;
  }

  async acknowledgeInvoiceStatus() {}

  async disconnect() {}

  async verifyWebhook(request: Request, rawBody: string) {
    return verifyConfiguredSignature(request, rawBody, getRuntimeConfig().eInvoiceProviderWebhookSecret);
  }

  parseWebhook(rawBody: string): EInvoiceProviderWebhookPayload {
    return parseProviderWebhookPayload(rawBody);
  }
}

export class DisabledEInvoiceProviderAdapter implements EInvoiceProviderAdapter {
  async getStatus(): Promise<EInvoiceProviderStatus> {
    return {
      provider: "disabled",
      providerLabel: "Désactivé",
      mode: "disabled",
      configured: false,
      receptionCompliant: false,
      safeMessage: "Réception automatique des factures électroniques désactivée.",
      missingConfig: ["E_INVOICE_PROVIDER"],
      capabilities: [],
    };
  }
  async createConnection(): Promise<never> {
    throw new ExpectedRouteError("Réception automatique des factures électroniques désactivée.", 409);
  }
  async completeCallback(): Promise<never> {
    throw new ExpectedRouteError("Provider facture électronique désactivé.", 409);
  }
  async listIncomingInvoices(): Promise<never> {
    throw new ExpectedRouteError("Provider facture électronique désactivé.", 409);
  }
  async downloadInvoicePayload(): Promise<never> {
    throw new ExpectedRouteError("Provider facture électronique désactivé.", 409);
  }
  async acknowledgeInvoiceStatus(): Promise<never> {
    throw new ExpectedRouteError("Provider facture électronique désactivé.", 409);
  }
  async disconnect() {}
  async verifyWebhook() {
    return false;
  }
}

export class GenericAccreditedPlatformAdapter implements EInvoiceProviderAdapter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  async getStatus(): Promise<EInvoiceProviderStatus> {
    const missingConfig = this.missingConfig();
    return {
      provider: this.config.eInvoiceProvider,
      providerLabel: "Plateforme Agréée générique",
      mode: "generic_pa",
      configured: missingConfig.length === 0,
      receptionCompliant: false,
      safeMessage: missingConfig.length === 0
        ? "Contrat PA générique configuré. Branche un Adapter PA concret pour activer la réception conforme."
        : `Configuration PA incomplète : ${missingConfig.join(", ")}.`,
      missingConfig,
      capabilities: ["connection_contract", "webhook_contract", "incoming_invoice_contract"],
    };
  }

  async createConnection(): Promise<never> {
    const missing = this.missingConfig();
    if (missing.length > 0) throw new ExpectedRouteError(`Configuration PA incomplète : ${missing.join(", ")}.`, 409);
    throw new ExpectedRouteError("Aucune Plateforme Agréée concrète n'est encore branchée derrière l'Adapter générique.", 501);
  }

  async completeCallback(): Promise<never> {
    throw new ExpectedRouteError("Callback PA générique non activé sans Adapter PA concret.", 501);
  }

  async listIncomingInvoices(): Promise<never> {
    throw new ExpectedRouteError("Synchronisation PA générique non activée sans Adapter PA concret.", 501);
  }

  async downloadInvoicePayload(): Promise<never> {
    throw new ExpectedRouteError("Téléchargement PA générique non activé sans Adapter PA concret.", 501);
  }

  async acknowledgeInvoiceStatus(): Promise<never> {
    throw new ExpectedRouteError("Acquittement PA générique non activé sans Adapter PA concret.", 501);
  }

  async disconnect() {}

  async verifyWebhook(request: Request, rawBody: string) {
    return verifyConfiguredSignature(request, rawBody, this.config.eInvoiceProviderWebhookSecret);
  }

  parseWebhook(rawBody: string): EInvoiceProviderWebhookPayload {
    return parseProviderWebhookPayload(rawBody);
  }

  private missingConfig() {
    const missing: string[] = [];
    if (!this.config.eInvoiceProviderBaseUrl) missing.push("E_INVOICE_PROVIDER_BASE_URL");
    if (!this.config.eInvoiceProviderClientId) missing.push("E_INVOICE_PROVIDER_CLIENT_ID");
    if (!this.config.eInvoiceProviderClientSecret) missing.push("E_INVOICE_PROVIDER_CLIENT_SECRET");
    if (!this.config.eInvoiceProviderWebhookSecret) missing.push("E_INVOICE_PROVIDER_WEBHOOK_SECRET");
    if ((this.config.appEnv === "staging" || this.config.appEnv === "production") && !this.config.providerSecretEncryptionKey) missing.push("PROVIDER_SECRET_ENCRYPTION_KEY");
    return missing;
  }
}

export function createEInvoiceProviderAdapter(config: RuntimeConfig = getRuntimeConfig()): EInvoiceProviderAdapter {
  const provider = config.eInvoiceProvider;
  if (provider === "mock") return new MockEInvoiceProviderAdapter();
  if (provider === "sandbox") return new AccreditedPlatformSandboxAdapter();
  if (provider === "disabled") return new DisabledEInvoiceProviderAdapter();
  return new GenericAccreditedPlatformAdapter(config);
}

export function parseProviderWebhookPayload(rawBody: string): EInvoiceProviderWebhookPayload {
  if (!rawBody.trim()) return {};
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      eventId: stringValue(parsed.eventId) ?? stringValue(parsed.id),
      eventType: stringValue(parsed.eventType) ?? stringValue(parsed.type),
      providerConnectionId: stringValue(parsed.providerConnectionId) ?? stringValue(parsed.connectionId) ?? nestedString(parsed.connection, "id"),
      providerInvoiceId: stringValue(parsed.providerInvoiceId) ?? stringValue(parsed.invoiceId) ?? nestedString(parsed.invoice, "id"),
      providerStatus: parseLifecycleStatus(stringValue(parsed.providerStatus) ?? stringValue(parsed.status) ?? nestedString(parsed.invoice, "status")),
      providerReceivedAt: stringValue(parsed.providerReceivedAt) ?? stringValue(parsed.receivedAt),
      metadata: safeMetadata(parsed),
    };
  } catch {
    return {};
  }
}

function mockInvoice(): EInvoiceProviderInvoice {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ID>MOCK-OVH-2025-001</cbc:ID>
  <cbc:IssueDate>2025-03-15</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>OVH SAS</cbc:RegistrationName><cbc:CompanyID>424761419</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Qitus Demo</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">20.00</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">20.00</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>20</cbc:Percent></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">120.00</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">120.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
  <cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity>1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount><cac:Item><cbc:Name>Hébergement cloud</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
</Invoice>`;
  return {
    sourceId: "mock-ubl-ovh-2025-001",
    filename: "mock-ovh-2025-001.xml",
    mimeType: "application/xml",
    bytes: Buffer.from(xml, "utf8"),
    providerStatus: "AVAILABLE",
    providerReceivedAt: new Date("2025-03-16T10:00:00.000Z"),
    providerProof: {
      provider: "mock",
      providerInvoiceId: "mock-ubl-ovh-2025-001",
      receivedAt: "2025-03-16T10:00:00.000Z",
      channel: "mock_pa",
    },
    providerMetadata: { sandbox: true },
  };
}

function sandboxInvoice(sourceId: string, invoiceNumber: string, status: EInvoiceProviderLifecycleStatus, metadata: Record<string, unknown> = {}): EInvoiceProviderInvoice {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ID>${invoiceNumber}</cbc:ID>
  <cbc:IssueDate>2025-04-15</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Sandbox Fournisseur</cbc:RegistrationName><cbc:CompanyID>12345678900011</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Qitus Sandbox</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">10.00</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">50.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">10.00</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>20</cbc:Percent></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:TaxExclusiveAmount currencyID="EUR">50.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">60.00</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">60.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>`;
  return {
    sourceId,
    filename: `${sourceId}.xml`,
    mimeType: "application/xml",
    bytes: Buffer.from(xml, "utf8"),
    providerStatus: status,
    providerReceivedAt: new Date("2025-04-16T09:00:00.000Z"),
    providerProof: {
      provider: "sandbox",
      providerInvoiceId: sourceId,
      status,
      receivedAt: "2025-04-16T09:00:00.000Z",
      channel: "qitus_sandbox_pa",
    },
    providerMetadata: { sandbox: true, missingVisual: true, ...metadata },
  };
}

function invalidSandboxInvoice(): EInvoiceProviderInvoice {
  return {
    sourceId: "sandbox-invalid-xml-2025-004",
    filename: "sandbox-invalid-xml-2025-004.xml",
    mimeType: "application/xml",
    bytes: Buffer.from("<Invoice><cbc:ID>INVALID", "utf8"),
    providerStatus: "ERROR",
    providerReceivedAt: new Date("2025-04-16T10:00:00.000Z"),
    providerProof: {
      provider: "sandbox",
      providerInvoiceId: "sandbox-invalid-xml-2025-004",
      status: "ERROR",
      receivedAt: "2025-04-16T10:00:00.000Z",
      channel: "qitus_sandbox_pa",
    },
    providerMetadata: { sandbox: true, invalidXmlCase: true },
  };
}

function verifyConfiguredSignature(request: Request, rawBody: string, secret: string | undefined) {
  if (!secret) return true;
  const signature = request.headers.get("x-qitus-signature") ?? request.headers.get("x-e-invoice-signature") ?? request.headers.get("x-pa-signature");
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return signature === expected || signature === `sha256=${expected}`;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function nestedString(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined;
  const nested = (value as Record<string, unknown>)[key];
  return typeof nested === "string" || typeof nested === "number" ? String(nested) : undefined;
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
