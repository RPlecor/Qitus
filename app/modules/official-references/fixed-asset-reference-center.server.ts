import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { FixedAssetReferencePayload } from "./official-reference-data.server";

export class FixedAssetReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  async getActiveReference() {
    return this.references.getActiveReferenceAsync<FixedAssetReferencePayload>("fixed_assets");
  }

  async assertReady() {
    await this.references.assertReferenceReadyAsync("calculate_fixed_assets");
  }

  async listFamilies() {
    return [...(await this.getActiveReference()).payloadJson.families];
  }

  async getDefaultFamily() {
    const families = await this.listFamilies();
    return families.find((family) => family.key === "office_it") ?? families[0];
  }

  validateUsefulLifeYears(value: number) {
    return Number.isFinite(value) && value > 0 && value <= 50;
  }
}
