import { prisma } from "~/modules/db.server";
import {
  buildOfficialReferencePacks,
  isOfficialReferenceKind,
  OFFICIAL_REFERENCE_LABELS,
} from "./official-reference-data.server";
import {
  OFFICIAL_REFERENCE_KINDS,
  OfficialReferenceError,
  type OfficialReferenceCapability,
  type OfficialReferenceKind,
  type OfficialReferencePack,
  type OfficialReferenceReadiness,
} from "./official-reference-types";

const CAPABILITY_REQUIREMENTS: Record<OfficialReferenceCapability, OfficialReferenceKind[]> = {
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

export class OfficialReferenceCenter {
  private readonly packs = buildOfficialReferencePacks();

  async syncAllOfficialReferences() {
    const results = await Promise.all(OFFICIAL_REFERENCE_KINDS.map((kind) => this.syncReference(kind)));
    return { syncedAt: new Date().toISOString(), results };
  }

  async syncReference(kind: OfficialReferenceKind) {
    const pack = this.getActiveReference(kind);
    await this.recordSnapshot(pack, "sync");
    return {
      kind,
      status: pack.status,
      version: pack.version,
      checksum: pack.checksum,
      sourceUrl: pack.sourceUrl,
      message: pack.status === "ACTIVE"
        ? "Référentiel actif conservé et source tracée."
        : "Référentiel conservé mais nécessite une vérification Qitus.",
    };
  }

  getActiveReference<TPayload = unknown>(kind: OfficialReferenceKind): OfficialReferencePack<TPayload> {
    const pack = this.packs[kind];
    if (!pack) throw new OfficialReferenceError(`Référentiel ${kind} introuvable.`, kind);
    return pack as OfficialReferencePack<TPayload>;
  }

  async listReferenceSnapshots(kind?: OfficialReferenceKind) {
    if (!prisma.regulatorySourceSnapshot) return [];
    const snapshots = await prisma.regulatorySourceSnapshot.findMany({
      where: kind ? { rawMetadataJson: { path: ["officialReferenceKind"], equals: kind } } : undefined,
      orderBy: { retrievedAt: "desc" },
      take: 50,
      include: { changes: true },
    });
    return snapshots;
  }

  validateReferencePack(kind: OfficialReferenceKind, version?: string) {
    const pack = this.getActiveReference(kind);
    const errors: string[] = [];
    if (version && pack.version !== version) errors.push(`Version demandée ${version}, version active ${pack.version}.`);
    if (pack.status !== "ACTIVE") errors.push(`Référentiel ${OFFICIAL_REFERENCE_LABELS[kind]} non actif.`);
    if (!pack.sourceUrl) errors.push(`Source absente pour ${OFFICIAL_REFERENCE_LABELS[kind]}.`);
    if (!pack.checksum) errors.push(`Checksum absent pour ${OFFICIAL_REFERENCE_LABELS[kind]}.`);
    errors.push(...pack.validationJson.errors);
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

  assertReferenceReady(capability: OfficialReferenceCapability) {
    const missing = CAPABILITY_REQUIREMENTS[capability]
      .map((kind) => this.validateReferencePack(kind))
      .filter((result) => !result.ok);
    if (missing.length > 0) {
      throw new OfficialReferenceError(
        `Référentiel requis absent ou invalide pour ${capability}: ${missing.map((item) => item.label).join(", ")}.`,
      );
    }
  }

  getReferenceReadiness(): OfficialReferenceReadiness {
    const items = OFFICIAL_REFERENCE_KINDS.map((kind) => {
      const pack = this.getActiveReference(kind);
      const validation = this.validateReferencePack(kind);
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
    });
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

  isKnownKind(value: string | undefined): value is OfficialReferenceKind {
    return isOfficialReferenceKind(value);
  }

  private async recordSnapshot(pack: OfficialReferencePack, mode: "sync" | "validate") {
    try {
      if (!prisma.regulatorySourceSnapshot) return;
      await prisma.regulatorySourceSnapshot.create({
        data: {
          source: pack.source.toLowerCase(),
          sourceUrl: pack.sourceUrl,
          retrievedAt: new Date(),
          checksum: pack.checksum,
          publishedAt: pack.publishedAt ? new Date(pack.publishedAt) : null,
          title: `${OFFICIAL_REFERENCE_LABELS[pack.kind]} ${pack.version}`,
          rawMetadataJson: {
            officialReferenceKind: pack.kind,
            version: pack.version,
            status: pack.status,
            mode,
            validation: pack.validationJson,
          },
        },
      });
    } catch {
      // A failed trace must not break the product. Readiness still uses the embedded pack.
    }
  }
}
