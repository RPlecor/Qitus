export type CompanyTier = "TIER_1_MICRO" | "TIER_2_EI_REEL" | "TIER_3_IS_SANS_EC" | "TIER_4_AVEC_EC";

export type CompanyProfileInput = {
  legalForm: string;
  incomeRegime?: string | null;
  corporateTax?: string | null;
  vatRegime?: string | null;
  hasAccountant?: boolean | null;
  accountantEmail?: string | null;
  revenueEstimate?: string | null;
};

export type CompanyTierConfig = {
  tier: CompanyTier;
  confidenceThreshold: number;
  minHistoryMatches: number;
  blacklistExtensions: Array<"provision" | "exceptional_charge_over_1000">;
};

export type CompanyProfileClassification = {
  tier: CompanyTier;
  fecRequired: boolean;
  bilanRequired: boolean;
  taxFormSet: string[];
  config: CompanyTierConfig;
  inputs: {
    legalForm: string;
    incomeRegime: string | null;
    corporateTax: string | null;
    vatRegime: string | null;
    hasAccountant: boolean;
    revenueEstimate: string | null;
  };
};

const TIER_CONFIG: Record<CompanyTier, CompanyTierConfig> = {
  TIER_1_MICRO: {
    tier: "TIER_1_MICRO",
    confidenceThreshold: 40,
    minHistoryMatches: 0,
    blacklistExtensions: [],
  },
  TIER_2_EI_REEL: {
    tier: "TIER_2_EI_REEL",
    confidenceThreshold: 70,
    minHistoryMatches: 1,
    blacklistExtensions: [],
  },
  TIER_3_IS_SANS_EC: {
    tier: "TIER_3_IS_SANS_EC",
    confidenceThreshold: 95,
    minHistoryMatches: 2,
    blacklistExtensions: ["provision", "exceptional_charge_over_1000"],
  },
  TIER_4_AVEC_EC: {
    tier: "TIER_4_AVEC_EC",
    confidenceThreshold: 70,
    minHistoryMatches: 1,
    blacklistExtensions: [],
  },
};

export class CompanyProfileClassificationCenter {
  classifyCompanyProfile(company: CompanyProfileInput): CompanyProfileClassification {
    const tier = this.deriveCompanyTier(company);
    return {
      tier,
      fecRequired: this.deriveFecRequired(company),
      bilanRequired: this.deriveBilanRequired(company),
      taxFormSet: this.deriveTaxFormSet(company),
      config: this.getTierConfig(tier),
      inputs: {
        legalForm: company.legalForm,
        incomeRegime: company.incomeRegime ?? null,
        corporateTax: company.corporateTax ?? null,
        vatRegime: company.vatRegime ?? null,
        hasAccountant: Boolean(company.hasAccountant),
        revenueEstimate: company.revenueEstimate ?? null,
      },
    };
  }

  deriveCompanyTier(company: CompanyProfileInput): CompanyTier {
    if (isMicro(company)) return "TIER_1_MICRO";
    if (company.hasAccountant === true) return "TIER_4_AVEC_EC";
    if (isCorporateTaxIs(company)) return "TIER_3_IS_SANS_EC";
    return "TIER_2_EI_REEL";
  }

  getTierConfig(tier: CompanyTier): CompanyTierConfig {
    return TIER_CONFIG[tier];
  }

  deriveFecRequired(_company: CompanyProfileInput): boolean {
    // TODO P1: Masterplan fiscal. P0 only exposes the field without deriving fiscal obligations.
    return false;
  }

  deriveBilanRequired(_company: CompanyProfileInput): boolean {
    // TODO P1: Masterplan fiscal. P0 only exposes the field without deriving fiscal obligations.
    return false;
  }

  deriveTaxFormSet(_company: CompanyProfileInput): string[] {
    // TODO P1: Masterplan fiscal. P0 only exposes the field without deriving fiscal forms.
    return [];
  }
}

function isMicro(company: CompanyProfileInput) {
  return company.legalForm === "AUTO_ENTREPRENEUR" || normalize(company.incomeRegime).includes("micro");
}

function isCorporateTaxIs(company: CompanyProfileInput) {
  return company.corporateTax === "IS" || /\bis\b/.test(normalize(company.incomeRegime));
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
