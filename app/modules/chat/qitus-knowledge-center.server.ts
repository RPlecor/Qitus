import { QitusUserGuideCenter } from "./qitus-user-guide-center.server";
import type { QitusKnowledgeSource } from "./qitus-knowledge-types";

export type { QitusKnowledgeSource } from "./qitus-knowledge-types";

const STOP_WORDS = new Set(["dans", "pour", "avec", "sans", "quoi", "quel", "quelle", "quels", "quelles", "mon", "mes", "une", "des", "les", "est", "sont", "sur", "qitus", "comment", "pourquoi"]);

export class QitusKnowledgeCenter {
  constructor(private readonly guide = new QitusUserGuideCenter()) {}

  search(question: string, options: { limit?: number; minScore?: number } = {}): QitusKnowledgeSource[] {
    const terms = tokenize(question);
    if (terms.length === 0) return [];
    const scored = this.guide.buildKnowledgeSources()
      .map((source) => ({ source, score: scoreSource(source, terms) }))
      .filter((item) => item.score >= (options.minScore ?? 1))
      .sort((a, b) => b.score - a.score || a.source.title.localeCompare(b.source.title));
    return scored.slice(0, options.limit ?? 3).map((item) => item.source);
  }

  listSources() {
    return this.guide.buildKnowledgeSources();
  }
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));
}

function scoreSource(source: QitusKnowledgeSource, terms: string[]) {
  const haystack = `${source.title} ${source.surface} ${source.content} ${source.href ?? ""}`.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return terms.reduce((score, term) => score + (haystack.includes(term) ? (source.surface.includes(term) ? 4 : 1) : 0), 0);
}
