import { describe, expect, it } from "vitest";
import { CompanyProfileClassificationCenter } from "../app/modules/accounting-reference/company-profile-classification-center.server";

const center = new CompanyProfileClassificationCenter();

describe("CompanyProfileClassificationCenter", () => {
  it("classifies company tiers from existing company fields", () => {
    expect(center.deriveCompanyTier({ legalForm: "AUTO_ENTREPRENEUR", incomeRegime: null, corporateTax: "IR", hasAccountant: false })).toBe("TIER_1_MICRO");
    expect(center.deriveCompanyTier({ legalForm: "EI", incomeRegime: "micro-BNC", corporateTax: "IR", hasAccountant: false })).toBe("TIER_1_MICRO");
    expect(center.deriveCompanyTier({ legalForm: "EI", incomeRegime: "BNC réel", corporateTax: "IR", hasAccountant: false })).toBe("TIER_2_EI_REEL");
    expect(center.deriveCompanyTier({ legalForm: "SASU", incomeRegime: "BIC réel", corporateTax: "IS", hasAccountant: false })).toBe("TIER_3_IS_SANS_EC");
    expect(center.deriveCompanyTier({ legalForm: "SARL", incomeRegime: "BIC réel", corporateTax: "IS", hasAccountant: true })).toBe("TIER_4_AVEC_EC");
    expect(center.deriveCompanyTier({ legalForm: "SCI", incomeRegime: "IR", corporateTax: "IR", hasAccountant: false })).toBe("TIER_2_EI_REEL");
    expect(center.deriveCompanyTier({ legalForm: "SCI", incomeRegime: "IS", corporateTax: "IS", hasAccountant: false })).toBe("TIER_3_IS_SANS_EC");
    expect(center.deriveCompanyTier({ legalForm: "EI", incomeRegime: "BIC réel simplifié", corporateTax: "IR", hasAccountant: true })).toBe("TIER_4_AVEC_EC");
  });

  it("keeps fiscal derivations as explicit P0 stubs", () => {
    const company = { legalForm: "SASU", incomeRegime: "BIC réel", corporateTax: "IS", hasAccountant: false };
    expect(center.deriveFecRequired(company)).toBe(false);
    expect(center.deriveBilanRequired(company)).toBe(false);
    expect(center.deriveTaxFormSet(company)).toEqual([]);
  });

  it("exposes tier configuration used by auto-apply policy", () => {
    expect(center.getTierConfig("TIER_1_MICRO")).toMatchObject({ confidenceThreshold: 40, minHistoryMatches: 0, blacklistExtensions: [] });
    expect(center.getTierConfig("TIER_2_EI_REEL")).toMatchObject({ confidenceThreshold: 70, minHistoryMatches: 1, blacklistExtensions: [] });
    expect(center.getTierConfig("TIER_3_IS_SANS_EC")).toMatchObject({ confidenceThreshold: 95, minHistoryMatches: 2, blacklistExtensions: ["provision", "exceptional_charge_over_1000"] });
    expect(center.getTierConfig("TIER_4_AVEC_EC")).toMatchObject({ confidenceThreshold: 70, minHistoryMatches: 1, blacklistExtensions: [] });
  });
});
