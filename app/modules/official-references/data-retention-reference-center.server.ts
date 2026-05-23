import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { DataRetentionReferencePayload } from "./official-reference-data.server";

export class DataRetentionReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  getActiveReference() {
    return this.references.getActiveReference<DataRetentionReferencePayload>("retention");
  }

  assertReady() {
    this.references.assertReferenceReady("purge_data");
  }

  listPurgeableRules() {
    return [...this.getActiveReference().payloadJson.purgeable];
  }

  getRetentionDays(kind: string) {
    return this.listPurgeableRules().find((rule) => rule.kind === kind)?.retentionDays ?? null;
  }

  listProtectedAccountingData() {
    return [...this.getActiveReference().payloadJson.protectedAccountingData];
  }
}
