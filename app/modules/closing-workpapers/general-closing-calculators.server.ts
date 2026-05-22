import Decimal from "decimal.js";
import type { ClosingAdjustmentDraft, ClosingAdjustmentLine } from "../closing-adjustments/closing-adjustment-center.server";

export type ClosingWorkpaperInput = {
  workpaperKey: string;
  kind: string;
  title: string;
  assumptions: Record<string, unknown>;
  calculation: Record<string, unknown>;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
};

export type ClosingAdjustmentDraftBuildResult = ClosingAdjustmentDraft & {
  workpaperKey: string;
  requiredEvidence: boolean;
};

export type ClosingKindDefinition = {
  kind: string;
  title: string;
  description: string;
  defaultDebitAccount: string;
  defaultCreditAccount: string;
  defaultAmount: number;
  requiredEvidence: boolean;
};

export const CLOSING_KIND_DEFINITIONS: ClosingKindDefinition[] = [
  {
    kind: "FNP",
    title: "FNP",
    description: "Charge engagée sur l'exercice, facture non reçue à la clôture.",
    defaultDebitAccount: "615",
    defaultCreditAccount: "4081",
    defaultAmount: 1200,
    requiredEvidence: true,
  },
  {
    kind: "FAE",
    title: "FAE",
    description: "Prestation réalisée sur l'exercice, facture client à établir.",
    defaultDebitAccount: "4181",
    defaultCreditAccount: "706",
    defaultAmount: 2500,
    requiredEvidence: true,
  },
  {
    kind: "PCA",
    title: "PCA",
    description: "Produit encaissé d'avance et rattaché à l'exercice suivant.",
    defaultDebitAccount: "706",
    defaultCreditAccount: "487",
    defaultAmount: 800,
    requiredEvidence: true,
  },
  {
    kind: "STOCK_VARIATION",
    title: "Variation de stock",
    description: "Écart entre stock initial et stock final saisi en workpaper.",
    defaultDebitAccount: "37",
    defaultCreditAccount: "6037",
    defaultAmount: 1000,
    requiredEvidence: true,
  },
  {
    kind: "PROVISION",
    title: "Provision",
    description: "Risque probable documenté par l'utilisateur.",
    defaultDebitAccount: "6815",
    defaultCreditAccount: "151",
    defaultAmount: 1500,
    requiredEvidence: true,
  },
  {
    kind: "PROVISION_REVERSAL",
    title: "Reprise de provision",
    description: "Reprise d'une provision devenue sans objet ou ajustée.",
    defaultDebitAccount: "151",
    defaultCreditAccount: "7815",
    defaultAmount: 500,
    requiredEvidence: true,
  },
  {
    kind: "LOAN_INTEREST_ACCRUAL",
    title: "Intérêts courus d'emprunt",
    description: "Intérêts courus non échus calculés prorata temporis.",
    defaultDebitAccount: "6611",
    defaultCreditAccount: "1688",
    defaultAmount: 420,
    requiredEvidence: true,
  },
  {
    kind: "PAYROLL_ACCRUAL",
    title: "Paie à payer",
    description: "Charge de paie ou charges sociales à rattacher.",
    defaultDebitAccount: "641",
    defaultCreditAccount: "428",
    defaultAmount: 1800,
    requiredEvidence: true,
  },
  {
    kind: "VAT_SETTLEMENT",
    title: "Régularisation TVA",
    description: "TVA nette à décaisser ou crédit de TVA à constater.",
    defaultDebitAccount: "44571",
    defaultCreditAccount: "44551",
    defaultAmount: 0,
    requiredEvidence: false,
  },
  {
    kind: "RECONCILIATION_DIFFERENCE",
    title: "Écart de rapprochement",
    description: "Écart documenté issu d'un rapprochement ligne à ligne.",
    defaultDebitAccount: "658",
    defaultCreditAccount: "471",
    defaultAmount: 0,
    requiredEvidence: true,
  },
];

export class AccrualsClosingCenter {
  buildDraft(workpaper: ClosingWorkpaperInput) {
    if (!["FNP", "FAE", "PCA", "CCA"].includes(workpaper.kind)) return null;
    return buildGenericDraft(workpaper);
  }
}

