import { describe, expect, it } from "vitest";
import {
  buildGeneralClosingDraft,
  recalculateGeneralClosingDraft,
  type ClosingWorkpaperInput,
} from "../app/modules/closing-workpapers/general-closing-calculators.server";

describe("general closing calculators", () => {
  it.each([
    ["FNP", "615", "4081"],
    ["FAE", "4181", "706"],
    ["PCA", "706", "487"],
    ["PROVISION", "6815", "151"],
    ["LOAN_INTEREST_ACCRUAL", "6611", "1688"],
    ["PAYROLL_ACCRUAL", "641", "428"],
  ])("builds a balanced %s draft", (kind, debitAccount, creditAccount) => {
    const draft = buildGeneralClosingDraft(workpaper({ kind, amount: 123.45, debitAccount, creditAccount }));

    expect(draft).toMatchObject({ kind, lines: [{ account: debitAccount }, { account: creditAccount }] });
    expectBalanced(draft!.lines);
  });

  it("calculates stock variation from initial and final stock", () => {
    const draft = buildGeneralClosingDraft(workpaper({
      kind: "STOCK_VARIATION",
      amount: 0,
      debitAccount: "37",
      creditAccount: "6037",
      extra: { initialStock: 800, finalStock: 2000 },
    }));

    expect(draft?.calculation).toMatchObject({ variation: 1200 });
    expect(draft?.lines).toEqual([
      { account: "37", accountLabel: "Stocks", debit: 1200, credit: 0 },
      { account: "6037", accountLabel: "Variation des stocks", debit: 0, credit: 1200 },
    ]);
  });

  it("calculates loan interest prorata temporis", () => {
    const draft = buildGeneralClosingDraft(workpaper({
      kind: "LOAN_INTEREST_ACCRUAL",
      amount: 0,
      debitAccount: "6611",
      creditAccount: "1688",
      extra: { capital: 25000, annualRate: 0.045, days: 92 },
    }));

    expect(draft?.calculation).toMatchObject({ interestAccrual: 283.56 });
    expectBalanced(draft!.lines);
  });

  it("recalculates a generic workpaper proposal after assumption changes", () => {
    const next = recalculateGeneralClosingDraft({
      kind: "FNP",
      label: "FNP serveur",
      issueKey: "CLOSING_WORKPAPER:FNP:fnp-serveur",
      proposalKey: "CLOSING_WORKPAPER:FNP:fnp-serveur",
      assumptions: { amount: 250, debitAccount: "615", creditAccount: "4081", basis: "Facture à recevoir" },
      calculation: { source: "closing-workpaper", amount: 100 },
      lines: [],
    });

    expect(next.calculation).toMatchObject({ amount: 250 });
    expect(next.lines).toEqual([
      { account: "615", accountLabel: "", debit: 250, credit: 0 },
      { account: "4081", accountLabel: "", debit: 0, credit: 250 },
    ]);
  });
});

function workpaper(input: { kind: string; amount: number; debitAccount: string; creditAccount: string; extra?: Record<string, unknown> }): ClosingWorkpaperInput {
  return {
    workpaperKey: `test:${input.kind}`,
    kind: input.kind,
    title: `Test ${input.kind}`,
    assumptions: {
      amount: input.amount,
      debitAccount: input.debitAccount,
      creditAccount: input.creditAccount,
      basis: "Test",
      ...input.extra,
    },
    calculation: {},
  };
}

function expectBalanced(lines: Array<{ debit: number; credit: number }>) {
  expect(lines.reduce((sum, line) => sum + line.debit, 0)).toBeCloseTo(lines.reduce((sum, line) => sum + line.credit, 0), 2);
}
