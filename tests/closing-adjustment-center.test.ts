import { EntrySource } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  ccaProposal,
  corporateTaxProposal,
  depreciationProposal,
  recalculateDraft,
  type ClosingAccountRoles,
  type ClosingAdjustmentLine,
  type ClosingAdjustmentSummary,
} from "../app/modules/closing-adjustments/closing-adjustment-center.server";
import type { AccountingIssueSummary } from "../app/modules/accounting-issues/accounting-issue-tracker.server";
import { FixedAssetReferenceCenter } from "../app/modules/official-references/fixed-asset-reference-center.server";

const roles: ClosingAccountRoles = {
  prepaidExpense: { account: "486", label: "Charges constatées d'avance" },
  corporateTaxExpense: { account: "695", label: "Impôts sur les bénéfices" },
  corporateTaxPayable: { account: "444", label: "État - impôts sur les bénéfices" },
  fixedAssetExpense: { account: "68112", label: "Dotations aux amortissements corporels" },
  fixedAssetAmortization: { account: "2818", label: "Amortissements du matériel de bureau" },
};

describe("ClosingAdjustmentCenter", () => {
  it("proposes balanced CCA entries for AXA and Canva", () => {
    const [axa] = ccaProposal(issue({
      issueKey: "ANNUAL_CHARGE_CCA:transaction:axa",
      label: "ASSURANCE RC PRO ANNUELLE",
      amount: "-540",
      account: "6161",
    }), roles);
    const [canva] = ccaProposal(issue({
      issueKey: "ANNUAL_CHARGE_CCA:transaction:canva",
      label: "CANVA PRO ANNUAL",
      amount: "-35.9",
      account: "6135",
    }), roles);

    expect(axa).toMatchObject({ kind: "CCA", proposalKey: "CCA:ANNUAL_CHARGE_CCA:transaction:axa" });
    expect(axa.lines).toEqual([
      { account: "486", accountLabel: "Charges constatées d'avance", debit: 40.27, credit: 0 },
      { account: "6161", debit: 0, credit: 40.27 },
    ]);
    expect(canva.lines[0].debit).toBe(1.57);
    expectBalanced(axa.lines);
    expectBalanced(canva.lines);
  });

  it("proposes a balanced MacBook depreciation entry", async () => {
    const fixedAssetReference = await new FixedAssetReferenceCenter().getDefaultFamily();
    const [proposal] = depreciationProposal(issue({
      issueKey: "FIXED_ASSET_CANDIDATE:transaction:macbook",
      label: "MACBOOK PRO 14 M3",
      amount: "-1899",
      account: "2183",
      date: "2025-02-10",
    }), new Date("2025-12-31"), roles);

    expect(proposal).toMatchObject({ kind: "DEPRECIATION" });
    expect(proposal.lines).toEqual([
      { account: fixedAssetReference.expenseAccount, accountLabel: "Dotations aux amortissements corporels", debit: 563.89, credit: 0 },
      { account: fixedAssetReference.amortizationAccount, accountLabel: "Amortissements du matériel de bureau", debit: 0, credit: 563.89 },
    ]);
    expectBalanced(proposal.lines);
  });

  it("proposes corporate tax from positive result before tax", () => {
    const [proposal] = corporateTaxProposal("fy_2025", 22150, roles);

    expect(proposal).toMatchObject({ kind: "CORPORATE_TAX", issueKey: "CORPORATE_TAX:fiscal-year:fy_2025" });
    expect(proposal.lines).toEqual([
      { account: "695", accountLabel: "Impôts sur les bénéfices", debit: 3322.5, credit: 0 },
      { account: "444", accountLabel: "État - impôts sur les bénéfices", debit: 0, credit: 3322.5 },
    ]);
    expectBalanced(proposal.lines);
  });

  it("recalculates CCA after an assumption change", () => {
    const [draft] = ccaProposal(issue({
      issueKey: "ANNUAL_CHARGE_CCA:transaction:axa",
      label: "ASSURANCE RC PRO ANNUELLE",
      amount: "-540",
      account: "6161",
    }), roles);
    const recalculated = recalculateDraft(summary({
      ...draft,
      assumptions: { ...draft.assumptions, nextExerciseAmount: 55.25, period: "2026-01-01/2026-02-10" },
    }), new Date("2025-12-31"), 0, roles);

    expect(recalculated.calculation).toMatchObject({ nextExerciseAmount: 55.25, period: "2026-01-01/2026-02-10" });
    expect(recalculated.lines).toEqual([
      { account: "486", accountLabel: "Charges constatées d'avance", debit: 55.25, credit: 0 },
      { account: "6161", debit: 0, credit: 55.25 },
    ]);
    expectBalanced(recalculated.lines);
  });

  it("recalculates depreciation after a useful-life change", () => {
    const [draft] = depreciationProposal(issue({
      issueKey: "FIXED_ASSET_CANDIDATE:transaction:macbook",
      label: "MACBOOK PRO 14 M3",
      amount: "-1899",
      account: "2183",
      date: "2025-02-10",
    }), new Date("2025-12-31"), roles);
    const recalculated = recalculateDraft(summary({
      ...draft,
      assumptions: { ...draft.assumptions, usefulLifeYears: 5 },
    }), new Date("2025-12-31"), 0, roles);

    expect(recalculated.calculation.depreciationAmount).toBe(338.18);
    expectBalanced(recalculated.lines);
  });

  it("recalculates corporate tax from the current result before tax", () => {
    const [draft] = corporateTaxProposal("fy_2025", 22150, roles);
    const recalculated = recalculateDraft(summary(draft), new Date("2025-12-31"), 20000, roles);

    expect(recalculated.calculation).toMatchObject({ resultBeforeTax: 20000, tax: 3000 });
    expect(recalculated.assumptions).toMatchObject({ resultBeforeTax: 20000 });
    expectBalanced(recalculated.lines);
  });

  it("extends journal entry sources for validated closing adjustments", () => {
    expect(EntrySource.CLOSING_ADJUSTMENT).toBe("CLOSING_ADJUSTMENT");
  });
});

function summary(
  input: Omit<ClosingAdjustmentSummary, "id" | "status" | "note" | "journalEntryId" | "calculationVersion" | "lastCalculatedAt" | "staleReason" | "approvedAt" | "rejectedAt" | "assumptions"> & {
    assumptions?: Record<string, unknown>;
  }
): ClosingAdjustmentSummary {
  return {
    id: "proposal_1",
    status: "DRAFT",
    note: null,
    journalEntryId: null,
    calculationVersion: 1,
    lastCalculatedAt: null,
    staleReason: null,
    approvedAt: null,
    rejectedAt: null,
    ...input,
    assumptions: input.assumptions ?? {},
  };
}

function issue(input: { issueKey: string; label: string; amount: string; account: string; date?: string }): AccountingIssueSummary {
  return {
    issueKey: input.issueKey,
    controlCode: input.issueKey.split(":")[0],
    controlTitle: "Contrôle",
    controlDetail: "Détail",
    severity: "warning",
    category: "pre_closing",
    status: "OPEN",
    note: null,
    evidence: {
      issueKey: input.issueKey,
      entityType: "transaction",
      entityId: input.issueKey.split(":").at(-1),
      label: input.label,
      amount: input.amount,
      account: input.account,
      date: input.date,
    },
    action: { label: "Traiter", href: "/controle" },
  };
}

function expectBalanced(lines: ClosingAdjustmentLine[]) {
  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  expect(debit).toBeCloseTo(credit, 2);
}
