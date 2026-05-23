import { createHash } from "node:crypto";

export const OFFICIAL_REFERENCE_KINDS = [
  "chart_of_accounts",
  "vat",
  "fec",
  "tax_package_2033",
  "tax_package_2050",
  "closing_adjustments",
  "fixed_assets",
  "evidence",
  "reconciliation",
  "e_invoice",
  "retention",
] as const;

export type OfficialReferenceKind = typeof OFFICIAL_REFERENCE_KINDS[number];

export type OfficialReferencePackStatus = "DRAFT" | "ACTIVE" | "ARCHIVED" | "NEEDS_REVIEW" | "BLOCKED";

export type OfficialReferenceSource = "ANC" | "BOFIP" | "IMPOTS_GOUV" | "CGI" | "INTERNAL_QITUS";

export type OfficialReferenceCapability =
  | "categorize_transactions"
  | "generate_vat_declaration"
  | "generate_fec"
  | "generate_tax_package"
  | "approve_closing_adjustment"
  | "calculate_fixed_assets"
  | "prepare_expert_dossier"
  | "process_e_invoice"
  | "purge_data";

export type OfficialReferenceValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: string;
  accountCodes: string[];
};

export type OfficialReferencePack<TPayload = unknown> = {
  kind: OfficialReferenceKind;
  version: string;
  status: OfficialReferencePackStatus;
  source: OfficialReferenceSource;
  sourceUrl: string;
  checksum: string;
  retrievedAt: string;
  publishedAt?: string;
  effectiveFrom: string;
  summary: string;
  payloadJson: TPayload;
  validationJson: OfficialReferenceValidation;
};

export type OfficialReferenceReadinessItem = {
  kind: OfficialReferenceKind;
  label: string;
  status: "ready" | "warning" | "blocked";
  version?: string;
  source?: OfficialReferenceSource;
  sourceUrl?: string;
  checksum?: string;
  effectiveFrom?: string;
  summary: string;
  issues: string[];
  warnings: string[];
};

export type OfficialReferenceReadiness = {
  status: "ready" | "warning" | "blocked";
  checkedAt: string;
  summary: {
    total: number;
    ready: number;
    warning: number;
    blocked: number;
  };
  items: OfficialReferenceReadinessItem[];
};

export class OfficialReferenceError extends Error {
  constructor(message: string, readonly kind?: OfficialReferenceKind) {
    super(message);
    this.name = "OfficialReferenceError";
  }
}

export function officialReferenceChecksum(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = sortValue((value as Record<string, unknown>)[key]);
    return acc;
  }, {});
}
