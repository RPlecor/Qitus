import type { NormalizedTransaction } from "../import-pipeline/types";

export type CategorizationConfidence = "HIGH" | "MEDIUM" | "LOW";
export type CategorizationSource = "CORRECTION_RULE" | "VENDOR_LOOKUP" | "PATTERN_MATCH" | "AI" | "MANUAL";

export type CategorizationSuggestion = {
  transactionId: string;
  accountDebit: string;
  accountDebitLabel?: string;
  accountCredit: string;
  accountCreditLabel?: string;
  journal: string;
  ecritureLabel: string;
  vatRate?: number | null;
  vatOperationNature?: string | null;
  confidence: CategorizationConfidence;
  source: CategorizationSource;
  rationale?: string;
  alternatives?: Array<{ account: string; label?: string; confidence: number }>;
  isAnnualCharge?: boolean;
};

export type CategorizationTransaction = NormalizedTransaction & {
  id: string;
};

export type CorrectionRuleInput = {
  counterparty: string;
  preferredAccount: string;
  preferredAccountLabel?: string;
  preferredVatRate?: number | null;
  vatOperationNature?: string | null;
};

export type VendorMappingInput = {
  pattern: string;
  matchType: "VENDOR_EXACT" | "VENDOR_CONTAINS" | "LABEL_REGEX" | "LABEL_KEYWORD";
  accountDebit: string;
  accountLabel?: string;
  accountCredit?: string;
  journal?: string;
  ecritureLabel?: string;
  vatRate?: number | null;
  vatOperationNature?: string | null;
  isAnnualCharge?: boolean;
};

export type CategorizationContext = {
  companyName: string;
  legalForm: string;
  vatRegime: string;
  correctionRules: CorrectionRuleInput[];
  vendorMappings: VendorMappingInput[];
};

export type AiCategorizationProvider = {
  categorize(transactions: CategorizationTransaction[], context: CategorizationContext): Promise<CategorizationSuggestion[]>;
};
