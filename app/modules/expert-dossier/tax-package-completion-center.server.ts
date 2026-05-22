import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { DocumentFreshnessCenter } from "../documents/document-freshness-center.server";
import { ExpectedRouteError } from "../route-errors.server";
import { TaxPackageDraftCenter } from "../tax-package/tax-package-draft-center.server";

export type TaxPackageCompletion = {
  status: "ready" | "blocked" | "warning";
  label: string;
  sourceDocumentId: string | null;
  sourceFilename: string | null;
  pdfDocumentId: string | null;
  pdfFilename: string | null;
  generatedAt: string | null;
  missingSections: string[];
  warnings: string[];
};

export class TaxPackageCompletionCenter {
  constructor(
    private readonly taxPackage = new TaxPackageDraftCenter(),
    private readonly documentFreshness = new DocumentFreshnessCenter()
  ) {}

  async getTaxPackageCompletion(workspace: CompanyWorkspace): Promise<TaxPackageCompletion> {
    const [summary, freshness] = await Promise.all([
      this.taxPackage.getTaxPackageSummary(workspace),
      this.documentFreshness.getFreshness(workspace),
    ]);
    const sourceFreshness = summary.documentId ? freshness.documents.find((document) => document.documentId === summary.documentId) : null;
    const pdfFreshness = summary.pdfDocumentId ? freshness.documents.find((document) => document.documentId === summary.pdfDocumentId) : null;
    const missingSections = summary.status === "missing" ? ["Source structurée de liasse fiscale"] : [];
    const warnings = [
      ...(!summary.pdfDocumentId ? ["PDF de liasse absent : rendu optionnel non généré."] : []),
      ...(sourceFreshness?.isStale ? ["Source structurée de liasse à régénérer."] : []),
      ...(pdfFreshness?.isStale ? ["PDF de liasse à régénérer."] : []),
    ];
    const blocked = missingSections.length > 0 || Boolean(sourceFreshness?.isStale);
    return {
      status: blocked ? "blocked" : warnings.length > 0 ? "warning" : "ready",
      label: blocked ? "Liasse incomplète" : warnings.length > 0 ? "Liasse prête avec alertes" : "Liasse structurée prête",
      sourceDocumentId: summary.documentId,
      sourceFilename: summary.status === "ready" ? summary.filename : null,
      pdfDocumentId: summary.pdfDocumentId,
      pdfFilename: summary.pdfFilename,
      generatedAt: summary.generatedAt,
      missingSections,
      warnings,
    };
  }

  async listMissingTaxPackageSections(workspace: CompanyWorkspace) {
    return (await this.getTaxPackageCompletion(workspace)).missingSections;
  }

  async assertStructuredTaxPackageReady(workspace: CompanyWorkspace) {
    const completion = await this.getTaxPackageCompletion(workspace);
    if (completion.status === "blocked") throw new ExpectedRouteError(completion.missingSections[0] ?? completion.warnings[0] ?? "Liasse fiscale incomplète.", 409);
    return completion;
  }
}
