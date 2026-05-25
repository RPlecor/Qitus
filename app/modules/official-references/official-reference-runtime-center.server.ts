import { prisma } from "~/modules/db.server";
import { OFFICIAL_REFERENCE_LABELS } from "./official-reference-data.server";
import {
  OFFICIAL_REFERENCE_KINDS,
  OfficialReferenceError,
  type OfficialReferenceCapability,
  type OfficialReferenceKind,
  type OfficialReferencePack,
  type OfficialReferenceReadiness,
  type OfficialReferenceValidation,
} from "./official-reference-types";

export const CAPABILITY_REFERENCE_REQUIREMENTS: Record<OfficialReferenceCapability, OfficialReferenceKind[]> = {
  categorize_transactions: ["chart_of_accounts"],
  generate_vat_declaration: ["chart_of_accounts", "vat"],
  generate_fec: ["chart_of_accounts", "fec"],
  generate_tax_package: ["chart_of_accounts", "tax_package_2033", "tax_package_2050"],
  approve_closing_adjustment: ["chart_of_accounts", "closing_adjustments", "evidence"],
  calculate_fixed_assets: ["chart_of_accounts", "fixed_assets"],
  prepare_expert_dossier: ["chart_of_accounts", "fec", "tax_package_2033", "tax_package_2050", "evidence"],
  process_e_invoice: ["chart_of_accounts", "vat", "e_invoice"],
  purge_data: ["retention"],
};

type OfficialReferencePackRow = {
  kind: string;
  version: string;
  status: string;
  source: string;
  sourceUrl: string;
  checksum: string;
  retrievedAt: Date;
  publishedAt: Date | null;
  effectiveFrom: Date;
  activatedAt: Date | null;
  archivedAt: Date | null;
  summary: string;
  payloadJson: unknown;
  validationJson: unknown;
};

export type OfficialReferencePackReader = {
  findActivePack(kind: OfficialReferenceKind): Promise<OfficialReferencePackRow | null>;
};

class PrismaOfficialReferencePackReader implements OfficialReferencePackReader {
  async findActivePack(kind: OfficialReferenceKind) {
    return prisma.officialReferencePack.findFirst({
      where: { kind, status: "ACTIVE" },
      orderBy: { activatedAt: "desc" },
    });
  }
}

export class OfficialReferenceRuntimeCenter {
  private readonly cache = new Map<OfficialReferenceKind, OfficialReferencePack>();

  constructor(private readonly reader: OfficialReferencePackReader = new PrismaOfficialReferencePackReader()) {}

  async getActivePack<TPayload = unknown>(kind: OfficialReferenceKind): Promise<OfficialReferencePack<TPayload>> {
    const cached = this.cache.get(kind);
    if (cached) return cached as OfficialReferencePack<TPayload>;
    const row = await this.reader.findActivePack(kind);
    if (!row) {
      throw new OfficialReferenceError(
        `Référentiel ${OFFICIAL_REFERENCE_LABELS[kind]} actif introuvable. Ouvrez Référentiels Qitus pour initialiser ou activer une version.`,
        kind,
      );
    }
    const pack = fromDbPack(row);
    this.cache.set(kind, pack);
    return pack as OfficialReferencePack<TPayload>;
  }

  async getActivePayload<TPayload = unknown>(kind: OfficialReferenceKind): Promise<TPayload> {
    return (await this.getActivePack<TPayload>(kind)).payloadJson;
  }

  async validatePack(kind: OfficialReferenceKind, version?: string) {
    const pack = await this.getActivePack(kind);
    const errors = [...pack.validationJson.errors];
    if (version && pack.version !== version) errors.push(`Version demandée ${version}, version active ${pack.version}.`);
    if (pack.status !== "ACTIVE") errors.push(`Référentiel ${OFFICIAL_REFERENCE_LABELS[kind]} non actif.`);
    if (!pack.sourceUrl) errors.push(`Source absente pour ${OFFICIAL_REFERENCE_LABELS[kind]}.`);
    if (!pack.checksum) errors.push(`Checksum absent pour ${OFFICIAL_REFERENCE_LABELS[kind]}.`);
    return {
      ok: errors.length === 0,
      kind,
      label: OFFICIAL_REFERENCE_LABELS[kind],
      version: pack.version,
      checksum: pack.checksum,
      sourceUrl: pack.sourceUrl,
      errors,
      warnings: pack.validationJson.warnings,
      checkedAt: new Date().toISOString(),
    };
  }

