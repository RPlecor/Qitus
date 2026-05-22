import { prisma } from "../db.server";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  checksumContent,
  defaultRegulatorySourceAdapters,
  type RegulatorySourceAdapter,
  type RegulatorySourceKey,
} from "./regulatory-source-adapter.server";

export type RegulatorySourceSyncResult = {
  source: RegulatorySourceKey;
  snapshotId?: string;
  changed: boolean;
  checksum?: string;
  error?: string;
};

export class RegulatorySourceCenter {
  constructor(
    private readonly adapters: RegulatorySourceAdapter[] = defaultRegulatorySourceAdapters(),
    private readonly db: PrismaClient = prisma
  ) {}

  async syncOfficialSources(): Promise<RegulatorySourceSyncResult[]> {
    return Promise.all(this.adapters.map((adapter) => this.syncAdapter(adapter)));
  }

  async listSourceSnapshots() {
    return this.db.regulatorySourceSnapshot.findMany({
      orderBy: [{ source: "asc" }, { retrievedAt: "desc" }],
      take: 50,
      include: { changes: true },
    });
  }

  async getLatestSourceSnapshot(source: RegulatorySourceKey | string) {
    return this.db.regulatorySourceSnapshot.findFirst({
      where: { source },
      orderBy: { retrievedAt: "desc" },
      include: { changes: true },
    });
  }

  async detectSourceChanges() {
    const snapshots = await this.listSourceSnapshots();
    return snapshots.flatMap((snapshot) => snapshot.changes);
  }

  private async syncAdapter(adapter: RegulatorySourceAdapter): Promise<RegulatorySourceSyncResult> {
    try {
      const snapshot = await adapter.fetchSnapshot();
      const checksum = checksumContent(snapshot.content);
      const existing = await this.db.regulatorySourceSnapshot.findUnique({
        where: { source_checksum: { source: snapshot.source, checksum } },
      });
      if (existing) return { source: adapter.source, snapshotId: existing.id, changed: false, checksum };

      const created = await this.db.regulatorySourceSnapshot.create({
        data: {
          source: snapshot.source,
          sourceUrl: snapshot.sourceUrl,
          checksum,
          publishedAt: snapshot.publishedAt ?? null,
          title: snapshot.title,
          rawMetadataJson: {
            ...(snapshot.metadata ?? {}),
            contentLength: snapshot.content.length,
            checksum,
          },
          changes: {
            create: {
              changeKey: `${snapshot.source}:${checksum.slice(0, 16)}`,
              severity: snapshot.source === "anc_pcg" ? "INFO" : "WARNING",
              status: "NEW",
              title: snapshot.title,
              summary: snapshot.source === "anc_pcg"
                ? "Publication officielle ANC/PCG détectée. Les règles structurées Qitus peuvent être mises à jour automatiquement."
                : "Changement documentaire officiel détecté. Il est conservé pour revue interne avant transformation en règle exécutable.",
              effectiveFrom: snapshot.publishedAt ?? null,
              sourceUrl: snapshot.sourceUrl,
              metadataJson: (snapshot.metadata ?? {}) as Prisma.InputJsonObject,
            },
          },
        },
      });
      return { source: adapter.source, snapshotId: created.id, changed: true, checksum };
    } catch (error) {
      return {
        source: adapter.source,
        changed: false,
        error: error instanceof Error ? error.message : "Erreur inconnue.",
      };
    }
  }
}
