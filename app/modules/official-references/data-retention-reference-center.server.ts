import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { DataRetentionReferencePayload } from "./official-reference-data.server";

export class DataRetentionReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  async getActiveReference() {
    return this.references.getActiveReferenceAsync<DataRetentionReferencePayload>("retention");
  }

  async assertReady() {
    await this.references.assertReferenceReadyAsync("purge_data");
  }

  async listPurgeableRules() {
    return [...(await this.getActiveReference()).payloadJson.purgeable];
  }

  async getRetentionDays(kind: string) {
    return (await this.listPurgeableRules()).find((rule) => rule.kind === kind)?.retentionDays ?? null;
  }

  async listProtectedAccountingData() {
    return [...(await this.getActiveReference()).payloadJson.protectedAccountingData];
  }
}
