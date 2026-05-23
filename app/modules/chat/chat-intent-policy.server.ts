import type { ChatReference } from "./chat-answer-grounding.server";

export type ChatIntentKind =
  | "navigation_help"
  | "how_to"
  | "explain_status"
  | "mutation_request"
  | "accounting_rules_v2"
  | "out_of_scope_v1"
  | "qitus_question";

export type ChatIntentDecision = {
  intent: ChatIntentKind;
  allowed: boolean;
  matchedIntent: string | null;
  reason: string | null;
  suggestedReferences: ChatReference[];
};

const accountingAdvicePatterns = [
  /\b(quel|quelle|quels|quelles)\s+compte(s)?\s+(pcg|comptable)?\s+(utiliser|choisir|mettre|prendre)\b/i,
  /\b(taux\s+de\s+tva|tva\s+d[ée]ductible|charge\s+d[ée]ductible|amortir|amortissement)\b/i,
  /\b(bofip|cgi|doctrine fiscale|r[èe]gle comptable|plan comptable|pcg)\b/i,
  /\b(comment\s+(d[ée]clarer|comptabiliser|imputer))\b/i,
];

const helpPatterns = [
  /^\s*(o[uù]|comment|pourquoi|que faire|[aà] quoi sert|o[uù]\s+puis-je|je ne trouve pas|je cherche|peux-tu m['’ ]?expliquer|peux tu m['’ ]?expliquer)\b/i,
  /\b(o[uù]\s+(est|aller|trouver|rattacher|importer)|comment\s+(faire|ouvrir|aller|trouver|importer|rattacher|relancer|v[ée]rifier))\b/i,
];

const explainPatterns = [
  /^\s*pourquoi\b/i,
  /\b(pourquoi|raison|bloqu[ée]|en revue|[aà] z[ée]ro|pas [aà] jour|[aà] mettre [aà] jour)\b/i,
];

const mutationIntents = [
  { intent: "generate_document", pattern: /\b(g[ée]n[èe]re|g[ée]n[ée]rer|cr[ée]e|cr[ée]er).*\b(fec|document|liasse|pdf|[ée]tat)/i, references: ["documents", "controle"] },
  { intent: "correct_transaction", pattern: /\b(corrige|corriger|cat[ée]gorise|cat[ée]goriser|valide|valider).*\b(transaction|cat[ée]gorisation)/i, references: ["transactions"] },
  { intent: "create_entry", pattern: /\b(passe|cr[ée]e|cr[ée]er|valide|valider).*\b([ée]criture|od|journal)/i, references: ["controle", "ecritures"] },
  { intent: "import_file", pattern: /\b(importe|importer|relance|relancer).*\b(csv|import|fichier)/i, references: ["imports"] },
  { intent: "close_fiscal_year", pattern: /\b(cl[ôo]ture|cl[ôo]turer|verrouille|verrouiller|r[ée]ouvre|r[ée]ouvrir).*\b(exercice|cl[ôo]ture)/i, references: ["cloture"] },
  { intent: "billing_action", pattern: /\b(change|changer|ouvre|ouvrir|annule|annuler).*\b(plan|abonnement|stripe|billing)/i, references: ["abonnement"] },
  { intent: "delete_or_mutate", pattern: /\b(supprime|supprimer|efface|effacer|modifie|modifier|mets [àa] jour|update|delete|create|generate|approve|reject)\b/i, references: ["dashboard"] },
];

export class ChatIntentPolicy {
  evaluateMessage(message: string, references: ChatReference[] = []): ChatIntentDecision {
    if (accountingAdvicePatterns.some((pattern) => pattern.test(message))) {
      return {
        intent: "accounting_rules_v2",
        allowed: false,
        reason: "Le chat Qitus V1 répond aux questions d’utilisation de Qitus. Les questions de règles comptables générales seront couvertes en V2.",
        matchedIntent: "accounting_rules_v2",
        suggestedReferences: findReferences(references, ["dashboard", "chat"]),
      };
    }

    if (isHelpQuestion(message)) {
      return {
        intent: explainPatterns.some((pattern) => pattern.test(message)) ? "explain_status" : message.trim().toLowerCase().startsWith("comment") ? "how_to" : "navigation_help",
        allowed: true,
        reason: null,
        matchedIntent: null,
        suggestedReferences: [],
      };
    }

    const mutation = mutationIntents.find((candidate) => candidate.pattern.test(message));
    if (mutation) {
      return {
        intent: "mutation_request",
        allowed: false,
        reason: "Je ne peux pas lancer cette action depuis le chat.",
        matchedIntent: mutation.intent,
        suggestedReferences: findReferences(references, mutation.references),
      };
    }

    return {
      intent: "qitus_question",
      allowed: true,
      reason: null,
      matchedIntent: null,
      suggestedReferences: [],
    };
  }
}

function isHelpQuestion(message: string) {
  return helpPatterns.some((pattern) => pattern.test(message));
}

function findReferences(references: ChatReference[], codes: string[]) {
  return codes.flatMap((code) => references.filter((reference) => reference.code === code));
}
