import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";

export type EvidenceSectionKey =
  | "journal"
  | "vat"
  | "expertValidation"
  | "coverage"
  | "attachments"
  | "reconciliations"
  | "closing"
  | "documents";

export type EvidenceSectionResult = {
  sectionKey: EvidenceSectionKey;
  value: unknown;
};

export type EvidenceSectionProvider = {
  sectionKey: EvidenceSectionKey;
  buildSection(workspace: CompanyWorkspace): Promise<unknown>;
};

export async function collectEvidenceSections(workspace: CompanyWorkspace, providers: EvidenceSectionProvider[]): Promise<EvidenceSectionResult[]> {
  const settled = await Promise.all(providers.map(async (provider): Promise<EvidenceSectionResult> => {
    try {
      return { sectionKey: provider.sectionKey, value: await provider.buildSection(workspace) };
    } catch (error) {
      return {
        sectionKey: provider.sectionKey,
        value: {
          error: true,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }));
  return settled;
}
