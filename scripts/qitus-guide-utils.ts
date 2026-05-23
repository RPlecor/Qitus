import { readFileSync } from "node:fs";

export type ParsedGuideSection = {
  sourceId: string;
  title: string;
  content: string;
  href?: string;
  surface: string;
  audience: "user";
  anchor: string;
  wordCount: number;
};

export const GUIDE_PATH = "docs/qitus-guide-utilisateur.md";

export const REQUIRED_SURFACES = [
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

export const FORBIDDEN_VISIBLE_TERMS = [
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

const MARKER_RE = /<!--\s*qitus-guide-section:\s*([^>]+?)\s*-->/g;

export function readCanonicalGuide(path = GUIDE_PATH) {
  return readFileSync(path, "utf8");
}

export function parseGuideSections(markdown: string): ParsedGuideSection[] {
  const markers = [...markdown.matchAll(MARKER_RE)];
  return markers.map((marker, index) => {
    const attrs = parseAttributes(marker[1] ?? "");
    const blockStart = (marker.index ?? 0) + marker[0].length;
    const blockEnd = markers[index + 1]?.index ?? markdown.length;
    const block = markdown.slice(blockStart, blockEnd).trim();
    const title = block.match(/^##\s+(.+)$/m)?.[1]?.trim();
    if (!title) throw new Error(`Section ${attrs.sourceId ?? index} sans titre de niveau 2.`);
    if (!attrs.sourceId || !attrs.surface) throw new Error(`Section ${title} sans sourceId ou surface.`);
    const href = attrs.href;
    return {
      sourceId: attrs.sourceId,
      title,
      content: normalizeContent(block),
      href,
      surface: attrs.surface,
      audience: "user" as const,
      anchor: slugify(title),
      wordCount: wordCount(block),
    };
  });
}

export function buildGeneratedModule(sections: ParsedGuideSection[]) {
  return `import type { QitusUserGuideSection } from "./qitus-knowledge-types";

export const QITUS_USER_GUIDE_SECTIONS: QitusUserGuideSection[] = ${JSON.stringify(sections, null, 2)};
`;
}

export function validateGuide(markdown: string, sections: ParsedGuideSection[]) {
  const issues: string[] = [];
  const surfaces = new Set(sections.map((section) => section.surface));
  for (const surface of REQUIRED_SURFACES) {
    if (!surfaces.has(surface)) issues.push(`Section manquante pour la surface ${surface}.`);
  }
  for (const section of sections) {
    if (!section.href?.startsWith("/")) issues.push(`${section.title}: href manquant ou invalide.`);
    for (const heading of ["### Objectif", "### Quand l'utiliser", "### Champs affichés", "### Statuts possibles", "### Actions disponibles", "### Automatisations", "### Validations utilisateur", "### Erreurs fréquentes"]) {
      if (!section.content.includes(heading)) issues.push(`${section.title}: bloc obligatoire absent ${heading}.`);
    }
  }
  const visible = visibleTextForLanguageValidation(markdown);
  for (const term of FORBIDDEN_VISIBLE_TERMS) {
    const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
    if (re.test(visible)) issues.push(`Terme technique visible interdit: ${term}.`);
  }
  return issues;
}

function parseAttributes(input: string) {
  const attrs: Record<string, string> = {};
  for (const part of input.trim().split(/\s+/)) {
    const [key, ...valueParts] = part.split("=");
    if (key && valueParts.length > 0) attrs[key] = valueParts.join("=");
  }
  return attrs;
}

function normalizeContent(block: string) {
  return block
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function visibleTextForLanguageValidation(markdown: string) {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\]\([^)]+\)/g, "]")
    .replace(/`[^`]*`/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ");
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function wordCount(input: string) {
  return input.split(/\s+/).filter(Boolean).length;
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
