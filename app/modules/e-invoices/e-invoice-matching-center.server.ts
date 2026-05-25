import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ReconciliationPolicyCenter } from "../official-references/reconciliation-policy-center.server";
import { ExpectedRouteError } from "../route-errors.server";

export type EInvoiceMatchSuggestion = {
  entityType: "TRANSACTION" | "JOURNAL_ENTRY";
  entityId: string;
  label: string;
  href: string;
  score: number;
  reasons: string[];
  amount: string | null;
  date: string | null;
};

export class EInvoiceMatchingCenter {
  constructor(private readonly reconciliationPolicy = new ReconciliationPolicyCenter()) {}

  async suggestMatches(workspace: CompanyWorkspace, eInvoiceId: string): Promise<EInvoiceMatchSuggestion[]> {
    const invoice = await prisma.eInvoice.findFirst({
      where: { id: eInvoiceId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
    });
    if (!invoice) throw new ExpectedRouteError("Facture électronique introuvable.", 404);
    const [transactions, entries] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          date: invoice.issueDate ? dateWindow(invoice.issueDate, 45) : undefined,
        },
        take: 100,
        orderBy: { date: "desc" },
      }),
      prisma.journalEntry.findMany({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          date: invoice.issueDate ? dateWindow(invoice.issueDate, 60) : undefined,
        },
        include: { lines: true },
        take: 100,
        orderBy: { date: "desc" },
      }),
    ]);

    const exactAmountEpsilon = (await this.reconciliationPolicy.getTolerances()).exactAmountEpsilon;
    const transactionSuggestions = transactions.map((transaction) => {
      const scored = scoreInvoiceAgainstText(invoice, {
        text: `${transaction.label} ${transaction.counterparty ?? ""}`,
        amount: transaction.amount.toNumber(),
        date: transaction.date,
      }, exactAmountEpsilon);
      return {
        entityType: "TRANSACTION" as const,
        entityId: transaction.id,
        label: transaction.label,
        href: `/transactions/${transaction.id}`,
        amount: transaction.amount.toString(),
        date: transaction.date.toISOString().slice(0, 10),
        ...scored,
      };
    });

    const entrySuggestions = entries.map((entry) => {
      const amount = Math.max(...entry.lines.map((line) => line.debit.toNumber()), ...entry.lines.map((line) => line.credit.toNumber()), 0);
      const scored = scoreInvoiceAgainstText(invoice, { text: entry.label, amount, date: entry.date }, exactAmountEpsilon);
      return {
        entityType: "JOURNAL_ENTRY" as const,
        entityId: entry.id,
        label: `Écriture ${entry.num} · ${entry.label}`,
        href: `/ecritures?search=${encodeURIComponent(entry.label)}`,
        amount: amount.toFixed(2),
        date: entry.date.toISOString().slice(0, 10),
        ...scored,
      };
    });

    return [...transactionSuggestions, ...entrySuggestions]
      .filter((suggestion) => suggestion.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  async markMatched(workspace: CompanyWorkspace, input: { eInvoiceId: string; entityType: "TRANSACTION" | "JOURNAL_ENTRY"; entityId: string; note?: string | null }) {
    const invoice = await prisma.eInvoice.findFirst({
      where: { id: input.eInvoiceId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
    });
    if (!invoice) throw new ExpectedRouteError("Facture électronique introuvable.", 404);
    await assertEntity(workspace, input);
    const updated = await prisma.eInvoice.update({
      where: { id: invoice.id },
      data: {
        status: invoice.status === "ACCOUNTED" ? "ACCOUNTED" : "MATCHED",
      },
    });
    return {
      id: updated.id,
      status: updated.status,
      matchedEntityType: input.entityType,
      matchedEntityId: input.entityId,
    };
  }
}

function scoreInvoiceAgainstText(invoice: { amountTtc: { toNumber(): number } | null; issueDate: Date | null; supplierName: string | null; invoiceNumber: string | null }, fact: { text: string; amount: number; date: Date }, exactAmountEpsilon: number) {
  let score = 0;
  const reasons: string[] = [];
  const amountTtc = invoice.amountTtc?.toNumber();
  if (amountTtc != null) {
    const delta = Math.abs(Math.abs(amountTtc) - Math.abs(fact.amount));
    if (delta <= exactAmountEpsilon) {
      score += 50;
      reasons.push("montant exact");
    } else if (delta <= 1) {
      score += 35;
      reasons.push("montant proche");
    }
  }
  if (invoice.issueDate) {
    const days = Math.abs(invoice.issueDate.getTime() - fact.date.getTime()) / 86_400_000;
    if (days <= 14) {
      score += 20;
      reasons.push("date proche");
    } else if (days <= 45) {
      score += 10;
      reasons.push("date plausible");
    }
  }
  const text = fact.text.toLowerCase();
  const supplier = invoice.supplierName?.trim().toLowerCase();
  if (supplier && text.includes(supplier)) {
    score += 25;
    reasons.push("fournisseur reconnu");
  }
  const invoiceNumber = invoice.invoiceNumber?.trim().toLowerCase();
  if (invoiceNumber && text.includes(invoiceNumber)) {
    score += 20;
    reasons.push("numéro facture reconnu");
  }
  return { score, reasons };
}

function dateWindow(date: Date, days: number) {
  return {
    gte: new Date(date.getTime() - days * 86_400_000),
    lte: new Date(date.getTime() + days * 86_400_000),
  };
}

async function assertEntity(workspace: CompanyWorkspace, input: { entityType: "TRANSACTION" | "JOURNAL_ENTRY"; entityId: string }) {
  if (input.entityType === "TRANSACTION") {
    const count = await prisma.transaction.count({ where: { id: input.entityId, fiscalYearId: workspace.fiscalYear.id } });
    if (count === 0) throw new ExpectedRouteError("Transaction introuvable.", 404);
  } else {
    const count = await prisma.journalEntry.count({ where: { id: input.entityId, fiscalYearId: workspace.fiscalYear.id } });
    if (count === 0) throw new ExpectedRouteError("Écriture introuvable.", 404);
  }
}
