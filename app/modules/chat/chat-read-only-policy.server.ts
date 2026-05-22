import type { AccountingChatReply } from "./accounting-chat-provider.server";
import type { ChatReference } from "./chat-answer-grounding.server";

export type ChatPolicyDecision = {
  allowed: boolean;
  reason: string | null;
  matchedIntent: string | null;
  suggestedReferences: ChatReference[];
};

const mutationIntents = [
  { intent: "generate_document", pattern: /\b(g[ée]n[èe]re|g[ée]n[ée]rer|cr[ée]e|cr[ée]er).*\b(fec|document|liasse|pdf|[ée]tat)/i, references: ["documents", "controle"] },
  { intent: "correct_transaction", pattern: /\b(corrige|corriger|cat[ée]gorise|cat[ée]goriser|valide|valider).*\b(transaction|cat[ée]gorisation)/i, references: ["transactions"] },
  { intent: "create_entry", pattern: /\b(passe|cr[ée]e|cr[ée]er|valide|valider).*\b([ée]criture|od|journal)/i, references: ["controle", "ecritures"] },
  { intent: "import_file", pattern: /\b(importe|importer|relance|relancer).*\b(csv|import|fichier)/i, references: ["imports"] },
  { intent: "close_fiscal_year", pattern: /\b(cl[ôo]ture|cl[ôo]turer|verrouille|verrouiller|r[ée]ouvre|r[ée]ouvrir).*\b(exercice|cl[ôo]ture)/i, references: ["cloture"] },
  { intent: "billing_action", pattern: /\b(change|changer|ouvre|ouvrir|annule|annuler).*\b(plan|abonnement|stripe|billing)/i, references: ["abonnement"] },
  { intent: "delete_or_mutate", pattern: /\b(supprime|supprimer|efface|effacer|modifie|modifier|mets [àa] jour|update|delete|create|generate|approve|reject)\b/i, references: ["dashboard"] },
];

export class ChatReadOnlyPolicy {
  evaluateMessage(message: string, references: ChatReference[] = []): ChatPolicyDecision {
    const match = mutationIntents.find((intent) => intent.pattern.test(message));
    if (!match) return { allowed: true, reason: null, matchedIntent: null, suggestedReferences: [] };
    return {
      allowed: false,
      reason: "Le chat Qitus est en lecture seule : il peut expliquer et orienter, mais ne déclenche aucune action comptable.",
      matchedIntent: match.intent,
      suggestedReferences: references.filter((reference) => match.references.includes(reference.code)),
    };
  }

  buildBlockedReply(decision: ChatPolicyDecision): AccountingChatReply {
    const links = decision.suggestedReferences.length
      ? `\n\nÉcrans utiles : ${decision.suggestedReferences.map((reference) => `${reference.label} (${reference.href})`).join(", ")}.`
      : "";
    return {
      content: `${decision.reason ?? "Action non autorisée en lecture seule."} Ouvrez l'écran concerné pour confirmer l'action explicitement.${links}`,
      provider: "policy",
      model: "read-only",
      metadata: {
        readOnly: true,
        blockedMutation: true,
        matchedIntent: decision.matchedIntent,
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
