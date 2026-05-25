import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { FecReferencePayload } from "./official-reference-data.server";

export class FecComplianceReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  async getActiveReference() {
    return this.references.getActiveReferenceAsync<FecReferencePayload>("fec");
  }

  async assertReady() {
    await this.references.assertReferenceReadyAsync("generate_fec");
  }

  async getRequiredColumns() {
    return [...(await this.getActiveReference()).payloadJson.columns];
  }

  async validateColumns(columns: string[]) {
    const expected = await this.getRequiredColumns();
    const missing = expected.filter((column) => !columns.includes(column));
    const wrongOrder = missing.length === 0 && expected.some((column, index) => columns[index] !== column);
    return {
      ok: missing.length === 0 && !wrongOrder,
      missing,
      wrongOrder,
      expected,
    };
  }
}