  async assertCapabilityReady(capability: OfficialReferenceCapability) {
    const validations = await Promise.all(CAPABILITY_REFERENCE_REQUIREMENTS[capability].map((kind) => this.validatePack(kind)));
    const missing = validations.filter((result) => !result.ok);
    if (missing.length > 0) {
      throw new OfficialReferenceError(
        `Référentiel requis absent ou invalide pour ${capability}: ${missing.map((item) => item.label).join(", ")}.`,
      );
    }
  }

  async getReadiness(): Promise<OfficialReferenceReadiness> {
    const items = await Promise.all(OFFICIAL_REFERENCE_KINDS.map(async (kind) => {
      try {
        const pack = await this.getActivePack(kind);
        const validation = await this.validatePack(kind);
        const status = validation.ok ? pack.validationJson.warnings.length > 0 ? "warning" as const : "ready" as const : "blocked" as const;
        return {
          kind,
          label: OFFICIAL_REFERENCE_LABELS[kind],
          status,
          version: pack.version,
          source: pack.source,
          sourceUrl: pack.sourceUrl,
          checksum: pack.checksum,
          effectiveFrom: pack.effectiveFrom,
          summary: pack.summary,
          issues: validation.errors,
          warnings: validation.warnings,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : `Référentiel ${OFFICIAL_REFERENCE_LABELS[kind]} indisponible.`;
        return {
          kind,
          label: OFFICIAL_REFERENCE_LABELS[kind],
          status: "blocked" as const,
          summary: "Référentiel actif absent.",
          issues: [message],
          warnings: [],
        };
      }
    }));
    const blocked = items.filter((item) => item.status === "blocked").length;
    const warning = items.filter((item) => item.status === "warning").length;
    return {
      status: blocked > 0 ? "blocked" : warning > 0 ? "warning" : "ready",
      checkedAt: new Date().toISOString(),
      summary: {
        total: items.length,
        ready: items.length - blocked - warning,
        warning,
        blocked,
      },
      items,
    };
  }
}

function fromDbPack(row: OfficialReferencePackRow): OfficialReferencePack {
  return {
    kind: row.kind as OfficialReferenceKind,
    version: row.version,
    status: row.status as OfficialReferencePack["status"],
    source: row.source as OfficialReferencePack["source"],
    sourceUrl: row.sourceUrl,
    checksum: row.checksum,
    retrievedAt: toDateOnlyOrIso(row.retrievedAt),
    publishedAt: row.publishedAt ? toDateOnlyOrIso(row.publishedAt) : undefined,
    effectiveFrom: toDateOnly(row.effectiveFrom),
    activatedAt: row.activatedAt ? row.activatedAt.toISOString() : undefined,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : undefined,
    summary: row.summary,
    payloadJson: row.payloadJson,
    validationJson: normalizeValidation(row.validationJson),
  };
}

function normalizeValidation(value: unknown): OfficialReferenceValidation {
  const fallback: OfficialReferenceValidation = { ok: false, errors: ["Validation absente."], warnings: [], checkedAt: new Date().toISOString(), accountCodes: [] };
  if (!value || typeof value !== "object") return fallback;
  const input = value as Partial<OfficialReferenceValidation>;
  return {
    ok: Boolean(input.ok),
    errors: Array.isArray(input.errors) ? input.errors.map(String) : [],
    warnings: Array.isArray(input.warnings) ? input.warnings.map(String) : [],
    checkedAt: typeof input.checkedAt === "string" ? input.checkedAt : new Date().toISOString(),
    accountCodes: Array.isArray(input.accountCodes) ? input.accountCodes.map(String) : [],
  };
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toDateOnlyOrIso(value: Date) {
  const iso = value.toISOString();
  return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
}
