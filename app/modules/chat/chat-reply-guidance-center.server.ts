import type { AccountingChatReply } from "./accounting-chat-provider.server";
import type { ChatReference } from "./chat-answer-grounding.server";
import type { QitusKnowledgeSource } from "./qitus-knowledge-center.server";

export type ChatReplyAction = {
  label: string;
  href: string;
  kind: "primary" | "secondary";
  source: "markdown" | "reference" | "knowledge";
};

export type ChatReplyGuidanceInput = {
  reply: AccountingChatReply;
  knowledgeSources?: QitusKnowledgeSource[];
  references?: ChatReference[];
};

export class ChatReplyGuidanceCenter {
  normalizeReply(input: ChatReplyGuidanceInput): AccountingChatReply {
    const destinations = buildDestinations(input.references ?? [], input.knowledgeSources ?? []);
    const markdownActions: ChatReplyAction[] = [];
    const withoutMarkdownLinks = input.reply.content.replace(/\*{0,2}\[([^\]]+)]\(([^)\s]+)\)\*{0,2}/g, (_match, rawLabel: string, href: string) => {
      const destination = destinations.find((candidate) => candidate.href === href);
      if (destination) {
        markdownActions.push(actionFor(destination.label, destination.href, "markdown"));
      }
      return rawLabel.trim();
    });
    const parenthesizedActions: ChatReplyAction[] = [];
    const withoutParenthesizedLinks = withoutMarkdownLinks.replace(/(^|[:;,]\s*)([^:;,\n.()]+?)\s+\((\/[^)\s]+)\)/g, (_match, prefix: string, rawLabel: string, href: string) => {
      const destination = destinations.find((candidate) => candidate.href === href);
      if (destination) parenthesizedActions.push(actionFor(destination.label, destination.href, "reference"));
      return `${prefix}${rawLabel.trim()}`;
    });
    const cleanContent = cleanMarkdownText(withoutParenthesizedLinks);
    const detectedActions = detectNavigationActions(cleanContent, destinations);
    const fallbackActions = markdownActions.length === 0 && parenthesizedActions.length === 0 && detectedActions.length === 0
      ? knowledgeFallbackActions(input.knowledgeSources ?? [])
      : [];
    const actions = normalizeActions([...markdownActions, ...parenthesizedActions, ...detectedActions, ...fallbackActions]);
    return {
      ...input.reply,
      content: cleanContent,
      metadata: {
        ...input.reply.metadata,
        actions,
      },
    };
  }
}

type ChatDestination = {
  label: string;
  href: string;
  aliases: string[];
  source: "reference" | "knowledge";
};

const STATIC_DESTINATIONS: ChatDestination[] = [
  destination("Tableau de bord", "/dashboard", ["tableau de bord", "accueil"]),
  destination("Imports", "/imports", ["imports", "import"]),
  destination("Transactions", "/transactions", ["transactions", "transaction"]),
  destination("Justificatifs", "/pieces", ["justificatifs", "pièces", "pieces"]),
  destination("Factures entrantes", "/factures-entrantes", ["factures entrantes", "factures"]),
  destination("Écritures", "/ecritures", ["écritures", "ecritures", "journal"]),
  destination("TVA", "/tva", ["tva"]),
  destination("Rapprochements", "/rapprochements", ["rapprochements", "rapprochement"]),
  destination("Contrôle", "/controle", ["contrôle", "controle"]),
  destination("Clôture", "/cloture", ["clôture", "cloture"]),
  destination("OD de clôture", "/cloture/od", ["od de clôture", "od de cloture", "od"]),
  destination("Documents", "/documents", ["documents", "fec"]),
  destination("Dossier expert-comptable", "/dossier-ec", ["dossier expert-comptable", "dossier ec"]),
  destination("Paramètres", "/parametres", ["paramètres", "parametres", "réglages", "reglages"]),
  destination("Connecteurs", "/connecteurs", ["connecteurs", "connecteur", "qonto bancaire", "stripe", "open banking"]),
  destination("Abonnement", "/abonnement", ["abonnement", "quota", "plan"]),
  destination("Aide", "/chat", ["aide", "assistant qitus", "chat"]),
];

const NAVIGATION_VERBS = [
  "allez dans",
  "aller dans",
  "ouvrez",
  "ouvrir",
  "rendez-vous dans",
  "rendez vous dans",
  "consultez",
  "vérifiez",
  "verifiez",
  "cliquez sur",
  "accédez à",
  "accedez a",
];

function buildDestinations(references: ChatReference[], knowledgeSources: QitusKnowledgeSource[]): ChatDestination[] {
  const candidates = [
    ...STATIC_DESTINATIONS,
    ...references.map((reference) => destination(reference.label, reference.href, [reference.label], "reference")),
    ...knowledgeSources.flatMap((source) => source.href ? [destination(source.title, source.href, [source.title, source.surface], "knowledge")] : []),
  ];
  return uniqueByHref(candidates);
}

function detectNavigationActions(content: string, destinations: ChatDestination[]): ChatReplyAction[] {
  const normalizedContent = normalize(content);
  const actions: Array<{ action: ChatReplyAction; position: number }> = [];
  for (const destination of destinations) {
    if (!isInternalHref(destination.href)) continue;
    const positions = destination.aliases.flatMap((alias) => {
      const normalizedAlias = normalize(alias);
      return NAVIGATION_VERBS
        .map((verb) => normalizedContent.indexOf(`${normalize(verb)} ${normalizedAlias}`))
        .filter((position) => position >= 0);
    });
    if (positions.length > 0) {
      actions.push({ action: actionFor(destination.label, destination.href, destination.source), position: Math.min(...positions) });
    }
  }
  return actions.sort((a, b) => a.position - b.position).map((item) => item.action);
}

function knowledgeFallbackActions(sources: QitusKnowledgeSource[]): ChatReplyAction[] {
  return sources
    .filter((source) => source.href && isInternalHref(source.href))
    .slice(0, 1)
    .map((source) => actionFor(source.title, source.href as string, "knowledge"));
}

function cleanMarkdownText(content: string) {
  return content
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])_([^_\n]+)_/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeActions(actions: ChatReplyAction[]) {
  const seen = new Set<string>();
  const unique = actions.filter((action) => {
    if (!isInternalHref(action.href) || seen.has(action.href)) return false;
    seen.add(action.href);
    return true;
  });
  return unique.map((action, index) => ({ ...action, kind: index === 0 ? "primary" as const : "secondary" as const }));
}

function actionFor(label: string, href: string, source: ChatReplyAction["source"]): ChatReplyAction {
  const cleanLabel = cleanMarkdownText(label).replace(/^ouvrir\s+/i, "");
  return {
    label: `Ouvrir ${cleanLabel}`,
    href,
    kind: "secondary",
    source,
  };
}

function destination(label: string, href: string, aliases: string[], source: "reference" | "knowledge" = "reference"): ChatDestination {
  return {
    label,
    href,
    aliases: unique([label, ...aliases]),
    source,
  };
}

function uniqueByHref(destinations: ChatDestination[]) {
  const byHref = new Map<string, ChatDestination>();
  for (const item of destinations) {
    if (!isInternalHref(item.href)) continue;
    const existing = byHref.get(item.href);
    if (existing) {
      byHref.set(item.href, { ...existing, aliases: unique([...existing.aliases, ...item.aliases]) });
    } else {
      byHref.set(item.href, item);
    }
  }
  return [...byHref.values()];
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isInternalHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}
