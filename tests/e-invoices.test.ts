import { describe, expect, it } from "vitest";
import { StructuredInvoiceParserCenter, extractEmbeddedInvoiceXml } from "../app/modules/e-invoices/structured-invoice-parser-center.server";
import { GenericAccreditedPlatformAdapter, MockEInvoiceProviderAdapter } from "../app/modules/e-invoices/e-invoice-provider-adapter.server";
import { EInvoiceLifecycleCenter } from "../app/modules/e-invoices/e-invoice-lifecycle-center.server";

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

  it("translates provider statuses into Qitus lifecycle states", () => {
    const lifecycle = new EInvoiceLifecycleCenter();
    expect(lifecycle.toQitusStatus("MATCHED", "PARSED")).toBe("MATCHED");
    expect(lifecycle.toQitusStatus("REJECTED", "PARSED")).toBe("NEEDS_REVIEW");
    expect(lifecycle.toQitusStatus("AVAILABLE", "ACCOUNTED")).toBe("ACCOUNTED");
  });
});
