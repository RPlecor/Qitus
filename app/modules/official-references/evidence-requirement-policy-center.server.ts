import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { EvidenceReferencePayload } from "./official-reference-data.server";

export class EvidenceRequirementPolicyCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  getActiveReference() {
    return this.references.getActiveReference<EvidenceReferencePayload>("evidence");
  }

  getRequirementForEntrySource(source: string | null | undefined) {
    const normalized = source ?? "MANUAL";
    return this.getActiveReference().payloadJson.byEntrySource.find((item) => item.source === normalized)
      ?? this.getActiveReference().payloadJson.byEntrySource.find((item) => item.source === "MANUAL")!;
  }

  getWording() {
    return this.getActiveReference().payloadJson.wording;
  }

  isBlockingLevel(level: string) {
    return level === "blocking" || level === "blocking_when_required_by_adjustment";
  }
}
