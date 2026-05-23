import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { EInvoiceReferencePayload } from "./official-reference-data.server";

export class EInvoiceReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  getActiveReference() {
    return this.references.getActiveReference<EInvoiceReferencePayload>("e_invoice");
  }

  assertReady() {
    this.references.assertReferenceReady("process_e_invoice");
  }

  listFormats() {
    return [...this.getActiveReference().payloadJson.formats];
  }

  isSupportedFormat(format: string | null | undefined) {
    return Boolean(format && this.getActiveReference().payloadJson.formats.some((item) => item.key === format));
  }

  getRequiredFields() {
    return [...this.getActiveReference().payloadJson.requiredFields];
  }
}
