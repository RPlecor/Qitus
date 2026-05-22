import { describe, expect, it } from "vitest";
import { VatRatePolicy, parseVatOperationNature, parseVatRate, vatNatureLabel, vatRateLabel } from "../app/modules/vat/vat-rate-policy";

describe("VatRatePolicy", () => {
  it("normalizes supported rates and natures", () => {
    expect(parseVatRate("0.20")).toBe(0.2);
    expect(parseVatRate("none")).toBeNull();
    expect(parseVatOperationNature("DOMESTIC_PURCHASE")).toBe("DOMESTIC_PURCHASE");
    expect(parseVatOperationNature("unknown")).toBeNull();
    expect(vatRateLabel("0.055")).toBe("5,5 %");
    expect(vatNatureLabel("REVERSE_CHARGE")).toBe("Autoliquidation");
  });

  it("flags incompatible selections without hiding the normalized values", () => {
    const policy = new VatRatePolicy();
    expect(policy.validateSelection({ vatRate: null, vatOperationNature: "DOMESTIC_SALE" })).toMatchObject({
      vatRate: null,
      vatOperationNature: "DOMESTIC_SALE",
      errors: ["Un taux TVA est requis pour cette nature taxable."],
    });

    expect(policy.validateSelection({ vatRate: "0.20", vatOperationNature: "EXEMPT" }).warnings).toContain(
      "Une nature exonérée ou hors champ ne devrait pas porter un taux TVA positif."
    );
  });
});
