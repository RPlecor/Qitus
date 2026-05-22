import { createHmac } from "node:crypto";
import { ExpectedRouteError } from "../route-errors.server";

export type EInvoiceProviderInvoice = {
  sourceId: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
};

export type EInvoiceProviderAdapter = {
  getStatus(): Promise<{ provider: string; configured: boolean; safeMessage: string }>;
  createConnection(): Promise<{ redirectUrl: string | null; providerConnectionId: string; safeLabel: string }>;
  completeCallback(request: Request): Promise<{ providerConnectionId: string; status: "ACTIVE" | "ERROR"; safeLabel?: string }>;
  listIncomingInvoices(): Promise<EInvoiceProviderInvoice[]>;
  downloadInvoicePayload(providerInvoiceId: string): Promise<EInvoiceProviderInvoice>;
  disconnect(providerConnectionId: string): Promise<void>;
  verifyWebhook(request: Request, rawBody: string): Promise<boolean>;
};

export class MockEInvoiceProviderAdapter implements EInvoiceProviderAdapter {
  async getStatus() {
    return { provider: "mock", configured: true, safeMessage: "Provider facture électronique mock prêt." };
  }

  async createConnection() {
    return { redirectUrl: null, providerConnectionId: "mock-e-invoice-provider", safeLabel: "PA mock Qitus" };
  }

  async completeCallback() {
    return { providerConnectionId: "mock-e-invoice-provider", status: "ACTIVE" as const, safeLabel: "PA mock Qitus" };
  }

  async listIncomingInvoices() {
    return [mockInvoice()];
  }

  async downloadInvoicePayload(providerInvoiceId: string) {
    if (providerInvoiceId !== "mock-ubl-ovh-2025-001") throw new ExpectedRouteError("Facture provider mock introuvable.", 404);
    return mockInvoice();
  }

  async disconnect() {}

  async verifyWebhook(request: Request, rawBody: string) {
    const secret = process.env.E_INVOICE_PROVIDER_WEBHOOK_SECRET;
    if (!secret) return true;
    const signature = request.headers.get("x-qitus-signature");
    if (!signature) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return signature === expected;
  }
}

export class DisabledEInvoiceProviderAdapter implements EInvoiceProviderAdapter {
  async getStatus() {
    return { provider: "disabled", configured: false, safeMessage: "Réception automatique des factures électroniques désactivée." };
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
  async disconnect() {}
  async verifyWebhook() {
    return false;
  }
}

export function createEInvoiceProviderAdapter(): EInvoiceProviderAdapter {
  const provider = (process.env.E_INVOICE_PROVIDER ?? "mock").toLowerCase();
  if (provider === "mock") return new MockEInvoiceProviderAdapter();
  if (provider === "disabled") return new DisabledEInvoiceProviderAdapter();
  throw new ExpectedRouteError(`Provider facture électronique ${provider} non branché.`, 501);
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
  };
}
