import type { AccountingChatReply } from "./accounting-chat-provider.server";
import type { ChatReference } from "./chat-answer-grounding.server";
import { ChatReadOnlyPolicy, type ChatPolicyDecision } from "./chat-read-only-policy.server";

export type ChatScopeDecision = ChatPolicyDecision & {
  scope: "qitus_only";
  refusalKind?: "mutation" | "accounting_rules" | "out_of_scope";
};

const accountingAdvicePatterns = [
  /\b(quel|quelle|quels|quelles)\s+compte(s)?\s+(pcg|comptable)?\s+(utiliser|choisir|mettre|prendre)\b/i,
  /\b(taux\s+de\s+tva|tva\s+d[ée]ductible|charge\s+d[ée]ductible|amortir|amortissement)\b/i,
  /\b(bofip|cgi|doctrine fiscale|r[èe]gle comptable|plan comptable|pcg)\b/i,
  /\b(comment\s+(d[ée]clarer|comptabiliser|imputer))\b/i,
];

export class ChatSafetyPolicy {
  constructor(private readonly readOnlyPolicy = new ChatReadOnlyPolicy()) {}

  evaluateMessage(message: string, references: ChatReference[] = []): ChatScopeDecision {
    const readOnly = this.readOnlyPolicy.evaluateMessage(message, references);
    if (!readOnly.allowed) return { ...readOnly, scope: "qitus_only", refusalKind: "mutation" };
    if (accountingAdvicePatterns.some((pattern) => pattern.test(message))) {
      return {
        allowed: false,
        reason: "Le chat Qitus V1 répond aux questions d’utilisation de Qitus. Les questions de règles comptables générales seront couvertes en V2.",
        matchedIntent: "accounting_rules_v2",
        suggestedReferences: references.filter((reference) => reference.code === "chat" || reference.code === "dashboard"),
        scope: "qitus_only",
        refusalKind: "accounting_rules",
      };
    }
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
