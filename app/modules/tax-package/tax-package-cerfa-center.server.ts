import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { JournalAuditCenter } from "../journal/journal-audit-center.server";
import { TaxPackageReferenceCenter, type TaxPackageKind } from "../official-references/tax-package-reference-center.server";
import { TaxPackageCaseResolutionPolicy, type TaxPackageCalculationFamily, type TaxPackageCaseResolution, type TaxPackageEmptyBehavior } from "./tax-package-case-resolution-policy.server";
import { TaxPackageSourceReadinessCenter, type TaxPackageSourceCompleteness } from "./tax-package-source-readiness-center.server";

export type TaxPackageCaseStatus = "calculée" | "à compléter" | "non applicable" | "bloquée";

export type TaxPackageCerfaCase = {
  code: string;
  label: string;
  table: string;
  type: string;
  value: string | number | null;
  status: TaxPackageCaseStatus;
  source: string;
  reason: string | null;
  accountPrefixes: string[];
  resolution: TaxPackageCaseResolution;
  isZeroByAbsence: boolean;
  sourceCompleteness: TaxPackageSourceCompleteness;
};

export type TaxPackageCerfaTable = {
  code: string;
  label: string;
  cases: TaxPackageCerfaCase[];
};

export type TaxPackageCompletenessSummary = {
  status: "complete" | "to_complete" | "blocked";
  label: string;
  totalCases: number;
  calculated: number;
  toComplete: number;
  notApplicable: number;
  blocked: number;
  zeroByAbsence: number;
  toReview: number;
};

export type TaxPackageCerfaDraft = {
  generatedAt: string;
  packageKind: TaxPackageKind;
  packageCode: string;
  label: string;
  millesime: string;
  reference: {
    version: string;
    sourceUrl: string;
  };
  company: {
    name: string;
    siren: string | null;
    legalForm: string | null;
  };
  fiscalYear: {
    startDate: string;
    endDate: string;
  };
  tables: TaxPackageCerfaTable[];
  summary: TaxPackageCompletenessSummary;
};

type TaxPackageLineReader = {
  listLineBalances(workspace: CompanyWorkspace): Promise<Map<string, LineBalance>>;
};

type ReferenceCase = {
  code: string;
  table: string;
  label: string;
  type: string;
  requiredSource?: string;
  accountPrefixes?: readonly string[];
  balanceSide?: "debit" | "credit";
  formula?: string;
  emptyBehavior?: TaxPackageEmptyBehavior;
  calculationFamily?: TaxPackageCalculationFamily;
};

type LineBalance = {
  debit: number;
  credit: number;
  count: number;
};

export class TaxPackageCerfaCenter {
  constructor(
    private readonly references = new TaxPackageReferenceCenter(),
    private readonly journalAudit = new JournalAuditCenter(),
    private readonly lineReader: TaxPackageLineReader = new PrismaTaxPackageLineReader(),
    private readonly sourceReadiness = new TaxPackageSourceReadinessCenter(),
    private readonly caseResolution = new TaxPackageCaseResolutionPolicy()
  ) {}

  async buildDraft(workspace: CompanyWorkspace): Promise<TaxPackageCerfaDraft> {
    await this.references.assertReady();
    const packageKind = this.references.pickKind({
      taxRegime: workspace.company.incomeRegime,
      vatRegime: workspace.company.vatRegime,
      legalForm: workspace.company.legalForm,
    });
    const [reference, audit, lineBalances] = await Promise.all([
      this.references.getActiveReference(packageKind),
      this.journalAudit.getAuditSummary(workspace),
      this.lineReader.listLineBalances(workspace),
    ]);
    const payload = reference.payloadJson;
    const readiness = this.sourceReadiness.summarize(workspace, { journalExportable: audit.status === "exportable", lineBalances });
    const cases = payload.cases.map((taxCase) => this.resolveCase(taxCase as ReferenceCase, workspace, lineBalances, readiness));
    const tables = payload.tables.map((table) => ({
      code: table,
      label: table,
      cases: cases.filter((taxCase) => taxCase.table === table),
    }));
    const summary = summarizeCases(cases);
    return {
      generatedAt: new Date().toISOString(),
      packageKind,
      packageCode: payload.packageCode,
      label: payload.label,
      millesime: String(workspace.fiscalYear.endDate.getFullYear()),
      reference: {
        version: reference.version,
        sourceUrl: reference.sourceUrl,
      },
      company: {
        name: workspace.company.name,
        siren: workspace.company.siren,
        legalForm: workspace.company.legalForm,
      },
      fiscalYear: {
        startDate: workspace.fiscalYear.startDate.toISOString().slice(0, 10),
        endDate: workspace.fiscalYear.endDate.toISOString().slice(0, 10),
      },
      tables,
      summary,
    };
  }

  async getCompletenessSummary(workspace: CompanyWorkspace) {
    return (await this.buildDraft(workspace)).summary;
  }

  private resolveCase(
    taxCase: ReferenceCase,
    workspace: CompanyWorkspace,
    lineBalances: Map<string, LineBalance>,
    readiness: ReturnType<TaxPackageSourceReadinessCenter["summarize"]>
  ): TaxPackageCerfaCase {
    const accountPrefixes = [...(taxCase.accountPrefixes ?? [])];
    if (taxCase.requiredSource === "profile") return this.profileCase(taxCase, workspace);
    if (taxCase.requiredSource === "manual") return this.policyCase(taxCase, null, false, "Saisie utilisateur ou cabinet", accountPrefixes, readiness);
    if (taxCase.requiredSource === "computed") {
      const value = this.computeFormula(taxCase.formula, lineBalances);
      const hasSourceMovement = hasAnyMovement(["6", "7"], lineBalances);
      return this.policyCase(taxCase, value == null ? null : roundMoney(value), hasSourceMovement, "Calcul Qitus", accountPrefixes, readiness);
    }
    const balance = sumPrefixes(accountPrefixes, lineBalances);
    const amount = balance.count === 0 ? null : taxCase.balanceSide === "credit" ? balance.credit - balance.debit : balance.debit - balance.credit;
    return this.policyCase(taxCase, amount == null ? null : roundMoney(amount), balance.count > 0, "Journal comptable", accountPrefixes, readiness);
  }