export class InventoryClosingCenter {
  buildDraft(workpaper: ClosingWorkpaperInput) {
    if (workpaper.kind !== "STOCK_VARIATION") return null;
    const initialStock = money(numberValue(workpaper.assumptions.initialStock, numberValue(workpaper.calculation.initialStock, 0)));
    const finalStock = money(numberValue(workpaper.assumptions.finalStock, numberValue(workpaper.calculation.finalStock, initialStock)));
    const variation = money(finalStock - initialStock);
    const amount = Math.abs(variation);
    const stockAccount = stringValue(workpaper.assumptions.stockAccount, "37");
    const variationAccount = stringValue(workpaper.assumptions.variationAccount, "6037");
    const draftLines = variation >= 0
      ? lines(stockAccount, "Stocks", variationAccount, "Variation des stocks", amount)
      : lines(variationAccount, "Variation des stocks", stockAccount, "Stocks", amount);
    return draft(workpaper, amount, {
      source: "inventory-workpaper",
      initialStock,
      finalStock,
      variation,
    }, {
      initialStock,
      finalStock,
      stockAccount,
      variationAccount,
    }, draftLines);
  }
}

export class ProvisionClosingCenter {
  buildDraft(workpaper: ClosingWorkpaperInput) {
    if (!["PROVISION", "PROVISION_REVERSAL"].includes(workpaper.kind)) return null;
    return buildGenericDraft(workpaper);
  }
}

export class LoanClosingCenter {
  buildDraft(workpaper: ClosingWorkpaperInput) {
    if (workpaper.kind !== "LOAN_INTEREST_ACCRUAL") return null;
    const capital = numberValue(workpaper.assumptions.capital, numberValue(workpaper.calculation.capital, 0));
    const annualRate = numberValue(workpaper.assumptions.annualRate, numberValue(workpaper.calculation.annualRate, 0));
    const days = numberValue(workpaper.assumptions.days, numberValue(workpaper.calculation.days, 0));
    const amount = money(capital > 0 && annualRate > 0 && days > 0 ? new Decimal(capital).times(annualRate).times(days).div(365).toNumber() : amountFrom(workpaper));
    return draft(workpaper, amount, {
      source: "loan-workpaper",
      capital,
      annualRate,
      days,
      interestAccrual: amount,
    }, {
      capital,
      annualRate,
      days,
      debitAccount: stringValue(workpaper.assumptions.debitAccount, "6611"),
      creditAccount: stringValue(workpaper.assumptions.creditAccount, "1688"),
    });
  }
}

export class PayrollClosingCenter {
  buildDraft(workpaper: ClosingWorkpaperInput) {
    if (workpaper.kind !== "PAYROLL_ACCRUAL") return null;
    return buildGenericDraft(workpaper);
  }
}

export class TaxClosingCenter {
  buildDraft(workpaper: ClosingWorkpaperInput) {
    if (workpaper.kind !== "CORPORATE_TAX") return null;
    return buildGenericDraft(workpaper);
  }
}

export function buildGeneralClosingDraft(workpaper: ClosingWorkpaperInput): ClosingAdjustmentDraftBuildResult | null {
  const builders = [
    new AccrualsClosingCenter(),
    new InventoryClosingCenter(),
    new ProvisionClosingCenter(),
    new LoanClosingCenter(),
    new PayrollClosingCenter(),
    new TaxClosingCenter(),
  ];
  for (const builder of builders) {
    const draft = builder.buildDraft(workpaper);
    if (draft) return draft;
  }
  return buildGenericDraft(workpaper);
}

export function recalculateGeneralClosingDraft(input: {
  kind: string;
  label: string;
  issueKey: string;
  proposalKey: string;
  assumptions: Record<string, unknown>;
  calculation: Record<string, unknown>;
  lines: ClosingAdjustmentLine[];
}): Pick<ClosingAdjustmentDraft, "assumptions" | "calculation" | "lines"> {
  const workpaper = {
    workpaperKey: workpaperKeyFromProposalKey(input.proposalKey),
    kind: input.kind,
    title: input.label,
    assumptions: { ...input.assumptions },
    calculation: input.calculation,
  };
  const next = buildGeneralClosingDraft(workpaper);
  if (!next) return { assumptions: input.assumptions, calculation: input.calculation, lines: input.lines };
  return {
    assumptions: next.assumptions ?? {},
    calculation: next.calculation,
    lines: next.lines,
  };
}

