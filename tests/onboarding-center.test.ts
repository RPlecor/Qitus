import { describe, expect, it } from "vitest";
import { onboardingCompletionInputFromForm } from "../app/modules/onboarding/onboarding-center.server";

describe("onboardingCompletionInputFromForm", () => {
  it("maps the guided fiscal and company answers to Qitus domain values", () => {
    const form = new FormData();
    form.set("firstName", "Marie");
    form.set("lastName", "Dupont");
    form.set("companyName", "Qitus Conseil");
    form.set("sirenOrSiret", "912 345 678 00015");
    form.set("legalForm", "sasu");
    form.set("activity", "services");
    form.set("taxRegime", "is");
    form.set("vatStatus", "yes");
    form.set("vatFrequency", "monthly");
    form.set("vatExigibility", "encaissement");
    form.set("fiscalYearStart", "2026-01-01");
    form.set("fiscalYearEnd", "2026-12-31");
    form.set("startMode", "csv");

    expect(onboardingCompletionInputFromForm(form)).toMatchObject({
      firstName: "Marie",
      lastName: "Dupont",
      company: {
        name: "Qitus Conseil",
        siret: "91234567800015",
        legalForm: "SASU",
        incomeRegime: "services",
        corporateTax: "IS",
        vatRegime: "REEL_NORMAL",
        vatExigibility: "ENCAISSEMENTS",
      },
      fiscalYear: { startDate: "2026-01-01", endDate: "2026-12-31" },
      startMode: "csv",
    });
  });

  it("keeps franchise TVA simple and stores grouped legal forms conservatively", () => {
    const form = new FormData();
    form.set("companyNameAlt", "Projet Dubois");
    form.set("legalForm", "eurl");
    form.set("taxRegime", "ir");
    form.set("vatStatus", "franchise");
    form.set("fiscalYearStart", "2025-01-01");
    form.set("fiscalYearEnd", "2025-12-31");

    expect(onboardingCompletionInputFromForm(form)).toMatchObject({
      company: {
        name: "Projet Dubois",
        legalForm: "SARL",
        corporateTax: "IR",
        vatRegime: "FRANCHISE",
        vatExigibility: "ENCAISSEMENTS",
      },
      startMode: "later",
    });
  });
});
