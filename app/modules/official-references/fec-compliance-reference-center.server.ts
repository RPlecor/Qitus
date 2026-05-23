import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { FecReferencePayload } from "./official-reference-data.server";

export class FecComplianceReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  getActiveReference() {
    return this.references.getActiveReference<FecReferencePayload>("fec");
  }

  assertReady() {
    this.references.assertReferenceReady("generate_fec");
  }

  getRequiredColumns() {
    return [...this.getActiveReference().payloadJson.columns];
  }

  validateColumns(columns: string[]) {
    const expected = this.getRequiredColumns();
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
