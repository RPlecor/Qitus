import type { AccountingChatContext, AccountingChatMessage, AccountingChatProvider, AccountingChatReply } from "./accounting-chat-provider.server";
import { ChatHumanLanguagePolicy } from "./chat-human-language-policy.server";
import { normalizeProviderDraft, type ChatAnswerDomain, type ChatProviderDraft } from "./chat-provider-draft.server";
import { ChatReplyGuidanceCenter } from "./chat-reply-guidance-center.server";
import { ChatSafetyPolicy, type ChatScopeDecision } from "./chat-safety-policy.server";
import { ChatUserReplyCenter } from "./chat-user-reply-center.server";
import { QitusKnowledgeCenter, type QitusKnowledgeSource } from "./qitus-knowledge-center.server";

export type ChatResolutionPlan = {
  decision: ChatScopeDecision;
  knowledgeSources: QitusKnowledgeSource[];
  requiresProvider: boolean;
  fallbackReply?: AccountingChatReply;
};

export class ChatResolutionCenter {
  constructor(
    private readonly provider: AccountingChatProvider,
    private readonly safety = new ChatSafetyPolicy(),
    private readonly knowledge = new QitusKnowledgeCenter(),
    private readonly guidance = new ChatReplyGuidanceCenter(),
    private readonly userReplies = new ChatUserReplyCenter(),
    private readonly language = new ChatHumanLanguagePolicy()
  ) {}

  buildPlan(message: string, context: AccountingChatContext): ChatResolutionPlan {
    const decision = this.safety.evaluateMessage(message, context.references);
    if (!decision.allowed) {
      return {
        decision,
        knowledgeSources: [],
        requiresProvider: false,
        fallbackReply: this.safety.buildBlockedReply(decision),
      };
    }
    const knowledgeSources = this.knowledge.search(message, { limit: 3 });
    if (knowledgeSources.length === 0) {
      const outOfScope: ChatScopeDecision = {
        allowed: false,
        reason: "Je peux vous aider à utiliser Qitus. Les questions de règles comptables générales seront couvertes dans une prochaine version.",
        matchedIntent: "out_of_scope_v1",
        suggestedReferences: context.references.filter((reference) => reference.code === "dashboard"),
        scope: "qitus_only",
        refusalKind: "out_of_scope",
      };
      return {
        decision: outOfScope,
        knowledgeSources: [],
        requiresProvider: false,
        fallbackReply: this.safety.buildBlockedReply(outOfScope),
      };
    }
    return { decision, knowledgeSources, requiresProvider: true };
  }

  async resolve(plan: ChatResolutionPlan, history: AccountingChatMessage[], context: AccountingChatContext): Promise<AccountingChatReply> {
    if (plan.fallbackReply) {
      return this.finalizeReply({
        reply: plan.fallbackReply,
        providerDraft: normalizeProviderDraft(plan.fallbackReply),
        decision: plan.decision,
        history,
        knowledgeSources: plan.knowledgeSources,
        references: context.references,
      });
    }
    const providerContext: AccountingChatContext = {
      ...context,
      knowledgeSources: plan.knowledgeSources,
    };
    const reply = await this.provider.reply(history, providerContext);
    const providerDraft = normalizeProviderDraft(reply);
    const safeReply = this.safety.sanitizeAssistantReply({
      ...reply,
      metadata: {
        ...reply.metadata,
        qitusOnly: true,
        knowledgeSources: plan.knowledgeSources,
      },
    }, context.references);
    return this.finalizeReply({
      reply: safeReply,
      providerDraft,
      decision: plan.decision,
      history,
      knowledgeSources: plan.knowledgeSources,
      references: context.references,
    });
  }

  private finalizeReply(input: {
    reply: AccountingChatReply;
    providerDraft: ChatProviderDraft;
    decision: ChatScopeDecision;
    history: AccountingChatMessage[];
    knowledgeSources: QitusKnowledgeSource[];
    references: AccountingChatContext["references"];
    answerDomain?: ChatAnswerDomain;
  }) {
    const userReply = this.userReplies.normalizeReply(input);
    const languageResult = this.language.validateReply(userReply);
    const languageSafeReply = languageResult.ok
      ? userReply
      : this.userReplies.composeSafeFallback(input, {
        languagePolicyFallback: true,
        languagePolicyForbiddenTerms: languageResult.forbiddenTerms,
      });
    const guidedReply = this.guidance.normalizeReply({
      reply: languageSafeReply,
      knowledgeSources: input.knowledgeSources,
      references: input.references,
    });
    this.userReplies.assertUserFacingReply(guidedReply);
    return guidedReply;
  }
}
