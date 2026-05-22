import { createCookie, redirect } from "@remix-run/node";
import type { FiscalYear, FiscalYearStatus } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";

export const activeFiscalYearCookie = createCookie("paperasse_fiscal_year_id", {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
});

export type FiscalYearInput = {
  startDate: string;
  endDate: string;
};

export type FiscalYearSummary = {
  id: string;
  startDate: string;
  endDate: string;
  status: FiscalYearStatus;
  active: boolean;
  counters: {
    imports: number;
    transactions: number;
    journalEntries: number;
    documents: number;
  };
};

export class FiscalYearCenter {
  constructor(private readonly activity = new ActivityLogCenter()) {}

  async listFiscalYears(workspace: CompanyWorkspace): Promise<FiscalYearSummary[]> {
    const fiscalYears = await prisma.fiscalYear.findMany({
      where: { companyId: workspace.company.id },
      include: {
        _count: { select: { imports: true, transactions: true, journalEntries: true, documents: true } },
      },
      orderBy: { startDate: "desc" },
    });
    return fiscalYears.map((fiscalYear) => ({
      id: fiscalYear.id,
      startDate: fiscalYear.startDate.toISOString(),
      endDate: fiscalYear.endDate.toISOString(),
      status: fiscalYear.status,
      active: fiscalYear.id === workspace.fiscalYear.id,
      counters: {
        imports: fiscalYear._count.imports,
        transactions: fiscalYear._count.transactions,
        journalEntries: fiscalYear._count.journalEntries,
        documents: fiscalYear._count.documents,
      },
    }));
  }

  async createFiscalYear(workspace: CompanyWorkspace, input: FiscalYearInput) {
    const normalized = normalizeFiscalYearInput(input);
    await this.assertFiscalYearCanBeCreated(workspace, normalized);
    const fiscalYear = await prisma.fiscalYear.create({
      data: {
        companyId: workspace.company.id,
        startDate: normalized.startDate,
        endDate: normalized.endDate,
      },
    });
    await ensurePrimaryBankAccount(workspace.company.id);
    await this.activity.recordActivity(workspace, {
      action: "fiscal_year.created",
      entityType: "fiscal_year",
      entityId: fiscalYear.id,
      metadata: { startDate: fiscalYear.startDate.toISOString(), endDate: fiscalYear.endDate.toISOString() },
    });
    return fiscalYear;
  }

  async activateFiscalYear(request: Request, fiscalYearId: string) {
    const headers = new Headers();
    headers.append("Set-Cookie", await activeFiscalYearCookie.serialize(fiscalYearId));
    const redirectTo = new URL(request.url).searchParams.get("redirectTo") || "/dashboard";
    return redirect(redirectTo, { headers });
  }

  async getFiscalYearSummary(workspace: CompanyWorkspace, fiscalYearId: string) {
    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId: workspace.company.id },
      include: { _count: { select: { imports: true, transactions: true, journalEntries: true, documents: true } } },
    });
    if (!fiscalYear) throw new ExpectedRouteError("Exercice introuvable.", 404);
    return {
      id: fiscalYear.id,
      startDate: fiscalYear.startDate.toISOString(),
      endDate: fiscalYear.endDate.toISOString(),
      status: fiscalYear.status,
      active: fiscalYear.id === workspace.fiscalYear.id,
      counters: {
        imports: fiscalYear._count.imports,
        transactions: fiscalYear._count.transactions,
        journalEntries: fiscalYear._count.journalEntries,
        documents: fiscalYear._count.documents,
      },
    };
  }

  async assertFiscalYearCanBeCreated(workspace: CompanyWorkspace, input: { startDate: Date; endDate: Date }) {
    if (input.endDate <= input.startDate) throw new ExpectedRouteError("La date de fin doit être postérieure à la date de début.", 400);
    const overlapping = await prisma.fiscalYear.findFirst({
      where: {
        companyId: workspace.company.id,
        startDate: { lte: input.endDate },
        endDate: { gte: input.startDate },
      },
    });
    if (overlapping) throw new ExpectedRouteError("Un exercice existe déjà sur cette période.", 409);
  }
}

export async function resolveActiveFiscalYearId(request: Request, fiscalYears: FiscalYear[]) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("fiscalYearId") || await activeFiscalYearCookie.parse(request.headers.get("Cookie"));
  if (typeof requested === "string" && fiscalYears.some((fiscalYear) => fiscalYear.id === requested)) return requested;
  return [...fiscalYears].sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0]?.id ?? null;
}

export function normalizeFiscalYearInput(input: FiscalYearInput) {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new ExpectedRouteError("Dates d'exercice invalides.", 400);
  }
  return { startDate, endDate };
}

async function ensurePrimaryBankAccount(companyId: string) {
  const existing = await prisma.bankAccount.findFirst({ where: { companyId, pcgAccount: "5121" } });
  if (existing) return existing;
  return prisma.bankAccount.create({
    data: { companyId, bank: "Qonto", label: "Compte principal", pcgAccount: "5121", fecAccount: "51211" },
  });
}
