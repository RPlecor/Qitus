import { prisma } from "~/modules/db.server";
import { isOfficialReferenceKind } from "./official-reference-data.server";
import { OfficialReferenceActivationWorkflow } from "./official-reference-activation-workflow.server";
import { OfficialReferenceRuntimeCenter } from "./official-reference-runtime-center.server";
import {
  OFFICIAL_REFERENCE_KINDS,
  type OfficialReferenceCapability,
  type OfficialReferenceKind,
  type OfficialReferencePack,
  type OfficialReferenceReadiness,
} from "./official-reference-types";

export class OfficialReferenceCenter {
  private readonly workflow = new OfficialReferenceActivationWorkflow();
  private readonly runtime = new OfficialReferenceRuntimeCenter();

  async syncAllOfficialReferences() {
    await this.workflow.bootstrapEmbeddedPacks();
    const results = await Promise.all(OFFICIAL_REFERENCE_KINDS.map((kind) => this.syncReference(kind)));
    return { syncedAt: new Date().toISOString(), results };
  }

  async syncReference(kind: OfficialReferenceKind) {
    return this.workflow.syncReference(kind);
  }

  async bootstrapEmbeddedReferences() {
    return this.workflow.bootstrapEmbeddedPacks();
  }

  async getActiveReferenceAsync<TPayload = unknown>(kind: OfficialReferenceKind): Promise<OfficialReferencePack<TPayload>> {
    return this.runtime.getActivePack<TPayload>(kind);
  }

  async listReferencePacks(kind?: OfficialReferenceKind) {
    return this.workflow.listPacks(kind);
  }

  async listReferenceSnapshots(kind?: OfficialReferenceKind) {
    const snapshots = await prisma.regulatorySourceSnapshot.findMany({
      where: kind ? { rawMetadataJson: { path: ["officialReferenceKind"], equals: kind } } : undefined,
      orderBy: { retrievedAt: "desc" },
      take: 50,
      include: { changes: true },
    });
    return snapshots;
  }

  async validateReferencePackAsync(kind: OfficialReferenceKind, version?: string) {
    return this.runtime.validatePack(kind, version);
  }

  async assertReferenceReadyAsync(capability: OfficialReferenceCapability) {
    return this.runtime.assertCapabilityReady(capability);
  }

  async activateReferencePack(kind: OfficialReferenceKind, version: string) {
    return this.workflow.activatePack(kind, version);
  }

  async getReferenceReadinessAsync(): Promise<OfficialReferenceReadiness> {
    return this.runtime.getReadiness();
  }

  isKnownKind(value: string | undefined): value is OfficialReferenceKind {
    return isOfficialReferenceKind(value);
  }

}
