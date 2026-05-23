import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "../annual-closing/annual-closing-center.server";
import { CompanyProfile, type CompanyProfileInput } from "../company-workspace/company-profile.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ImportOrchestrator } from "../import-orchestrator/import-orchestrator.server";
import { ExpectedRouteError } from "../route-errors.server";

export type OnboardingStartMode = "bank" | "csv" | "later";

export type OnboardingCompletionInput = {
  firstName?: string;
  lastName?: string;
  company: CompanyProfileInput;
  fiscalYear: {
    startDate?: string;
    endDate?: string;
    creationDate?: string;
  };
  startMode: OnboardingStartMode;
  selectedBank?: string;
  csvFile?: File;
};

export type OnboardingCompletionResult = {
  redirectTo: string;
  fiscalYearId: string;
};

export class OnboardingCenter {
  constructor(
    private readonly profile = new CompanyProfile(),
    private readonly activity = new ActivityLogCenter(),
    private readonly imports = new ImportOrchestrator()
  ) {}

  async completeOnboarding(workspace: CompanyWorkspace, input: OnboardingCompletionInput): Promise<OnboardingCompletionResult> {
    const fiscalYear = await this.resolveFiscalYear(workspace, input.fiscalYear);
    const scopedWorkspace = { ...workspace, fiscalYear };
    const userName = [input.firstName, input.lastName].map((value) => value?.trim()).filter(Boolean).join(" ");

    if (userName) {
      await prisma.user.update({
        where: { id: workspace.user.id },
        data: { name: userName },
      });
    }

    await this.profile.completeOnboarding(scopedWorkspace, input.company);
    await this.activity.recordActivity(scopedWorkspace, {
      action: "profile.onboarding_completed",
      entityType: "company",
      entityId: workspace.company.id,
      metadata: {
        legalForm: input.company.legalForm,
        vatRegime: input.company.vatRegime,
        corporateTax: input.company.corporateTax,
        startMode: input.startMode,
      },
    });

    if (input.startMode === "csv" && input.csvFile && input.csvFile.size > 0) {
      await assertFiscalYearMutable(scopedWorkspace);
      const result = await this.imports.startCsvImport(scopedWorkspace, {
        filename: input.csvFile.name,
        content: await input.csvFile.text(),
      });
      if (result.import.status === "NEEDS_MAPPING") {
        return { redirectTo: `/imports/${result.import.id}/mapping`, fiscalYearId: fiscalYear.id };
      }
      return { redirectTo: "/imports", fiscalYearId: fiscalYear.id };
    }

    if (input.startMode === "bank") return { redirectTo: "/connecteurs", fiscalYearId: fiscalYear.id };
    return { redirectTo: "/dashboard", fiscalYearId: fiscalYear.id };
  }

