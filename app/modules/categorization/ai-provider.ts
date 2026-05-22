import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import type { AiCategorizationProvider, CategorizationContext, CategorizationSuggestion, CategorizationTransaction } from "./types";

const categorizationSchema = z.object({
  categorizations: z.array(
    z.object({
      transactionId: z.string(),
      accountDebit: z.string(),
      accountDebitLabel: z.string().optional(),
      accountCredit: z.string().default("5121"),
      accountCreditLabel: z.string().optional(),
      journal: z.string().default("BQ"),
      ecritureLabel: z.string(),
      confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
      rationale: z.string().optional(),
      isAnnualCharge: z.boolean().optional(),
      alternatives: z.array(z.object({ account: z.string(), label: z.string().optional(), confidence: z.number() })).optional(),
    })
  ),
});

export class FakeCategorizationProvider implements AiCategorizationProvider {
  async categorize(transactions: CategorizationTransaction[], _context?: CategorizationContext): Promise<CategorizationSuggestion[]> {
    return transactions.map((transaction) => ({
      transactionId: transaction.id,
      accountDebit: transaction.amount > 0 ? "706" : "471",
      accountDebitLabel: transaction.amount > 0 ? "Prestations de services" : "Compte d'attente",
      accountCredit: transaction.amount > 0 ? "706" : "5121",
      accountCreditLabel: transaction.amount > 0 ? "Prestations de services" : "Banque",
      journal: "BQ",
      ecritureLabel: `${transaction.counterparty ?? "Transaction"} - ${transaction.label}`,
      confidence: "LOW",
      source: "AI",
      rationale: "Fake provider used in tests; low confidence keeps the transaction in review.",
    }));
  }
}

export class OpenAIResponsesCategorizationAdapter implements AiCategorizationProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options?: { apiKey?: string; model?: string }) {
    this.client = new OpenAI({ apiKey: options?.apiKey ?? process.env.OPENAI_API_KEY });
    this.model = options?.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  }

  async categorize(transactions: CategorizationTransaction[], context: CategorizationContext): Promise<CategorizationSuggestion[]> {
    if (transactions.length === 0) return [];

    const response = await this.client.responses.parse({
      model: this.model,
      instructions: [
        "Tu es le module de catégorisation comptable française de Qitus.",
        "Retourne uniquement des écritures bancaires BQ au format JSON demandé.",
        "Utilise le Plan Comptable Général français.",
        "Si le libellé est opaque ou insuffisant, confidence=LOW et accountDebit=471.",
      ].join("\n"),
      input: [
        {
          role: "user" as const,
          content: JSON.stringify({
            company: {
              name: context.companyName,
              legalForm: context.legalForm,
              vatRegime: context.vatRegime,
            },
            transactions,
          }),
        },
      ],
      store: false,
      text: {
        format: zodTextFormat(categorizationSchema, "qitus_categorizations"),
      },
    });

    const parsed = response.output_parsed;
    return (parsed?.categorizations ?? []).map((item) => ({
      ...item,
      source: "AI",
    }));
  }
}
