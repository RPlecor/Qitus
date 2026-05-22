import { describe, expect, it } from "vitest";
import { StructuredInvoiceParserCenter, extractEmbeddedInvoiceXml } from "../app/modules/e-invoices/structured-invoice-parser-center.server";
import { AccreditedPlatformSandboxAdapter, GenericAccreditedPlatformAdapter, MockEInvoiceProviderAdapter } from "../app/modules/e-invoices/e-invoice-provider-adapter.server";
import { EInvoiceLifecycleCenter } from "../app/modules/e-invoices/e-invoice-lifecycle-center.server";
import { AccreditedPlatformSelectionCenter } from "../app/modules/e-invoices/accredited-platform-selection-center.server";
import { EInvoiceProviderContractTestKit } from "../app/modules/e-invoices/e-invoice-provider-contract-test-kit.server";
import { QontoPaReadinessCenter } from "../app/modules/e-invoices/qonto-pa-readiness-center.server";
import { QontoAccreditedPlatformAdapter } from "../app/modules/e-invoices/providers/qonto-accredited-platform-adapter.server";

const ubl = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ID>FAC-001</cbc:ID>
  <cbc:IssueDate>2025-02-01</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Google Cloud</cbc:RegistrationName><cbc:CompanyID>123456789</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">20.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">120.00</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">120.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>`;

const cii = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:factur-x.eu:1p0:basic" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100">
  <rsm:ExchangedDocument><ram:ID>FX-001</ram:ID><ram:IssueDateTime><ram:DateTimeString>20250202</ram:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>
  <ram:SellerTradeParty><ram:Name>OVH SAS</ram:Name><ram:ID>424761419</ram:ID></ram:SellerTradeParty>
  <ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>100.00</ram:LineTotalAmount><ram:TaxTotalAmount currencyID="EUR">20.00</ram:TaxTotalAmount><ram:GrandTotalAmount>120.00</ram:GrandTotalAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>
