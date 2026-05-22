import { describe, expect, it } from "vitest";
import { parseExtractedText } from "../app/modules/evidence/attachment-extraction-center.server";

describe("AttachmentExtractionCenter", () => {
  it("parses common invoice metadata from extracted text", () => {
    const parsed = parseExtractedText([
      "OVH CLOUD",
      "Facture FAC-2025-001",
      "Date 03/01/2025",
      "HT 24,99 €",
      "TVA 5,00 €",
      "Total TTC 29,99 €",
    ].join("\n"));

    expect(parsed).toMatchObject({
      supplierName: "OVH CLOUD",
      invoiceDate: "2025-01-03",
      invoiceNumber: "FAC-2025-001",
      amountHt: "24.99",
      amountVat: "5.00",
      amountTtc: "29.99",
    });
  });
});
