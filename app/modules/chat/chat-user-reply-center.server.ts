import type { AccountingChatMessage, AccountingChatReply } from "./accounting-chat-provider.server";
import type { ChatReference } from "./chat-answer-grounding.server";
import type { ChatScopeDecision } from "./chat-safety-policy.server";
import type { QitusKnowledgeSource } from "./qitus-knowledge-center.server";

export const CHAT_USER_FORBIDDEN_TERMS = [
  "Dashboard",
  "Contexte utilisé",
  "Références disponibles",
  "Écrans utiles",
  "Réponse démo Qitus",
  "provider",
  "adapter",
  "mock",
  "fixture",
];

export type ChatUserReplyInput = {
  reply: AccountingChatReply;
  decision: ChatScopeDecision;
  history: AccountingChatMessage[];
  knowledgeSources: QitusKnowledgeSource[];
  references: ChatReference[];
};

export class ChatUserReplyCenter {
  normalizeReply(input: ChatUserReplyInput): AccountingChatReply {
    const question = input.history.filter((message) => message.role === "user").at(-1)?.content ?? "";
    const content = this.shouldCompose(input, question)
      ? composeNaturalReply(question, input)
      : sanitizeUserFacingText(input.reply.content, input.references);
    return {
      ...input.reply,
      content,
      metadata: {
        ...input.reply.metadata,
        intent: input.decision.intent,
      },
    };
  }

  assertUserFacingReply(reply: AccountingChatReply) {
    const forbidden = CHAT_USER_FORBIDDEN_TERMS.filter((term) => reply.content.includes(term));
    if (forbidden.length > 0) {
      throw new Error(`Chat reply contains forbidden user-facing term(s): ${forbidden.join(", ")}`);
    }
  }

  private shouldCompose(input: ChatUserReplyInput, question: string) {
    if (input.reply.provider === "fake" || input.reply.provider === "policy") return true;
    if (input.decision.refusalKind) return true;
    if (hasInternalLink(input.reply.content)) return false;
    return mentionsImportCsv(question) || mentionsCategorization(question) || mentionsEvidence(question) || mentionsVatZero(question) || mentionsConnectors(question);
  }
}

function composeNaturalReply(question: string, input: ChatUserReplyInput) {
  if (input.decision.refusalKind === "accounting_rules" || input.decision.refusalKind === "out_of_scope") {
    return [
      input.decision.reason ?? "Je peux vous aider à utiliser Qitus, mais pas répondre à cette question en V1.",
      "Je peux en revanche vous guider dans Qitus : Tableau de bord, Imports, Transactions, Justificatifs, TVA, Contrôle ou Documents.",
    ].join("\n");
  }

  if (input.decision.refusalKind === "mutation") {
    const [primary, secondary] = input.decision.suggestedReferences;
    if (!primary) return "Je ne peux pas lancer cette action depuis le chat. Ouvrez la page concernée pour faire l’action vous-même.";
    const secondaryText = secondary ? ` Si un prérequis bloque l’action, ouvrez ${secondary.label}.` : "";
    return `Je ne peux pas lancer cette action depuis le chat. Ouvrez ${primary.label} pour faire l’action vous-même.${secondaryText}`;
  }

  if (mentionsImportCsv(question)) {
    return "Pour importer un relevé CSV, ouvrez Imports, puis ajoutez votre fichier. Si Qitus ne reconnaît pas les colonnes automatiquement, il vous proposera de faire la correspondance avant de continuer.";
  }

  if (mentionsCategorization(question)) {
    return "Pour relancer la catégorisation, ouvrez Imports, puis utilisez l’action Relancer la catégorisation sur l’import concerné.";
  }

  if (mentionsEvidence(question)) {
    return [
      "Pour rattacher un justificatif, ouvrez Justificatifs ou ouvrez Transactions pour partir de la transaction concernée.",
      "Depuis une transaction, utilisez l’action Rattacher un justificatif. Depuis Justificatifs, ajoutez la pièce puis rattachez-la à une transaction ou à une écriture.",
    ].join("\n");
  }

  if (mentionsVatZero(question)) {
    return "Si la TVA est à zéro, ouvrez TVA pour vérifier le diagnostic. Si Qitus indique que les écritures doivent être recalculées, ouvrez Imports pour relancer la catégorisation de l’import concerné.";
  }

  if (mentionsConnectors(question)) {
    return "Pour configurer une banque, Qonto ou Stripe, ouvrez Connecteurs. Qitus vous indiquera les connexions disponibles et celles qui demandent une configuration.";
  }

  const source = input.knowledgeSources.find((item) => item.href);
  if (source) {
    return `Pour cette question, ouvrez ${source.title}. Vous y trouverez les informations et les actions utiles pour avancer dans Qitus.`;
  }

  return "Je peux vous aider à comprendre où agir dans Qitus et quoi vérifier ensuite. Ouvrez Tableau de bord pour voir les prochaines actions recommandées.";
}

function sanitizeUserFacingText(content: string, references: ChatReference[]) {
  const withoutDebugLines = content
    .split("\n")
    .filter((line) => !/^\s*(Réponse démo Qitus|Contexte utilisé|Références disponibles)/.test(line))
    .join("\n");
  return withoutDebugLines
    .replace(/\bDashboard\b/g, "Tableau de bord")
    .replace(/Écrans utiles\s*:\s*([^.]+)\./g, (_match, labels: string) => `Ouvrez ${firstKnownLabel(labels, references)} pour continuer.`)
    .replace(/provider/gi, "connecteur")
    .replace(/adapter/gi, "connecteur")
    .replace(/mock|fixture/gi, "test")
    .trim();
}

function firstKnownLabel(value: string, references: ChatReference[]) {
  const labels = value.split(",").map((item) => item.replace(/\([^)]*\)/g, "").trim()).filter(Boolean);
  const known = labels.find((label) => references.some((reference) => reference.label === label));
  return known ?? labels[0] ?? "la page concernée";
}

function mentionsImportCsv(question: string) {
  return /\b(csv|relev[ée]|fichier).*\b(import|importer|ajouter|d[ée]poser)|\b(import|importer).*\b(csv|relev[ée]|fichier)\b/i.test(question);
}

function mentionsCategorization(question: string) {
  return /\b(cat[ée]gorisation|cat[ée]goriser|classer|classement).*\b(relancer|rejouer|recalculer|corriger)|\b(relancer|rejouer|recalculer|corriger).*\b(cat[ée]gorisation|cat[ée]goriser|classer|classement)\b/i.test(question);
}

function mentionsEvidence(question: string) {
  return /\b(justificatif|justificatifs|pi[eè]ce|pi[eè]ces|rattacher|attacher)\b/i.test(question);
}

function mentionsVatZero(question: string) {
  return /\b(tva).*\b(z[ée]ro|0|rien|vide)|\b(z[ée]ro|0|rien|vide).*\b(tva)\b/i.test(question);
}

function mentionsConnectors(question: string) {
  return /\b(connecteur|connecteurs|qonto|stripe|banque|open banking)\b/i.test(question);
}

function hasInternalLink(content: string) {
  return /\[[^\]]+]\(\/[^)\s]+\)/.test(content) || /\s\(\/[^)\s]+\)/.test(content);
}
