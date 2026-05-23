import type { AccountingChatReply } from "./accounting-chat-provider.server";
import type { QitusKnowledgeSource } from "./qitus-knowledge-center.server";

export type ChatAnswerDomain = "qitus_usage" | "accounting_rules";

export type ChatProviderDraft = {
  answerDraft: string;
  provider: string;
  model: string;
  confidence: number;
  usedSourceIds: string[];
  suggestedRouteHrefs: string[];
  refusalReason?: string;
  rawMetadata?: Record<string, unknown>;
};

export function normalizeProviderDraft(reply: AccountingChatReply): ChatProviderDraft {
  return {
    answerDraft: reply.content,
    provider: reply.provider,
    model: reply.model,
    confidence: typeof reply.metadata?.confidence === "number" ? clampConfidence(reply.metadata.confidence) : 1,
    usedSourceIds: extractSourceIds(reply.metadata),
    suggestedRouteHrefs: extractInternalHrefs(reply.content),
    refusalReason: typeof reply.metadata?.refusalReason === "string" ? reply.metadata.refusalReason : undefined,
    rawMetadata: reply.metadata,
  };
}

function extractSourceIds(metadata: Record<string, unknown> | undefined) {
  const sources = metadata?.knowledgeSources ?? metadata?.sources;
  if (!Array.isArray(sources)) return [];
  return sources
    .map((source) => source && typeof source === "object" && "sourceId" in source && typeof source.sourceId === "string" ? source.sourceId : null)
    .filter((sourceId): sourceId is string => Boolean(sourceId));
}

function extractInternalHrefs(content: string) {
  return unique([
    ...Array.from(content.matchAll(/\[[^\]]+]\((\/[^)\s]+)\)/g)).map((match) => match[1]),
    ...Array.from(content.matchAll(/\s\(\/[^)\s]+\)/g)).map((match) => match[0].trim().slice(1, -1)),
  ].filter((href) => href.startsWith("/") && !href.startsWith("//")));
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

export function sourceCitationMetadata(sources: QitusKnowledgeSource[]) {
  return sources.map((source) => ({
    sourceId: source.sourceId,
    title: source.title,
    href: source.href,
    surface: source.surface,
  }));
}
