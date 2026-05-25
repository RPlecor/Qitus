import type { Prisma } from "@prisma/client";
import { prisma } from "~/modules/db.server";
import { buildOfficialReferencePacks, OFFICIAL_REFERENCE_LABELS } from "./official-reference-data.server";
import { AncPcgReferenceAdapter, ImpotsGovReferenceAdapter, InternalQitusReferenceAdapter } from "./official-reference-source-adapters.server";
import {
  OFFICIAL_REFERENCE_KINDS,
  OfficialReferenceError,
  officialReferenceChecksum,
  type OfficialReferenceKind,
  type OfficialReferencePack,
  type OfficialReferenceSnapshot,
  type OfficialReferenceSourceAdapter,
  type OfficialReferenceValidation,
} from "./official-reference-types";

export class OfficialReferenceActivationWorkflow {
  private readonly embeddedPacks = buildOfficialReferencePacks();

  constructor(private readonly adapters = buildDefaultAdapters()) {}

  async bootstrapEmbeddedPacks() {
    const results = await Promise.all(OFFICIAL_REFERENCE_KINDS.map((kind) => this.bootstrapEmbeddedPack(kind)));
    return { bootstrappedAt: new Date().toISOString(), results };
  }

  async syncReference(kind: OfficialReferenceKind) {
    await this.bootstrapEmbeddedPack(kind);
    const adapter = this.adapterFor(kind);
    const snapshot = await adapter.fetchSnapshot();
    await this.recordSnapshot(snapshot, "sync");
    const draft = await adapter.buildDraftPack(snapshot);
    const current = await this.findActivePack(kind);
    const status = current && current.checksum !== draft.checksum ? "NEEDS_REVIEW" : draft.status;
    const stored = await this.upsertPack({ ...draft, status });
    return {
      kind,
      label: OFFICIAL_REFERENCE_LABELS[kind],
      status: stored.status,
      version: stored.version,
      checksum: stored.checksum,
      sourceUrl: stored.sourceUrl,
      activePreserved: Boolean(current && stored.status !== "ACTIVE"),
      message: stored.status === "ACTIVE"
        ? "Référentiel actif vérifié."
        : "Changement détecté : validation Qitus requise avant activation.",
    };
  }

  async validateReferencePack(kind: OfficialReferenceKind, version?: string) {
    const pack = version ? await this.findPack(kind, version) : await this.findActivePack(kind);
    const resolved = pack;
    if (!resolved) throw new OfficialReferenceError(`Référentiel ${OFFICIAL_REFERENCE_LABELS[kind]} actif introuvable.`, kind);
    const validation = this.adapterFor(kind).validateDraftPack(resolved);
    await this.upsertPack({ ...resolved, validationJson: validation, status: validation.ok ? resolved.status : "BLOCKED" });
    await this.recordSnapshot({
      kind,
      source: resolved.source,
      sourceUrl: resolved.sourceUrl,
      retrievedAt: new Date().toISOString(),
      checksum: resolved.checksum,
      publishedAt: resolved.publishedAt,
      title: `${OFFICIAL_REFERENCE_LABELS[kind]} ${resolved.version}`,
      rawMetadataJson: { officialReferenceKind: kind, version: resolved.version, mode: "validate", validation },
    }, "validate");
    return validationResult(resolved, validation, version);
  }

  async activatePack(kind: OfficialReferenceKind, version: string) {
    const pack = await this.findPack(kind, version);
    if (!pack) throw new OfficialReferenceError(`Version ${version} introuvable pour ${OFFICIAL_REFERENCE_LABELS[kind]}.`, kind);
    const validation = this.adapterFor(kind).validateDraftPack(pack);
    if (!validation.ok) {
      await this.upsertPack({ ...pack, status: "BLOCKED", validationJson: validation });
      throw new OfficialReferenceError(`Version ${version} invalide pour ${OFFICIAL_REFERENCE_LABELS[kind]}.`, kind);
    }
    const activatedAt = new Date();
    await prisma.$transaction([
      prisma.officialReferencePack.updateMany({
        where: { kind, status: "ACTIVE", version: { not: version } },
        data: { status: "ARCHIVED", archivedAt: activatedAt },
      }),
      prisma.officialReferencePack.update({
        where: { kind_version: { kind, version } },
        data: { status: "ACTIVE", activatedAt, archivedAt: null, validationJson: validation },
      }),
    ]);
    return { kind, label: OFFICIAL_REFERENCE_LABELS[kind], version, status: "ACTIVE", activatedAt: activatedAt.toISOString() };
  }

  async getActivePack<TPayload = unknown>(kind: OfficialReferenceKind): Promise<OfficialReferencePack<TPayload>> {
    const pack = await this.findActivePack(kind);
    if (!pack) throw new OfficialReferenceError(`Référentiel ${OFFICIAL_REFERENCE_LABELS[kind]} actif introuvable.`, kind);
    return pack as OfficialReferencePack<TPayload>;
  }

  async listPacks(kind?: OfficialReferenceKind) {
    const rows = await prisma.officialReferencePack.findMany({
      where: kind ? { kind } : undefined,
      orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
      take: kind ? 20 : 100,
    });
    return rows.map(fromDbPack);
  }

