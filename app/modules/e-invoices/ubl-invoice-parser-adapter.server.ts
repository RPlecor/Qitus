import type { StructuredInvoiceAdapter, StructuredInvoicePayload } from "./structured-invoice-types.server";
import { allScopes, amountOrNull, dateOrNull, firstText, scopedText } from "./structured-invoice-types.server";

export class UblInvoiceParserAdapter implements StructuredInvoiceAdapter {
  readonly format = "UBL" as const;

  canParse(content: string) {
    return /<(?:[\w.-]+:)?Invoice[\s>]/i.test(content) && /AccountingSupplierParty|LegalMonetaryTotal|InvoiceLine/i.test(content);
  }

  parse(xml: string): StructuredInvoicePayload {
    const supplierScope = firstTextScope(xml, "AccountingSupplierParty");
    const buyerScope = firstTextScope(xml, "AccountingCustomerParty");
    const monetaryScope = firstTextScope(xml, "LegalMonetaryTotal");
    const taxScope = firstTextScope(xml, "TaxTotal");
    const amountHt = amountOrNull(firstText(monetaryScope ?? xml, ["TaxExclusiveAmount", "LineExtensionAmount"]));
    const amountTtc = amountOrNull(firstText(monetaryScope ?? xml, ["TaxInclusiveAmount", "PayableAmount"]));
    const amountVat = amountOrNull(firstText(taxScope ?? xml, ["TaxAmount"]));

    return {
      format: this.format,
      rawXml: xml,
      supplierName: firstText(supplierScope ?? "", ["RegistrationName", "Name"]),
      supplierSiret: firstText(supplierScope ?? "", ["CompanyID", "EndpointID"]),
      buyerName: firstText(buyerScope ?? "", ["RegistrationName", "Name"]),
      buyerSiret: firstText(buyerScope ?? "", ["CompanyID", "EndpointID"]),
      invoiceNumber: firstText(xml, ["ID"]),
      issueDate: dateOrNull(firstText(xml, ["IssueDate"])),
      dueDate: dateOrNull(firstText(xml, ["DueDate"])),
      currency: firstText(xml, ["DocumentCurrencyCode"]) ?? currencyFromAmountTag(xml) ?? "EUR",
      amountHt,
      amountVat,
      amountTtc: amountTtc ?? sumAmounts(amountHt, amountVat),
      vatBreakdown: allScopes(xml, "TaxSubtotal").map((scope) => ({
        taxableAmount: amountOrNull(firstText(scope, ["TaxableAmount"])) ?? 0,
        taxAmount: amountOrNull(firstText(scope, ["TaxAmount"])) ?? 0,
        rate: amountOrNull(firstText(scope, ["Percent"])),
      })),
      lines: allScopes(xml, "InvoiceLine").map((scope) => ({
        label: firstText(scope, ["Name", "Description"]),
        quantity: amountOrNull(firstText(scope, ["InvoicedQuantity"])),
        unitPrice: amountOrNull(scopedText(scope, ["Price"], ["PriceAmount"])),
        amountHt: amountOrNull(firstText(scope, ["LineExtensionAmount"])),
      })),
    };
  }
}

function firstTextScope(xml: string, scopeName: string) {
  const regex = new RegExp(`<(?:[\\w.-]+:)?${scopeName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${scopeName}>`, "i");
  return regex.exec(xml)?.[1] ?? null;
}

function currencyFromAmountTag(xml: string) {
  return /currencyID=["']([A-Z]{3})["']/i.exec(xml)?.[1] ?? null;
}

function sumAmounts(left: number | null, right: number | null) {
  if (left == null || right == null) return null;
  return Number((left + right).toFixed(2));
}
