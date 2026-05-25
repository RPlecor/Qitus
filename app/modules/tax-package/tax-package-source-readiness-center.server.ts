import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";

export type TaxPackageSourceCompleteness = "complete" | "partial" | "missing" | "not_required";

export type TaxPackageSourceReadiness = {
  journalExportable: boolean;
  incomeStatementCompleteness: TaxPackageSourceCompleteness;
  balanceSheetCompleteness: TaxPackageSourceCompleteness;
  fixedAssetsCompleteness: TaxPackageSourceCompleteness;
  profileCompleteness: TaxPackageSourceCompleteness;
  manualDataCompleteness: TaxPackageSourceCompleteness;
};

export type TaxPackageSourceLineBalance = {
  debit: number;
  credit: number;
  count: number;
};

export class TaxPackageSourceReadinessCenter {
  summarize(
    workspace: CompanyWorkspace,
    input: {
      journalExportable: boolean;
      lineBalances: Map<string, TaxPackageSourceLineBalance>;
    }
  ): TaxPackageSourceReadiness {
    const hasIncomeStatementLines = hasAnyAccountPrefix(input.lineBalances, ["6", "7"]);
    const hasBalanceSheetLines = hasAnyAccountPrefix(input.lineBalances, ["1", "2", "3", "4", "5"]);
    const hasFixedAssetLines = hasAnyAccountPrefix(input.lineBalances, ["2", "28", "6811"]);
    return {
      journalExportable: input.journalExportable,
      incomeStatementCompleteness: input.journalExportable ? "complete" : "missing",
      balanceSheetCompleteness: isClosed(workspace) && hasBalanceSheetLines ? "complete" : hasBalanceSheetLines ? "partial" : "missing",
      fixedAssetsCompleteness: input.journalExportable && hasFixedAssetLines ? "complete" : hasFixedAssetLines ? "partial" : "missing",
      profileCompleteness: profileIsComplete(workspace) ? "complete" : "partial",
      manualDataCompleteness: "missing",
    };
  }
}

function hasAnyAccountPrefix(lineBalances: Map<string, TaxPackageSourceLineBalance>, prefixes: string[]) {
  return [...lineBalances.keys()].some((account) => prefixes.some((prefix) => account.startsWith(prefix)));
}

function isClosed(workspace: CompanyWorkspace) {
  return String(workspace.fiscalYear.status ?? "").toUpperCase() === "CLOSED";
}

function profileIsComplete(workspace: CompanyWorkspace) {
  return Boolean(workspace.company.name && workspace.company.siren && workspace.company.legalForm);
}