</rsm:CrossIndustryInvoice>`;

describe("StructuredInvoiceParserCenter", () => {
  it("parses UBL invoices into a canonical payload", () => {
    const result = new StructuredInvoiceParserCenter().parse({ filename: "invoice.xml", mimeType: "application/xml", bytes: Buffer.from(ubl) });
    expect(result.structured).toBe(true);
    if (!result.structured) return;
    expect(result.payload.format).toBe("UBL");
    expect(result.payload.invoiceNumber).toBe("FAC-001");
    expect(result.payload.supplierName).toBe("Google Cloud");
    expect(result.payload.amountTtc).toBe(120);
  });

  it("parses CII / Factur-X XML and embedded PDF text", () => {
    const embedded = extractEmbeddedInvoiceXml(Buffer.from(`%PDF-1.7\n${cii}\n%%EOF`, "latin1"));
    expect(embedded).toContain("CrossIndustryInvoice");
    const result = new StructuredInvoiceParserCenter().parse({ filename: "factur-x.pdf", mimeType: "application/pdf", bytes: Buffer.from(`%PDF-1.7\n${cii}\n%%EOF`, "latin1") });
    expect(result.structured).toBe(true);
    if (!result.structured) return;
    expect(result.payload.format).toBe("FACTUR_X");
    expect(result.payload.invoiceNumber).toBe("FX-001");
    expect(result.payload.amountVat).toBe(20);
  });

  it("returns non-structured for ordinary files", () => {
    const result = new StructuredInvoiceParserCenter().parse({ filename: "note.txt", mimeType: "text/plain", bytes: Buffer.from("justificatif simple") });
    expect(result).toEqual({ structured: false, reason: "Aucun XML Factur-X, UBL ou CII détecté." });
  });
});

describe("EInvoiceProviderAdapter", () => {
  it("exposes a mock PA-like provider without claiming legal compliance", async () => {
    const status = await new MockEInvoiceProviderAdapter().getStatus();
    expect(status.configured).toBe(true);
    expect(status.receptionCompliant).toBe(false);
    expect(status.capabilities).toContain("incoming_invoices");
    const invoice = await new MockEInvoiceProviderAdapter().downloadInvoicePayload("mock-ubl-ovh-2025-001");
    expect(invoice.providerStatus).toBe("AVAILABLE");
    expect(invoice.providerProof?.provider).toBe("mock");
  });

  it("keeps the generic PA adapter safe until a concrete PA is implemented", async () => {
    const adapter = new GenericAccreditedPlatformAdapter({
      appEnv: "local",
      eInvoiceProvider: "generic_pa",
      eInvoiceProviderBaseUrl: "https://pa.example.test",
      eInvoiceProviderClientId: "client",
      eInvoiceProviderClientSecret: "secret",
      eInvoiceProviderWebhookSecret: "webhook",
    } as never);
    const status = await adapter.getStatus();
    expect(status.configured).toBe(true);
    expect(status.receptionCompliant).toBe(false);
    await expect(adapter.listIncomingInvoices()).rejects.toThrow(/Adapter PA concret/);
  });

  it("runs the stricter sandbox provider contract without claiming compliance", async () => {
    const adapter = new AccreditedPlatformSandboxAdapter();
    const status = await adapter.getStatus();
    expect(status.mode).toBe("sandbox");
    expect(status.receptionCompliant).toBe(false);
    const invoices = await adapter.listIncomingInvoices();
    expect(invoices.some((invoice) => invoice.providerStatus === "REJECTED")).toBe(true);
    expect(invoices.some((invoice) => invoice.providerStatus === "CANCELLED")).toBe(true);
    const report = await new EInvoiceProviderContractTestKit(adapter).runContractTest();
    expect(report.status).toBe("passed");
  });

  it("classifies PA selection state for sandbox and generic modes", async () => {
    const sandbox = await new AccreditedPlatformSelectionCenter({ eInvoiceProvider: "sandbox", eInvoiceProviderWebhookSecret: "secret" } as never).getSelection();
    expect(sandbox.status).toBe("sandbox_ready");
    expect(sandbox.checklist.some((item) => item.code === "Formats structurés" && item.status === "ready")).toBe(true);

    const generic = await new AccreditedPlatformSelectionCenter({ eInvoiceProvider: "generic_pa" } as never).getSelection();
    expect(generic.status).toBe("evaluating");
  });

  it("keeps Qonto PA guarded until partner sandbox and contract are validated", async () => {
    const adapter = new QontoAccreditedPlatformAdapter({ appEnv: "local", eInvoiceProvider: "qonto_pa" } as never);
    const status = await adapter.getStatus();
    expect(status.provider).toBe("qonto_pa");
    expect(status.receptionCompliant).toBe(false);
    expect(status.missingConfig).toContain("QONTO_PA_BASE_URL");
    await expect(adapter.createConnection()).rejects.toThrow(/Configuration Qonto PA incomplète/);

    const configured = new QontoAccreditedPlatformAdapter({
      appEnv: "local",
      eInvoiceProvider: "qonto_pa",
      qontoPaBaseUrl: "https://sandbox.qonto-pa.example.test",
      qontoPaClientId: "client",
      qontoPaClientSecret: "secret",
      qontoPaWebhookSecret: "webhook",
    } as never);
    await expect(configured.listIncomingInvoices()).rejects.toThrow(/documentation API PA\/sandbox Qonto/);
  });

  it("exposes Qonto PA readiness and prioritizes it in PA selection", async () => {
    const readiness = await new QontoPaReadinessCenter({ appEnv: "local", eInvoiceProvider: "qonto_pa" } as never).getReadiness();
    expect(readiness.status).toBe("blocked");
    expect(readiness.receptionCompliant).toBe(false);
    expect(readiness.checks.some((check) => check.code === "contract")).toBe(true);

    const selection = await new AccreditedPlatformSelectionCenter({ appEnv: "local", eInvoiceProvider: "qonto_pa" } as never).getSelection();
    expect(selection.candidates[0]?.key).toBe("qonto_pa");
    expect(selection.qontoPaReadiness.status).toBe("blocked");
    expect(selection.status).toBe("blocked");
  });

  it("translates provider statuses into Qitus lifecycle states", () => {
    const lifecycle = new EInvoiceLifecycleCenter();
    expect(lifecycle.toQitusStatus("MATCHED", "PARSED")).toBe("MATCHED");
    expect(lifecycle.toQitusStatus("REJECTED", "PARSED")).toBe("NEEDS_REVIEW");
    expect(lifecycle.toQitusStatus("AVAILABLE", "ACCOUNTED")).toBe("ACCOUNTED");
  });
});