export function generalAssumptionsForDraft(draft: Pick<ClosingAdjustmentDraft, "kind" | "calculation" | "lines">) {
  const definition = definitionForKind(draft.kind);
  return {
    amount: money(numberValue(draft.calculation.amount, draft.lines.reduce((sum, line) => sum + line.debit, 0) || definition.defaultAmount)),
    debitAccount: stringValue(draft.lines.find((line) => line.debit > 0)?.account, definition.defaultDebitAccount),
    creditAccount: stringValue(draft.lines.find((line) => line.credit > 0)?.account, definition.defaultCreditAccount),
    label: stringValue(draft.calculation.label, definition.title),
    basis: stringValue(draft.calculation.basis, definition.description),
    requiredEvidence: booleanValue(draft.calculation.requiredEvidence, definition.requiredEvidence),
  };
}

export function definitionForKind(kind: string) {
  return CLOSING_KIND_DEFINITIONS.find((definition) => definition.kind === kind) ?? {
    kind,
    title: kind,
    description: "OD de clôture généralisée.",
    defaultDebitAccount: "658",
    defaultCreditAccount: "471",
    defaultAmount: 0,
    requiredEvidence: true,
  };
}

function buildGenericDraft(workpaper: ClosingWorkpaperInput): ClosingAdjustmentDraftBuildResult {
  const definition = definitionForKind(workpaper.kind);
  const amount = amountFrom(workpaper);
  const debitAccount = stringValue(workpaper.assumptions.debitAccount, definition.defaultDebitAccount);
  const creditAccount = stringValue(workpaper.assumptions.creditAccount, definition.defaultCreditAccount);
  const debitLabel = stringValue(workpaper.assumptions.debitAccountLabel, undefinedString());
  const creditLabel = stringValue(workpaper.assumptions.creditAccountLabel, undefinedString());
  return draft(workpaper, amount, {
    source: "closing-workpaper",
    amount,
    basis: stringValue(workpaper.assumptions.basis, definition.description),
    label: workpaper.title,
    requiredEvidence: booleanValue(workpaper.assumptions.requiredEvidence, definition.requiredEvidence),
    sourceEntityType: workpaper.sourceEntityType ?? null,
    sourceEntityId: workpaper.sourceEntityId ?? null,
  }, {
    amount,
    debitAccount,
    creditAccount,
    basis: stringValue(workpaper.assumptions.basis, definition.description),
    requiredEvidence: booleanValue(workpaper.assumptions.requiredEvidence, definition.requiredEvidence),
  }, lines(debitAccount, debitLabel, creditAccount, creditLabel, amount));
}

function draft(
  workpaper: ClosingWorkpaperInput,
  amount: number,
  calculation: Record<string, unknown>,
  assumptions: Record<string, unknown>,
  draftLines?: ClosingAdjustmentLine[]
): ClosingAdjustmentDraftBuildResult {
  const definition = definitionForKind(workpaper.kind);
  return {
    workpaperKey: workpaper.workpaperKey,
    issueKey: `CLOSING_WORKPAPER:${workpaper.kind}:${workpaper.workpaperKey}`,
    proposalKey: `CLOSING_WORKPAPER:${workpaper.kind}:${workpaper.workpaperKey}`,
    kind: workpaper.kind as ClosingAdjustmentDraft["kind"],
    label: workpaper.title || definition.title,
    calculation: { ...calculation, amount },
    assumptions,
    lines: draftLines ?? lines(definition.defaultDebitAccount, undefined, definition.defaultCreditAccount, undefined, amount),
    requiredEvidence: booleanValue(assumptions.requiredEvidence, definition.requiredEvidence),
  };
}

function lines(debitAccount: string, debitLabel: string | undefined, creditAccount: string, creditLabel: string | undefined, amount: number): ClosingAdjustmentLine[] {
  return [
    { account: debitAccount, accountLabel: debitLabel, debit: amount, credit: 0 },
    { account: creditAccount, accountLabel: creditLabel, debit: 0, credit: amount },
  ];
}

function amountFrom(workpaper: ClosingWorkpaperInput) {
  const definition = definitionForKind(workpaper.kind);
  return money(numberValue(workpaper.assumptions.amount, numberValue(workpaper.calculation.amount, definition.defaultAmount)));
}

function workpaperKeyFromProposalKey(proposalKey: string) {
  const parts = proposalKey.split(":");
  return parts.length >= 3 ? parts.slice(2).join(":") : proposalKey;
}

function numberValue(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function stringValue(value: unknown, fallback: string | undefined): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return fallback ?? "";
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "on" || value === "1";
  return fallback;
}

function money(value: number) {
  return new Decimal(value || 0).toDecimalPlaces(2).toNumber();
}

function undefinedString() {
  return undefined as string | undefined;
}
