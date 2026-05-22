import { describe, expect, it } from "vitest";
import { depreciationPreview } from "../app/modules/fixed-assets/fixed-asset-register.server";

describe("FixedAssetRegister", () => {
  it("calculates linear depreciation prorata for the fiscal year", () => {
    const preview = depreciationPreview({
      acquisitionDate: new Date("2025-02-10"),
      amount: "1899.00",
      usefulLifeYears: 3,
      expenseAccount: "68112",
      depreciationAccount: "28183",
    }, new Date("2025-12-31"));

    expect(preview).toMatchObject({
      days: 325,
      totalDays: 365,
      annualAmount: 633,
      exerciseAmount: 563.63,
      netBookValue: 1335.37,
      lines: [
        { account: "68112", debit: 563.63, credit: 0 },
        { account: "28183", debit: 0, credit: 563.63 },
      ],
    });
  });
});
