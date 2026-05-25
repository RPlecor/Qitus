import { officialReferenceChecksum, type OfficialReferenceKind, type OfficialReferencePack, type OfficialReferenceSnapshot, type OfficialReferenceSource, type OfficialReferenceSourceAdapter, type OfficialReferenceValidation } from "./official-reference-types";

type AdapterSource = "impots_gouv" | "anc_pcg" | "internal_qitus";

export class EmbeddedOfficialReferenceAdapter implements OfficialReferenceSourceAdapter {
  readonly kind: OfficialReferenceKind;
  readonly source: OfficialReferenceSource;

  constructor(private readonly pack: OfficialReferencePack, private readonly adapterSource: AdapterSource) {
    this.kind = pack.kind;
    this.source = pack.source;
  }

  async fetchSnapshot(): Promise<OfficialReferenceSnapshot> {
    const liveChecksum = process.env.QITUS_OFFICIAL_REFERENCE_LIVE_FETCH === "true"
      ? await fetchSourceChecksum(this.pack.sourceUrl).catch(() => null)
      : null;
    const checksum = liveChecksum ?? this.pack.checksum;
    return {
      kind: this.pack.kind,
      source: this.pack.source,
      sourceUrl: this.pack.sourceUrl,
      retrievedAt: new Date().toISOString(),
      checksum,
      publishedAt: this.pack.publishedAt,
      title: `${this.pack.kind} ${this.pack.version}`,
      rawMetadataJson: {
        officialReferenceKind: this.pack.kind,
        referenceVersion: this.pack.version,
        sourcePackChecksum: this.pack.checksum,
        adapterSource: this.adapterSource,
        liveFetch: Boolean(liveChecksum),
      },
    };
  }

  async buildDraftPack(snapshot: OfficialReferenceSnapshot): Promise<OfficialReferencePack> {
    const sourceChanged = snapshot.checksum !== this.pack.checksum;
    return {
      ...this.pack,
      version: sourceChanged ? `${this.pack.version}-source-${snapshot.checksum.slice(0, 8)}` : this.pack.version,
      status: sourceChanged ? "NEEDS_REVIEW" : this.pack.status,
      retrievedAt: snapshot.retrievedAt,
      publishedAt: snapshot.publishedAt ?? this.pack.publishedAt,
      checksum: sourceChanged ? officialReferenceChecksum({
        kind: this.pack.kind,
        version: this.pack.version,
        sourceChecksum: snapshot.checksum,
        payloadChecksum: this.pack.checksum,
      }) : this.pack.checksum,
      validationJson: this.validateDraftPack(this.pack),
    };
  }

  validateDraftPack(pack: OfficialReferencePack): OfficialReferenceValidation {
    return pack.validationJson;
  }
}

export class ImpotsGovReferenceAdapter extends EmbeddedOfficialReferenceAdapter {
  constructor(pack: OfficialReferencePack) {
    super(pack, "impots_gouv");
  }
}

export class AncPcgReferenceAdapter extends EmbeddedOfficialReferenceAdapter {
  constructor(pack: OfficialReferencePack) {
    super(pack, "anc_pcg");
  }
}

export class InternalQitusReferenceAdapter extends EmbeddedOfficialReferenceAdapter {
  constructor(pack: OfficialReferencePack) {
    super(pack, "internal_qitus");
  }
}

export function adapterSourceForKind(kind: OfficialReferenceKind): AdapterSource {
  if (kind === "chart_of_accounts") return "anc_pcg";
  if (kind === "vat" || kind === "fec" || kind === "tax_package_2033" || kind === "tax_package_2050" || kind === "e_invoice") return "impots_gouv";
  return "internal_qitus";
}

async function fetchSourceChecksum(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.arrayBuffer();
    return officialReferenceChecksum({ url, body: Buffer.from(body).toString("base64") });
  } finally {
    clearTimeout(timeout);
  }
}
