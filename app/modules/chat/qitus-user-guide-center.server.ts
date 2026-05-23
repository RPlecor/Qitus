import { QITUS_USER_GUIDE_SECTIONS } from "./qitus-knowledge.generated";
import type { QitusKnowledgeSource, QitusUserGuideSection } from "./qitus-knowledge-types";

export type GuideCoverageIssue = {
  code: string;
  message: string;
  surface?: string;
};

export class QitusUserGuideCenter {
  listGuideSections(): QitusUserGuideSection[] {
    return [...QITUS_USER_GUIDE_SECTIONS];
  }

  getSectionBySurface(surface: string): QitusUserGuideSection | null {
    return QITUS_USER_GUIDE_SECTIONS.find((section) => section.surface === surface) ?? null;
  }

  buildKnowledgeSources(): QitusKnowledgeSource[] {
    return QITUS_USER_GUIDE_SECTIONS.map(({ wordCount: _wordCount, ...source }) => source);
  }

  validateGuideCoverage(requiredSurfaces = REQUIRED_USER_GUIDE_SURFACES): GuideCoverageIssue[] {
    const surfaces = new Set(QITUS_USER_GUIDE_SECTIONS.map((section) => section.surface));
    return requiredSurfaces
      .filter((surface) => !surfaces.has(surface))
      .map((surface) => ({
        code: "missing_surface",
        surface,
        message: `Section guide manquante pour ${surface}.`,
      }));
  }

  validateUserFacingLanguage(): GuideCoverageIssue[] {
    const issues: GuideCoverageIssue[] = [];
    for (const section of QITUS_USER_GUIDE_SECTIONS) {
      const visible = visibleText(section.content);
      for (const term of FORBIDDEN_USER_GUIDE_TERMS) {
        const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
        if (re.test(visible)) {
          issues.push({
            code: "forbidden_visible_term",
            surface: section.surface,
            message: `${section.title}: terme technique visible interdit (${term}).`,
          });
        }
      }
    }
    return issues;
  }
}

export const REQUIRED_USER_GUIDE_SURFACES = [
  "dashboard",
  "imports",
  "transactions",
  "pieces",
  "factures-entrantes",
  "ecritures",
  "tva",
  "rapprochements",
  "controle",
  "cloture",
  "cloture-od",
  "immobilisations",
  "documents",
  "dossier-ec",
  "parametres",
  "connecteurs",
  "corrections",
  "regles-comptables",
  "abonnement",
  "exercices",
  "profil",
  "activity",
  "chat",
] as const;

const FORBIDDEN_USER_GUIDE_TERMS = [
  "dashboard",
  "mapping",
  "mock",
  "fixture",
  "adapter",
  "provider",
  "stale",
  "parse",
  "manifest",
  "checksum",
  "runtime",
  "workpaper",
] as const;

function visibleText(markdown: string) {
  return markdown
    .replace(/\]\([^)]+\)/g, "]")
    .replace(/`[^`]*`/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ");
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
