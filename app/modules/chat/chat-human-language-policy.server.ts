import type { AccountingChatReply } from "./accounting-chat-provider.server";

export const CHAT_HUMAN_LANGUAGE_FORBIDDEN_TERMS = [
  "Dashboard",
  "Contexte utilisé",
  "Références disponibles",
  "Écrans utiles",
  "Réponse démo Qitus",
  "provider",
  "adapter",
  "mock",
  "fixture",
  "JSON",
  "metadata",
  "sourceId",
  "raw",
];

export type ChatHumanLanguagePolicyResult = {
  ok: boolean;
  forbiddenTerms: string[];
};

export class ChatHumanLanguagePolicy {
  validateReply(reply: AccountingChatReply): ChatHumanLanguagePolicyResult {
    const normalized = reply.content.toLocaleLowerCase("fr-FR");
    const forbiddenTerms = CHAT_HUMAN_LANGUAGE_FORBIDDEN_TERMS.filter((term) => normalized.includes(term.toLocaleLowerCase("fr-FR")));
    return {
      ok: forbiddenTerms.length === 0,
      forbiddenTerms,
    };
  }
}
