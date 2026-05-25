import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { EInvoiceReferencePayload } from "./official-reference-data.server";

export class EInvoiceReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  async getActiveReference() {
    return this.references.getActiveReferenceAsync<EInvoiceReferencePayload>("e_invoice");
  }

  async assertReady() {
    await this.references.assertReferenceReadyAsync("process_e_invoice");
  }

  async listFormats() {
    return [...(await this.getActiveReference()).payloadJson.formats];
  }

  async isSupportedFormat(format: string | null | undefined) {
    return Boolean(format && (await this.getActiveReference()).payloadJson.formats.some((item) => item.key === format));
  }

  async getRequiredFields() {
    return [...(await this.getActiveReference()).payloadJson.requiredFields];
  }
}
