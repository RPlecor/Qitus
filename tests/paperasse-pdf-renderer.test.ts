import { describe, expect, it } from "vitest";
import { PaperassePdfRenderer } from "../app/modules/tax-package/paperasse-pdf-renderer.server";

describe("PaperassePdfRenderer", () => {
  it("returns a non-blocking disabled result when PDF generation is not enabled", async () => {
    const previous = process.env.ENABLE_PDF_GENERATION;
    delete process.env.ENABLE_PDF_GENERATION;
    const result = await new PaperassePdfRenderer().renderPdfFromStructuredSource({
      companyId: "company_1",
      jobId: "job_1",
      company: {
        name: "ACME",
        legalForm: "SASU",
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        vatRegime: "FRANCHISE",
        bankAccounts: [],
      },
      entries: [],
      sourceMarkdown: "# Liasse",
    });
    if (previous === undefined) delete process.env.ENABLE_PDF_GENERATION;
    else process.env.ENABLE_PDF_GENERATION = previous;

    expect(result).toMatchObject({ status: "disabled" });
  });
});
