import { describe, expect, it } from "vitest";
import { normalizeFiscalYearInput } from "../app/modules/fiscal-years/fiscal-year-center.server";

describe("FiscalYearCenter", () => {
  it("normalizes valid fiscal year dates", () => {
    const input = normalizeFiscalYearInput({ startDate: "2026-01-01", endDate: "2026-12-31" });

    expect(input.startDate.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(input.endDate.toISOString().slice(0, 10)).toBe("2026-12-31");
  });

  it("rejects invalid fiscal year dates", () => {
    expect(() => normalizeFiscalYearInput({ startDate: "nope", endDate: "2026-12-31" })).toThrow("Dates d'exercice invalides");
  });
});
