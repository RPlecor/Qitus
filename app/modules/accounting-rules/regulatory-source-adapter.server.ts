import { createHash } from "node:crypto";

export type RegulatorySourceKey = "bofip" | "anc_pcg" | "impots_gouv";

export type RegulatorySourceSnapshotInput = {
  source: RegulatorySourceKey;
  sourceUrl: string;
  title: string;
  publishedAt?: Date | null;
  content: string;
  metadata?: Record<string, unknown>;
};

export type RegulatorySourceAdapter = {
  source: RegulatorySourceKey;
  fetchSnapshot(): Promise<RegulatorySourceSnapshotInput>;
};

export class BofipRssRegulatorySourceAdapter implements RegulatorySourceAdapter {
  readonly source = "bofip" as const;
  constructor(private readonly sourceUrl = "https://bofip.impots.gouv.fr/flux-rss") {}

  async fetchSnapshot() {
    const content = await fetchText(this.sourceUrl);
    return {
      source: this.source,
      sourceUrl: this.sourceUrl,
      title: "BOFiP - flux RSS doctrinaux",
      content,
      metadata: { sourceKind: "rss-directory", ambiguity: "textual" },
    };
  }
}

export class AncPcgRegulatorySourceAdapter implements RegulatorySourceAdapter {
  readonly source = "anc_pcg" as const;
  constructor(private readonly sourceUrl = "https://www.anc.gouv.fr/plan-comptable-general") {}

  async fetchSnapshot() {
    const content = await fetchText(this.sourceUrl);
    return {
      source: this.source,
      sourceUrl: this.sourceUrl,
      title: "ANC - Plan comptable général",
      content,
      metadata: { sourceKind: "pcg-publication", structuredForRules: true },
    };
  }
}

export class ImpotsGovDocumentationSourceAdapter implements RegulatorySourceAdapter {
  readonly source = "impots_gouv" as const;
  constructor(private readonly sourceUrl = "https://www.impots.gouv.fr/documentation") {}

  async fetchSnapshot() {
    const content = await fetchText(this.sourceUrl);
    return {
      source: this.source,
      sourceUrl: this.sourceUrl,
      title: "impots.gouv.fr - documentation fiscale",
      content,
      metadata: { sourceKind: "documentation", ambiguity: "textual" },
    };
  }
}

export function defaultRegulatorySourceAdapters(): RegulatorySourceAdapter[] {
  return [
    new BofipRssRegulatorySourceAdapter(),
    new AncPcgRegulatorySourceAdapter(),
    new ImpotsGovDocumentationSourceAdapter(),
  ];
}

export function checksumContent(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Qitus regulatory freshness checker (+https://qitus.fr)",
      accept: "application/rss+xml, application/xml, text/html, text/plain;q=0.9",
    },
  });
  if (!response.ok) throw new Error(`Source réglementaire indisponible (${response.status}) : ${url}`);
  return response.text();
}
