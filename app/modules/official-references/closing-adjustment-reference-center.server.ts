import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { ClosingAdjustmentReferencePayload } from "./official-reference-data.server";

export class ClosingAdjustmentReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  getActiveReference() {
    return this.references.getActiveReference<ClosingAdjustmentReferencePayload>("closing_adjustments");
  }

  assertReady() {
    this.references.assertReferenceReady("approve_closing_adjustment");
  }

  listTypes() {
    return [...this.getActiveReference().payloadJson.types];
  }

  getType(kind: string) {
    return this.getActiveReference().payloadJson.types.find((item) => item.kind === kind) ?? null;
  }
}
