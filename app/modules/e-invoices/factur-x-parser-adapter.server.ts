import type { StructuredInvoiceAdapter, StructuredInvoicePayload } from "./structured-invoice-types.server";
import { CiiInvoiceParserAdapter } from "./cii-invoice-parser-adapter.server";

export class FacturXParserAdapter implements StructuredInvoiceAdapter {
  readonly format = "FACTUR_X" as const;
  private readonly cii = new CiiInvoiceParserAdapter();

  canParse(content: string) {
    return /CrossIndustryInvoice/i.test(content) && /Factur-X|Facturx|factur-x|urn:factur-x|urn:ferd/i.test(content);
  }

  parse(content: string): StructuredInvoicePayload {
    return { ...this.cii.parse(content), format: this.format };
  }
}