  private async resolveFiscalYear(workspace: CompanyWorkspace, input: OnboardingCompletionInput["fiscalYear"]) {
    const startDate = parseDate(input.startDate, "La date de début de l'exercice est nécessaire.");
    const endDate = parseDate(input.endDate, "La date de fin de l'exercice est nécessaire.");
    if (endDate <= startDate) throw new ExpectedRouteError("La date de fin doit être après la date de début.", 400);

    const exactExisting = await prisma.fiscalYear.findFirst({
      where: { companyId: workspace.company.id, startDate, endDate },
    });
    if (exactExisting) return exactExisting;

    const active = await prisma.fiscalYear.findUnique({
      where: { id: workspace.fiscalYear.id },
      include: { _count: { select: { imports: true, transactions: true, journalEntries: true, documents: true } } },
    });
    if (active && isEmptyFiscalYear(active._count)) {
      return prisma.fiscalYear.update({
        where: { id: active.id },
        data: { startDate, endDate },
      });
    }

    const overlapping = await prisma.fiscalYear.findFirst({
      where: {
        companyId: workspace.company.id,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (overlapping) throw new ExpectedRouteError("Un exercice existe déjà sur cette période.", 409);

    return prisma.fiscalYear.create({
      data: { companyId: workspace.company.id, startDate, endDate },
    });
  }
}

export function onboardingCompletionInputFromForm(form: FormData): OnboardingCompletionInput {
  const sirenOrSiret = onlyDigits(optionalString(form.get("sirenOrSiret")) ?? "");
  const legalForm = normalizeLegalForm(optionalString(form.get("legalForm")));
  const vatRegime = normalizeVatRegime(optionalString(form.get("vatStatus")), optionalString(form.get("vatFrequency")));
  const managerName = optionalString(form.get("managerName"));
  const manager = splitName(managerName);
  const csvFile = form.get("csvFile");

  return {
    firstName: optionalString(form.get("firstName")),
    lastName: optionalString(form.get("lastName")),
    company: {
      name: optionalString(form.get("companyName")) ?? optionalString(form.get("companyNameAlt")),
      siren: sirenOrSiret.length === 9 ? sirenOrSiret : undefined,
      siret: sirenOrSiret.length === 14 ? sirenOrSiret : undefined,
      legalForm,
      incomeRegime: optionalString(form.get("activity")),
      corporateTax: normalizeCorporateTax(optionalString(form.get("taxRegime"))),
      vatRegime,
      vatExigibility: normalizeVatExigibility(optionalString(form.get("vatExigibility"))),
      addressStreet: optionalString(form.get("addressStreet")),
      addressPostal: optionalString(form.get("addressPostal")),
      addressCity: optionalString(form.get("addressCity")),
      managerFirstName: manager.firstName,
      managerLastName: manager.lastName,
      managerRole: optionalString(form.get("managerRole")),
      capital: optionalString(form.get("capital")),
    },
    fiscalYear: {
      startDate: optionalString(form.get("fiscalYearStart")),
      endDate: optionalString(form.get("fiscalYearEnd")),
      creationDate: optionalString(form.get("creationDate")),
    },
    startMode: normalizeStartMode(optionalString(form.get("startMode"))),
    selectedBank: optionalString(form.get("selectedBank")),
    csvFile: csvFile instanceof File ? csvFile : undefined,
  };
}

function isEmptyFiscalYear(count: { imports: number; transactions: number; journalEntries: number; documents: number }) {
  return count.imports + count.transactions + count.journalEntries + count.documents === 0;
}

function parseDate(value: string | undefined, message: string) {
  if (!value) throw new ExpectedRouteError(message, 400);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new ExpectedRouteError("Date d'exercice invalide.", 400);
  return date;
}

function normalizeLegalForm(value: string | undefined) {
  if (value === "micro") return "AUTO_ENTREPRENEUR";
  if (value === "ei") return "EI";
  if (value === "eurl") return "SARL";
  if (value === "sasu") return "SASU";
  if (value === "sci") return "SCI";
  return "AUTRE";
}

function normalizeCorporateTax(value: string | undefined) {
  return value === "ir" ? "IR" : "IS";
}

function normalizeVatRegime(vatStatus: string | undefined, vatFrequency: string | undefined) {
  if (vatStatus !== "yes") return "FRANCHISE";
  return vatFrequency === "annual" ? "REEL_SIMPLIFIE" : "REEL_NORMAL";
}

function normalizeVatExigibility(value: string | undefined) {
  if (value === "facturation") return "DEBITS";
  if (value === "mixte") return "MIXED";
  return "ENCAISSEMENTS";
}

function normalizeStartMode(value: string | undefined): OnboardingStartMode {
  if (value === "bank" || value === "csv") return value;
  return "later";
}

function splitName(value: string | undefined) {
  if (!value) return { firstName: undefined, lastName: undefined };
  const parts = value.trim().split(/\s+/);
  return { firstName: parts.shift(), lastName: parts.join(" ") || undefined };
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function optionalString(value: FormDataEntryValue | string | null | undefined) {
  const text = value == null ? undefined : String(value).trim();
  return text ? text : undefined;
}
