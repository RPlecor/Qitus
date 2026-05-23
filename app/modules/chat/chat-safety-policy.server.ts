import type { AccountingChatReply } from "./accounting-chat-provider.server";
import type { ChatReference } from "./chat-answer-grounding.server";
import { ChatReadOnlyPolicy, type ChatPolicyDecision } from "./chat-read-only-policy.server";
import { ChatIntentPolicy } from "./chat-intent-policy.server";

export type ChatScopeDecision = ChatPolicyDecision & {
  scope: "qitus_only";
  refusalKind?: "mutation" | "accounting_rules" | "out_of_scope";
};

export class ChatSafetyPolicy {
  constructor(
    private readonly readOnlyPolicy = new ChatReadOnlyPolicy(),
    private readonly intentPolicy = new ChatIntentPolicy()
  ) {}

  evaluateMessage(message: string, references: ChatReference[] = []): ChatScopeDecision {
    const intent = this.intentPolicy.evaluateMessage(message, references);
    if (intent.intent === "accounting_rules_v2") {
      return {
        ...intent,
        scope: "qitus_only",
        refusalKind: "accounting_rules",
      };
    }
    const readOnly = this.readOnlyPolicy.evaluateMessage(message, references);
    if (!readOnly.allowed) return { ...readOnly, scope: "qitus_only", refusalKind: "mutation" };
    return { ...readOnly, scope: "qitus_only" };
  }

  buildBlockedReply(decision: ChatScopeDecision): AccountingChatReply {
    if (decision.refusalKind === "accounting_rules" || decision.refusalKind === "out_of_scope") {
      return {
        content: `${decision.reason ?? "Je peux vous aider à utiliser Qitus, mais pas répondre à cette question en V1."}\n\nJe peux en revanche vous guider vers les écrans Qitus, les actions à réaliser et l'état de votre dossier.`,
        provider: "policy",
        model: "qitus-only",
        metadata: {
          readOnly: true,
          qitusOnly: true,
          refused: true,
          refusalKind: decision.refusalKind,
          matchedIntent: decision.matchedIntent,
          references: decision.suggestedReferences,
        },
      };
    }
    return this.readOnlyPolicy.buildBlockedReply(decision);
  }

  sanitizeAssistantReply(reply: AccountingChatReply, references: ChatReference[]): AccountingChatReply {
    return this.readOnlyPolicy.sanitizeAssistantReply(reply, references);
  }
}
