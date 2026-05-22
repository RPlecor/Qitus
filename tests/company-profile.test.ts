import { describe, expect, it } from "vitest";
import { companyProfileInputFromForm } from "../app/modules/company-profile/company-profile.server";

describe("CompanyProfile", () => {
  it("normalizes form input for profile and onboarding routes", () => {
    const form = new FormData();
    form.set("name", "ACME Digital");
    form.set("siren", "");
    form.set("legalForm", "SASU");
    form.set("vatRegime", "FRANCHISE");
    form.set("corporateTax", "IS");

    expect(companyProfileInputFromForm(form)).toEqual({
      name: "ACME Digital",
      siren: undefined,
      legalForm: "SASU",
      vatRegime: "FRANCHISE",
      corporateTax: "IS",
    });
  });
});
