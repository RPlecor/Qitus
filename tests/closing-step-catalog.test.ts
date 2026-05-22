import { describe, expect, it } from "vitest";
import { CLOSING_STEP_CATALOG, CLOSING_STEP_CODES } from "../app/modules/annual-closing/closing-step-catalog.server";

describe("ClosingStepCatalog", () => {
  it("exposes the 12 annual closing steps in a stable order", () => {
    expect(CLOSING_STEP_CATALOG).toHaveLength(12);
    expect(CLOSING_STEP_CATALOG.map((step) => step.code)).toEqual(CLOSING_STEP_CODES);
    expect(CLOSING_STEP_CATALOG[0]).toMatchObject({ code: "BALANCE_CHECK", index: 1 });
    expect(CLOSING_STEP_CATALOG[11]).toMatchObject({ code: "EXPORT_ARCHIVE", index: 12 });
  });
});
