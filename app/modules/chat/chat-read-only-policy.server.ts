import type { AccountingChatReply } from "./accounting-chat-provider.server";
import type { ChatReference } from "./chat-answer-grounding.server";
import { ChatIntentPolicy, type ChatIntentKind } from "./chat-intent-policy.server";

export type ChatPolicyDecision = {
  allowed: boolean;
  reason: string | null;
  matchedIntent: string | null;
  suggestedReferences: ChatReference[];
  intent?: ChatIntentKind;
};

export class ChatReadOnlyPolicy {
  constructor(private readonly intentPolicy = new ChatIntentPolicy()) {}

  evaluateMessage(message: string, references: ChatReference[] = []): ChatPolicyDecision {
    const decision = this.intentPolicy.evaluateMessage(message, references);
    if (decision.allowed || decision.intent !== "mutation_request") {
      return {
        allowed: true,
        reason: null,
        matchedIntent: decision.matchedIntent,
        suggestedReferences: decision.suggestedReferences,
        intent: decision.intent,
      };
    }
    return {
      allowed: false,
      reason: decision.reason,
      matchedIntent: decision.matchedIntent,
      suggestedReferences: decision.suggestedReferences,
      intent: decision.intent,
    };
  }

  buildBlockedReply(decision: ChatPolicyDecision): AccountingChatReply {
    const destination = decision.suggestedReferences[0];
    const actionText = destination
      ? ` Ouvrez ${destination.label} pour faire l’action vous-même.`
      : " Ouvrez la page concernée pour faire l’action vous-même.";
    return {
      content: `${decision.reason ?? "Je ne peux pas lancer cette action depuis le chat."}${actionText}`,
      provider: "policy",
      model: "read-only",
      metadata: {
        readOnly: true,
        blockedMutation: true,
        matchedIntent: decision.matchedIntent,
        intent: decision.intent,
        references: decision.suggestedReferences,
      },
    };
  }

  sanitizeAssistantReply(reply: AccountingChatReply, references: ChatReference[]): AccountingChatReply {
    return {
      ...reply,
      metadata: {
        ...reply.metadata,
        readOnly: true,
        references,
      },
    };
  }
}
