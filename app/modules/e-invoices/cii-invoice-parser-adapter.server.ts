import type { StructuredInvoiceAdapter, StructuredInvoicePayload } from "./structured-invoice-types.server";
import { allScopes, amountOrNull, dateOrNull, firstScope, firstText, scopedText } from "./structured-invoice-types.server";

export class CiiInvoiceParserAdapter implements StructuredInvoiceAdapter {
  readonly format = "CII" as const;

  canParse(content: string) {
    return /CrossIndustryInvoice|SupplyChainTradeTransaction|ExchangedDocument/i.test(content);
  }

  parse(xml: string): StructuredInvoicePayload {
    const sellerScope = firstScope(xml, ["SellerTradeParty"]);
    const buyerScope = firstScope(xml, ["BuyerTradeParty"]);
    const settlementScope = firstScope(xml, ["ApplicableHeaderTradeSettlement"]);
    const monetaryScope = firstScope(xml, ["SpecifiedTradeSettlementHeaderMonetarySummation"]);
    const amountHt = amountOrNull(firstText(monetaryScope ?? xml, ["LineTotalAmount", "TaxBasisTotalAmount"]));
    const amountVat = amountOrNull(firstText(monetaryScope ?? settlementScope ?? xml, ["TaxTotalAmount"]));
    const amountTtc = amountOrNull(firstText(monetaryScope ?? xml, ["GrandTotalAmount", "DuePayableAmount"]));

    return {
      format: this.format,
      rawXml: xml,
      supplierName: firstText(sellerScope ?? "", ["Name"]),
      supplierSiret: firstText(sellerScope ?? "", ["ID", "GlobalID"]),
      buyerName: firstText(buyerScope ?? "", ["Name"]),
      buyerSiret: firstText(buyerScope ?? "", ["ID", "GlobalID"]),
      invoiceNumber: scopedText(xml, ["ExchangedDocument"], ["ID"]) ?? firstText(xml, ["ID"]),
      issueDate: dateOrNull(scopedText(xml, ["IssueDateTime"], ["DateTimeString"])),
      dueDate: dateOrNull(scopedText(xml, ["SpecifiedTradePaymentTerms"], ["DateTimeString"])),
      currency: firstText(settlementScope ?? xml, ["InvoiceCurrencyCode"]) ?? currencyFromAmountTag(xml) ?? "EUR",
      amountHt,
      amountVat,
      amountTtc: amountTtc ?? sumAmounts(amountHt, amountVat),
      vatBreakdown: allScopes(xml, "ApplicableTradeTax").map((scope) => ({
        taxableAmount: amountOrNull(firstText(scope, ["BasisAmount"])) ?? 0,
        taxAmount: amountOrNull(firstText(scope, ["CalculatedAmount"])) ?? 0,
        rate: amountOrNull(firstText(scope, ["RateApplicablePercent"])),
      })),
      lines: allScopes(xml, "IncludedSupplyChainTradeLineItem").map((scope) => ({
        label: scopedText(scope, ["SpecifiedTradeProduct"], ["Name"]),
        quantity: amountOrNull(firstText(scope, ["BilledQuantity"])),
        unitPrice: scopedText(scope, ["NetPriceProductTradePrice"], ["ChargeAmount"]) ? amountOrNull(scopedText(scope, ["NetPriceProductTradePrice"], ["ChargeAmount"])) : null,
        amountHt: scopedText(scope, ["SpecifiedTradeSettlementLineMonetarySummation"], ["LineTotalAmount"]) ? amountOrNull(scopedText(scope, ["SpecifiedTradeSettlementLineMonetarySummation"], ["LineTotalAmount"])) : null,
      })),
    };
  }
}

function currencyFromAmountTag(xml: string) {
  return /currencyID=["']([A-Z]{3})["']/i.exec(xml)?.[1] ?? null;
}

function sumAmounts(left: number | null, right: number | null) {
  if (left == null || right == null) return null;
  return Number((left + right).toFixed(2));
}
