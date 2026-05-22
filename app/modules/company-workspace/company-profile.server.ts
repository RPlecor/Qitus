import { prisma } from "../db.server";
import type { CompanyWorkspace } from "./company-workspace.server";

export type CompanyProfileInput = {
  name?: string;
  siren?: string;
  legalForm?: string;
  vatRegime?: string;
  vatExigibility?: string;
  corporateTax?: string;
};

export class CompanyProfile {
  async getProfile(workspace: CompanyWorkspace) {
    return {
      id: workspace.company.id,
      name: workspace.company.name,
      legalForm: workspace.company.legalForm,
      siren: workspace.company.siren ?? "",
      vatRegime: workspace.company.vatRegime,
      vatExigibility: workspace.company.vatExigibility,
      corporateTax: workspace.company.corporateTax ?? "IS",
      onboardingComplete: workspace.company.onboardingComplete,
    };
  }

  async saveProfile(workspace: CompanyWorkspace, input: CompanyProfileInput) {
    return prisma.company.update({
      where: { id: workspace.company.id },
      data: profileData(input),
    });
  }

  async completeOnboarding(workspace: CompanyWorkspace, input: CompanyProfileInput) {
    return prisma.company.update({
      where: { id: workspace.company.id },
      data: {
        ...profileData(input),
        onboardingComplete: true,
      },
    });
  }
}

export function companyProfileInputFromForm(form: FormData): CompanyProfileInput {
  return {
    name: optionalString(form.get("name")),
    siren: optionalString(form.get("siren")),
    legalForm: optionalString(form.get("legalForm")),
    vatRegime: optionalString(form.get("vatRegime")),
    vatExigibility: optionalString(form.get("vatExigibility")),
    corporateTax: optionalString(form.get("corporateTax")),
  };
}

function profileData(input: CompanyProfileInput) {
  return {
    name: input.name || "ACME Digital",
    siren: input.siren ?? "",
    legalForm: optionalEnum(input.legalForm, ["SASU", "SARL", "EI"] as const) ?? "SASU",
    vatRegime: optionalEnum(input.vatRegime, ["FRANCHISE", "REEL_SIMPLIFIE", "REEL_NORMAL"] as const) ?? "FRANCHISE",
    vatExigibility: optionalEnum(input.vatExigibility, ["DEBITS", "ENCAISSEMENTS", "MIXED"] as const) ?? "ENCAISSEMENTS",
    corporateTax: optionalEnum(input.corporateTax, ["IS", "IR"] as const) ?? "IS",
  };
}

function optionalString(value: FormDataEntryValue | string | null | undefined) {
  const text = value == null ? undefined : String(value);
  return text === "" ? undefined : text;
}

function optionalEnum<T extends string>(value: string | undefined, candidates: readonly T[]): T | undefined {
  if (!value || !candidates.includes(value as T)) return undefined;
  return value as T;
}
