import type { AccountingChatContext } from "./accounting-chat-provider.server";

export type ChatReference = {
  code: string;
  label: string;
  href: string;
  reason: string;
};

export type ChatGrounding = {
  contextVersion: string;
  references: ChatReference[];
};

export class ChatAnswerGrounding {
  buildGrounding(context: Pick<AccountingChatContext, "documentFreshness" | "annualClosing" | "accountingReview">): ChatGrounding {
    return {
      contextVersion: "qitus-chat-context-v1",
      references: [
        { code: "dashboard", label: "Tableau de bord", href: "/dashboard", reason: "Vue d'ensemble, indicateurs et alertes." },
        { code: "imports", label: "Imports", href: "/imports", reason: "Imports CSV, correspondance de colonnes et relance de catégorisation." },
        { code: "transactions", label: "Transactions", href: "/transactions", reason: "Transactions importées, filtres et corrections." },
        { code: "tva", label: "TVA", href: "/tva", reason: "Position TVA, déclarations et alertes de readiness." },
        { code: "controle", label: "Contrôle", href: "/controle", reason: "Blocages et points de pré-clôture." },
        { code: "ecritures", label: "Écritures", href: "/ecritures", reason: "Journal comptable, OD et exports." },
        { code: "documents", label: "Documents", href: "/documents", reason: "FEC, états, liasse et fraîcheur documentaire." },
        { code: "cloture", label: "Clôture", href: "/cloture", reason: "Workflow annuel et verrouillage d'exercice." },
        { code: "connecteurs", label: "Connecteurs", href: "/connecteurs", reason: "Connexions bancaires, Stripe, Open Banking et facturation électronique." },
        { code: "abonnement", label: "Abonnement", href: "/abonnement", reason: "Plan, quotas et usage." },
      ].filter((reference) => isRelevant(reference, context)),
    };
  }
}

function isRelevant(reference: ChatReference, context: Pick<AccountingChatContext, "documentFreshness" | "annualClosing" | "accountingReview">) {
  if (reference.code === "documents") return hasStaleDocuments(context.documentFreshness);
  if (reference.code === "cloture") return hasClosingContext(context.annualClosing);
  if (reference.code === "controle") return hasReviewContext(context.accountingReview);
  return true;
}

function hasStaleDocuments(value: unknown) {
  return Boolean(value && typeof value === "object" && "staleCount" in value);
}

function hasClosingContext(value: unknown) {
  return Boolean(value && typeof value === "object" && "status" in value);
}

function hasReviewContext(value: unknown) {
  return Boolean(value && typeof value === "object" && "status" in value);
}
