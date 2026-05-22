import { createHash } from "node:crypto";
import { ExpectedRouteError } from "../route-errors.server";
import type { StructuredInvoiceAdapter, StructuredInvoiceParseResult } from "./structured-invoice-types.server";
import { textIncludesXml } from "./structured-invoice-types.server";
import { CiiInvoiceParserAdapter } from "./cii-invoice-parser-adapter.server";
import { FacturXParserAdapter } from "./factur-x-parser-adapter.server";
import { UblInvoiceParserAdapter } from "./ubl-invoice-parser-adapter.server";

export type StructuredInvoiceParseInput = {
  filename: string;
  mimeType: string;
  bytes: Buffer;
};

export class StructuredInvoiceParserCenter {
  constructor(
    private readonly adapters: StructuredInvoiceAdapter[] = [
      new FacturXParserAdapter(),
      new UblInvoiceParserAdapter(),
      new CiiInvoiceParserAdapter(),
    ]
  ) {}

  parse(input: StructuredInvoiceParseInput): StructuredInvoiceParseResult {
    const candidates = this.candidateTexts(input);
    for (const content of candidates) {
      for (const adapter of this.adapters) {
        if (!adapter.canParse(content)) continue;
        try {
          return { structured: true, payload: adapter.parse(content) };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Facture électronique illisible.";
          throw new ExpectedRouteError(message, 422);
        }
      }
    }
    return { structured: false, reason: "Aucun XML Factur-X, UBL ou CII détecté." };
  }

  checksum(rawXml: string) {
    return createHash("sha256").update(rawXml).digest("hex");
  }

  private candidateTexts(input: StructuredInvoiceParseInput) {
    const text = input.bytes.toString("utf8");
    const candidates = [text];
    if (input.mimeType === "application/pdf" || input.filename.toLowerCase().endsWith(".pdf")) {
      const extracted = extractEmbeddedInvoiceXml(input.bytes);
      if (extracted) candidates.unshift(extracted);
    }
    return candidates.filter((candidate) => textIncludesXml(candidate));
  }
}

export function extractEmbeddedInvoiceXml(bytes: Buffer) {
  const content = bytes.toString("latin1");
  const patterns = [
    /<\?xml[\s\S]*?<\/(?:[\w.-]+:)?CrossIndustryInvoice>/i,
    /<(?:[\w.-]+:)?CrossIndustryInvoice[\s\S]*?<\/(?:[\w.-]+:)?CrossIndustryInvoice>/i,
    /<\?xml[\s\S]*?<\/(?:[\w.-]+:)?Invoice>/i,
    /<(?:[\w.-]+:)?Invoice[\s\S]*?<\/(?:[\w.-]+:)?Invoice>/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(content);
    if (match?.[0]) return match[0];
  }
  return null;
}