  private async bootstrapEmbeddedPack(kind: OfficialReferenceKind) {
    const existing = await this.findActivePack(kind);
    if (existing) return { kind, status: "already_active", version: existing.version };
    const embedded = this.embeddedPacks[kind];
    if (!embedded) throw new OfficialReferenceError(`Référentiel ${kind} introuvable.`, kind);
    const validation = this.adapterFor(kind).validateDraftPack(embedded);
    const status = validation.ok ? "ACTIVE" : "BLOCKED";
    const activatedAt = status === "ACTIVE" ? new Date().toISOString() : undefined;
    await this.upsertPack({ ...embedded, status, activatedAt, validationJson: validation });
    return { kind, status: "bootstrapped", version: embedded.version };
  }

  private adapterFor(kind: OfficialReferenceKind): OfficialReferenceSourceAdapter {
    const adapter = this.adapters.find((candidate) => candidate.kind === kind);
    if (!adapter) throw new OfficialReferenceError(`Adapter de référentiel introuvable pour ${kind}.`, kind);
    return adapter;
  }

  private async findActivePack(kind: OfficialReferenceKind) {
    const row = await prisma.officialReferencePack.findFirst({ where: { kind, status: "ACTIVE" }, orderBy: { activatedAt: "desc" } });
    return row ? fromDbPack(row) : null;
  }

  private async findPack(kind: OfficialReferenceKind, version: string) {
    const row = await prisma.officialReferencePack.findUnique({ where: { kind_version: { kind, version } } });
    return row ? fromDbPack(row) : null;
  }

  private async upsertPack(pack: OfficialReferencePack) {
    const data = toDbPack(pack);
    const { createdAt: _createdAt, ...updateData } = data;
    const row = await prisma.officialReferencePack.upsert({
      where: { kind_version: { kind: pack.kind, version: pack.version } },
      create: data,
      update: updateData,
    });
    return fromDbPack(row);
  }

  private async recordSnapshot(snapshot: OfficialReferenceSnapshot, mode: "sync" | "validate") {
    try {
      await prisma.regulatorySourceSnapshot.create({
        data: {
          source: snapshot.source.toLowerCase(),
          sourceUrl: snapshot.sourceUrl,
          retrievedAt: new Date(snapshot.retrievedAt),
          checksum: snapshot.checksum,
          publishedAt: snapshot.publishedAt ? new Date(snapshot.publishedAt) : null,
          title: snapshot.title,
          rawMetadataJson: {
            ...snapshot.rawMetadataJson,
            officialReferenceKind: snapshot.kind,
            mode,
          },
        },
      });
    } catch {
      // Snapshot tracing is observability. It must never break reference readiness.
    }
  }
}

function buildDefaultAdapters(): OfficialReferenceSourceAdapter[] {
  const packs = buildOfficialReferencePacks();
  return OFFICIAL_REFERENCE_KINDS.map((kind) => {
    if (kind === "chart_of_accounts") return new AncPcgReferenceAdapter(packs[kind]);
    if (kind === "vat" || kind === "fec" || kind === "tax_package_2033" || kind === "tax_package_2050" || kind === "e_invoice") {
      return new ImpotsGovReferenceAdapter(packs[kind]);
    }
    return new InternalQitusReferenceAdapter(packs[kind]);
  });
}

function toDbPack(pack: OfficialReferencePack) {
  return {
    kind: pack.kind,
    version: pack.version,
    status: pack.status,
    source: pack.source,
    sourceUrl: pack.sourceUrl,
    checksum: pack.checksum,
    retrievedAt: new Date(pack.retrievedAt),
    publishedAt: pack.publishedAt ? new Date(pack.publishedAt) : null,
    effectiveFrom: new Date(pack.effectiveFrom),
    activatedAt: pack.activatedAt ? new Date(pack.activatedAt) : null,
    archivedAt: pack.archivedAt ? new Date(pack.archivedAt) : null,
    summary: pack.summary,
    payloadJson: pack.payloadJson as Prisma.InputJsonValue,
    validationJson: pack.validationJson as unknown as Prisma.InputJsonValue,
    createdAt: new Date(),
  };
}

function fromDbPack(row: {
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
}): OfficialReferencePack {
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

function validationResult(pack: OfficialReferencePack, validation: OfficialReferenceValidation, requestedVersion?: string) {
  const errors = [...validation.errors];
  if (requestedVersion && pack.version !== requestedVersion) errors.push(`Version demandée ${requestedVersion}, version contrôlée ${pack.version}.`);
  if (pack.status !== "ACTIVE") errors.push(`Référentiel ${OFFICIAL_REFERENCE_LABELS[pack.kind]} non actif.`);
  if (!pack.sourceUrl) errors.push(`Source absente pour ${OFFICIAL_REFERENCE_LABELS[pack.kind]}.`);
  if (!pack.checksum) errors.push(`Checksum absent pour ${OFFICIAL_REFERENCE_LABELS[pack.kind]}.`);
  return {
    ok: errors.length === 0,
    kind: pack.kind,
    label: OFFICIAL_REFERENCE_LABELS[pack.kind],
    version: pack.version,
    checksum: pack.checksum || officialReferenceChecksum(pack),
    sourceUrl: pack.sourceUrl,
    errors,
    warnings: validation.warnings,
    checkedAt: new Date().toISOString(),
  };
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toDateOnlyOrIso(value: Date) {
  const iso = value.toISOString();
  return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
}
