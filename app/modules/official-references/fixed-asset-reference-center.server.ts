import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { FixedAssetReferencePayload } from "./official-reference-data.server";

export class FixedAssetReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  getActiveReference() {
    return this.references.getActiveReference<FixedAssetReferencePayload>("fixed_assets");
  }

  assertReady() {
    this.references.assertReferenceReady("calculate_fixed_assets");
  }

  listFamilies() {
    return [...this.getActiveReference().payloadJson.families];
  }

  getDefaultFamily() {
    return this.listFamilies().find((family) => family.key === "office_it") ?? this.listFamilies()[0];
  }

  validateUsefulLifeYears(value: number) {
    return Number.isFinite(value) && value > 0 && value <= 50;
  }
}
