import type { EInvoiceFormat } from "@prisma/client";

export type StructuredInvoiceVatBreakdown = {
  rate: number | null;
  taxableAmount: number;
  taxAmount: number;
};

export type StructuredInvoiceLine = {
  label: string | null;
  quantity: number | null;
  unitPrice: number | null;
  amountHt: number | null;
};

export type StructuredInvoicePayload = {
  format: EInvoiceFormat;
  rawXml: string;
  supplierName: string | null;
  supplierSiret: string | null;
  buyerName: string | null;
  buyerSiret: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string | null;
  amountHt: number | null;
  amountVat: number | null;
  amountTtc: number | null;
  vatBreakdown: StructuredInvoiceVatBreakdown[];
  lines: StructuredInvoiceLine[];
};

export type StructuredInvoiceParseResult =
  | { structured: true; payload: StructuredInvoicePayload }
  | { structured: false; reason: string };

export type StructuredInvoiceAdapter = {
  readonly format: EInvoiceFormat;
  canParse(content: string): boolean;
  parse(content: string): StructuredInvoicePayload;
};

export function amountOrNull(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = decodeXml(value).replace(/\s/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

export function dateOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = decodeXml(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{8}$/.test(trimmed)) return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  return null;
}

export function firstText(xml: string, tagNames: string[]): string | null {
  for (const tagName of tagNames) {
    const escaped = escapeRegExp(tagName);
    const regex = new RegExp(`<(?:[\\w.-]+:)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${escaped}>`, "i");
    const match = regex.exec(xml);
    if (match?.[1]) return stripTags(match[1]);
  }
  return null;
}

export function scopedText(xml: string, scopeNames: string[], tagNames: string[]): string | null {
  const scope = firstScope(xml, scopeNames);
  return scope ? firstText(scope, tagNames) : null;
}

export function firstScope(xml: string, scopeNames: string[]): string | null {
  for (const scopeName of scopeNames) {
    const escaped = escapeRegExp(scopeName);
    const regex = new RegExp(`<(?:[\\w.-]+:)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${escaped}>`, "i");
    const match = regex.exec(xml);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function allScopes(xml: string, scopeName: string): string[] {
  const escaped = escapeRegExp(scopeName);
  const regex = new RegExp(`<(?:[\\w.-]+:)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${escaped}>`, "gi");
  const scopes: string[] = [];
  for (const match of xml.matchAll(regex)) {
    if (match[1]) scopes.push(match[1]);
  }
  return scopes;
}

export function stripTags(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

export function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

export function textIncludesXml(content: string) {
  return /<\?xml|<[^>]*(Invoice|CrossIndustryInvoice)/i.test(content);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