  private profileCase(taxCase: ReferenceCase, workspace: CompanyWorkspace): TaxPackageCerfaCase {
    const value = profileValue(taxCase.code, workspace);
    return value == null || value === ""
      ? caseResult(taxCase, null, "à compléter", "Information absente du profil entreprise.", "Profil entreprise", [], {
        resolution: "to_complete",
        isZeroByAbsence: false,
        sourceCompleteness: "partial",
      })
      : caseResult(taxCase, value, "calculée", null, "Profil entreprise", [], {
        resolution: "calculated",
        isZeroByAbsence: false,
        sourceCompleteness: "complete",
      });
  }

  private policyCase(
    taxCase: ReferenceCase,
    amount: number | null,
    hasSourceMovement: boolean,
    source: string,
    accountPrefixes: string[],
    readiness: ReturnType<TaxPackageSourceReadinessCenter["summarize"]>
  ) {
    const resolution = this.caseResolution.resolve({ taxCase, amount, hasSourceMovement, sourceReadiness: readiness });
    return caseResult(taxCase, resolution.value, resolution.status, resolution.reason, source, accountPrefixes, resolution);
  }

  private computeFormula(formula: string | undefined, lineBalances: Map<string, LineBalance>) {
    if (formula === "classe_7 - classe_6") {
      const products = sumPrefixes(["7"], lineBalances);
      const expenses = sumPrefixes(["6"], lineBalances);
      if (products.count === 0 && expenses.count === 0) return null;
      return (products.credit - products.debit) - (expenses.debit - expenses.credit);
    }
    return null;
  }
}

class PrismaTaxPackageLineReader implements TaxPackageLineReader {
  async listLineBalances(workspace: CompanyWorkspace) {
    const lines = await prisma.journalLine.findMany({
      where: { journalEntry: { fiscalYearId: workspace.fiscalYear.id } },
      select: { account: true, debit: true, credit: true },
    });
    const balances = new Map<string, LineBalance>();
    for (const line of lines) {
      const current = balances.get(line.account) ?? { debit: 0, credit: 0, count: 0 };
      current.debit += Number(line.debit);
      current.credit += Number(line.credit);
      current.count += 1;
      balances.set(line.account, current);
    }
    return balances;
  }
}

function caseResult(
  taxCase: ReferenceCase,
  value: string | number | null,
  status: TaxPackageCaseStatus,
  reason: string | null,
  source: string,
  accountPrefixes: string[],
  resolution: { resolution: TaxPackageCaseResolution; isZeroByAbsence: boolean; sourceCompleteness: TaxPackageSourceCompleteness }
): TaxPackageCerfaCase {
  return {
    code: taxCase.code,
    label: taxCase.label,
    table: taxCase.table,
    type: taxCase.type,
    value,
    status,
    source,
    reason,
    accountPrefixes,
    resolution: resolution.resolution,
    isZeroByAbsence: resolution.isZeroByAbsence,
    sourceCompleteness: resolution.sourceCompleteness,
  };
}

function profileValue(code: string, workspace: CompanyWorkspace) {
  const fiscalYear = workspace.fiscalYear;
  const company = workspace.company;
  if (code.endsWith("_001")) return company.name;
  if (code.endsWith("_002")) return company.siren;
  if (code.endsWith("_003")) return [company.addressStreet, company.addressPostal, company.addressCity].filter(Boolean).join(" ");
  if (code.endsWith("_004")) return fiscalYear.startDate.toISOString().slice(0, 10);
  if (code.endsWith("_005")) return fiscalYear.endDate.toISOString().slice(0, 10);
  return null;
}

function sumPrefixes(prefixes: string[], lineBalances: Map<string, LineBalance>): LineBalance {
  const total = { debit: 0, credit: 0, count: 0 };
  for (const [account, balance] of lineBalances.entries()) {
    if (prefixes.some((prefix) => account.startsWith(prefix))) {
      total.debit += balance.debit;
      total.credit += balance.credit;
      total.count += balance.count;
    }
  }
  return total;
}

function hasAnyMovement(prefixes: string[], lineBalances: Map<string, LineBalance>) {
  return sumPrefixes(prefixes, lineBalances).count > 0;
}

function summarizeCases(cases: TaxPackageCerfaCase[]): TaxPackageCompletenessSummary {
  const calculated = cases.filter((taxCase) => taxCase.status === "calculée").length;
  const toComplete = cases.filter((taxCase) => taxCase.status === "à compléter").length;
  const notApplicable = cases.filter((taxCase) => taxCase.status === "non applicable").length;
  const blocked = cases.filter((taxCase) => taxCase.status === "bloquée").length;
  const zeroByAbsence = cases.filter((taxCase) => taxCase.isZeroByAbsence).length;
  const toReview = toComplete;
  const status = blocked > 0 ? "blocked" : toComplete > 0 ? "to_complete" : "complete";
  return {
    status,
    label: status === "complete" ? "Liasse CERFA complète" : status === "blocked" ? "Liasse CERFA bloquée" : "Liasse CERFA à compléter",
    totalCases: cases.length,
    calculated,
    toComplete,
    notApplicable,
    blocked,
    zeroByAbsence,
    toReview,
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
