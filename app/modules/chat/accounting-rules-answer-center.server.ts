import type { AccountingChatMessage } from "./accounting-chat-provider.server";
import type { ChatProviderDraft } from "./chat-provider-draft.server";

export class AccountingRulesAnswerCenter {
  answerWithoutSources(messages: AccountingChatMessage[]): ChatProviderDraft {
    const question = messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
    return {
      answerDraft: "Je ne peux pas répondre de façon fiable à cette règle comptable avec les sources disponibles dans Qitus.",
      provider: "qitus-accounting-rules",
      model: "v2-placeholder",
      confidence: 1,
      usedSourceIds: [],
      suggestedRouteHrefs: [],
      refusalReason: question ? "accounting_rules_sources_missing" : "accounting_rules_question_missing",
      rawMetadata: { answerDomain: "accounting_rules" },
    };
  }
}
