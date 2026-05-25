import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { EvidenceReferencePayload } from "./official-reference-data.server";

export class EvidenceRequirementPolicyCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  async getActiveReference() {
    return this.references.getActiveReferenceAsync<EvidenceReferencePayload>("evidence");
  }

  async getRequirementForEntrySource(source: string | null | undefined) {
    const payload = (await this.getActiveReference()).payloadJson;
    const normalized = source ?? "MANUAL";
    return payload.byEntrySource.find((item) => item.source === normalized)
      ?? payload.byEntrySource.find((item) => item.source === "MANUAL")!;
  }

  async getWording() {
    return (await this.getActiveReference()).payloadJson.wording;
  }

  isBlockingLevel(level: string) {
    return level === "blocking" || level === "blocking_when_required_by_adjustment";
  }
}
