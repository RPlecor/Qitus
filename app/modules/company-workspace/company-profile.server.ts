import type { Prisma } from "@prisma/client";

import { prisma } from "../db.server";
import type { CompanyWorkspace } from "./company-workspace.server";

export type CompanyProfileInput = {
  name?: string;
  siren?: string;
  siret?: string;
  legalForm?: string;
  vatRegime?: string;
  vatExigibility?: string;
  corporateTax?: string;
  incomeRegime?: string;
  addressStreet?: string;
  addressPostal?: string;
  addressCity?: string;
  managerFirstName?: string;
  managerLastName?: string;
  managerRole?: string;
  capital?: string | number;
  hasAccountant?: boolean | string;
  accountantEmail?: string;
  revenueEstimate?: string;
};

export class CompanyProfile {
  async getProfile(workspace: CompanyWorkspace) {
    return {
      id: workspace.company.id,
      name: workspace.company.name,
      legalForm: workspace.company.legalForm,
      siren: workspace.company.siren ?? "",
      siret: workspace.company.siret ?? "",
      vatRegime: workspace.company.vatRegime,
      vatExigibility: workspace.company.vatExigibility,
      corporateTax: workspace.company.corporateTax ?? "IS",
      incomeRegime: workspace.company.incomeRegime ?? "",
      addressStreet: workspace.company.addressStreet ?? "",
      addressPostal: workspace.company.addressPostal ?? "",
      addressCity: workspace.company.addressCity ?? "",
      managerFirstName: workspace.company.managerFirstName ?? "",
      managerLastName: workspace.company.managerLastName ?? "",
      managerRole: workspace.company.managerRole ?? "",
      capital: workspace.company.capital ?? "",
      hasAccountant: workspace.company.hasAccountant,
      accountantEmail: workspace.company.accountantEmail ?? "",
      revenueEstimate: workspace.company.revenueEstimate ?? "",
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
    siret: optionalString(form.get("siret")),
    legalForm: optionalString(form.get("legalForm")),
    vatRegime: optionalString(form.get("vatRegime")),
    vatExigibility: optionalString(form.get("vatExigibility")),
    corporateTax: optionalString(form.get("corporateTax")),
    incomeRegime: optionalString(form.get("incomeRegime")),
    addressStreet: optionalString(form.get("addressStreet")),
    addressPostal: optionalString(form.get("addressPostal")),
    addressCity: optionalString(form.get("addressCity")),
    managerFirstName: optionalString(form.get("managerFirstName")),
    managerLastName: optionalString(form.get("managerLastName")),
    managerRole: optionalString(form.get("managerRole")),
    capital: optionalString(form.get("capital")),
    hasAccountant: optionalBoolean(form.get("hasAccountant")),
    accountantEmail: optionalString(form.get("accountantEmail")),
    revenueEstimate: optionalString(form.get("revenueEstimate")),
  };
}

function profileData(input: CompanyProfileInput) {
  const data: Prisma.CompanyUpdateInput = {
    name: input.name || "ACME Digital",
    siren: input.siren ?? "",
    legalForm: optionalEnum(input.legalForm, ["AUTO_ENTREPRENEUR", "EI", "EURL", "SASU", "SARL", "SAS", "SA", "SCI", "AUTRE"] as const) ?? "SASU",
    vatRegime: optionalEnum(input.vatRegime, ["FRANCHISE", "REEL_SIMPLIFIE", "REEL_NORMAL"] as const) ?? "FRANCHISE",
    vatExigibility: optionalEnum(input.vatExigibility, ["DEBITS", "ENCAISSEMENTS", "MIXED"] as const) ?? "ENCAISSEMENTS",
    corporateTax: optionalEnum(input.corporateTax, ["IS", "IR"] as const) ?? "IS",
  };

  if (input.siret !== undefined) data.siret = input.siret;
  if (input.incomeRegime !== undefined) data.incomeRegime = input.incomeRegime || null;
  if (input.addressStreet !== undefined) data.addressStreet = input.addressStreet || null;
  if (input.addressPostal !== undefined) data.addressPostal = input.addressPostal || null;
  if (input.addressCity !== undefined) data.addressCity = input.addressCity || null;
  if (input.managerFirstName !== undefined) data.managerFirstName = input.managerFirstName || null;
  if (input.managerLastName !== undefined) data.managerLastName = input.managerLastName || null;
  if (input.managerRole !== undefined) data.managerRole = input.managerRole || null;
  if (input.capital !== undefined) data.capital = normalizeCapital(input.capital);
  if (input.hasAccountant !== undefined) data.hasAccountant = normalizeBoolean(input.hasAccountant);
  if (input.accountantEmail !== undefined) data.accountantEmail = input.accountantEmail || null;
  if (input.revenueEstimate !== undefined) data.revenueEstimate = input.revenueEstimate || null;

  return data;
}

function optionalString(value: FormDataEntryValue | string | null | undefined) {
  const text = value == null ? undefined : String(value);
  return text === "" ? undefined : text;
}

function optionalEnum<T extends string>(value: string | undefined, candidates: readonly T[]): T | undefined {
  if (!value || !candidates.includes(value as T)) return undefined;
  return value as T;
}

function optionalBoolean(value: FormDataEntryValue | string | null | undefined) {
  if (value == null) return undefined;
  return normalizeBoolean(String(value));
}

function normalizeBoolean(value: boolean | string | undefined) {
  if (typeof value === "boolean") return value;
  return value === "true" || value === "on" || value === "1";
}

function normalizeCapital(value: string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : null;
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number.parseInt(digits, 10);
}
