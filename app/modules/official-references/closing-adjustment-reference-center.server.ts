import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { ClosingAdjustmentReferencePayload } from "./official-reference-data.server";

export class ClosingAdjustmentReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  async getActiveReference() {
    return this.references.getActiveReferenceAsync<ClosingAdjustmentReferencePayload>("closing_adjustments");
  }

  async assertReady() {
    await this.references.assertReferenceReadyAsync("approve_closing_adjustment");
  }

  async listTypes() {
    return [...(await this.getActiveReference()).payloadJson.types];
  }

  async getType(kind: string) {
    return (await this.getActiveReference()).payloadJson.types.find((item) => item.kind === kind) ?? null;
  }
}
