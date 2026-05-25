import { readFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ReconciliationPolicyCenter } from "../official-references/reconciliation-policy-center.server";
import { ExpectedRouteError } from "../route-errors.server";
import { absMoney, daysBetween, money, ReconciliationCore } from "./reconciliation-core.server";
import type { StripeBalanceTransaction, StripePayoutPayload } from "./stripe-connector-adapter.server";

type StripeFixture = {
  charges?: Array<Record<string, unknown>>;
  refunds?: Array<Record<string, unknown>>;
  payouts?: Array<Record<string, unknown>>;
};

export class StripeReconciliationCenter {
  constructor(
    private readonly core = new ReconciliationCore(),
    private readonly reconciliationPolicy = new ReconciliationPolicyCenter()
  ) {}

  async importStripeFixture(workspace: CompanyWorkspace, input: { fixturePath?: string } = {}) {
    const fixturePath = input.fixturePath ?? path.join(process.cwd(), "fixtures", "bank-imports", "stripe-transactions.json");
    const parsed = JSON.parse(await readFile(fixturePath, "utf8")) as StripeFixture;
    let events = 0;
    let payouts = 0;

    for (const charge of parsed.charges ?? []) {
      await this.upsertStripeEvent(workspace, {
        sourceId: text(charge.id),
        eventType: "CHARGE",
        date: date(charge.created),
        grossAmount: cents(charge.amount_captured ?? charge.amount),
        feeAmount: cents(charge.fee),
        netAmount: cents(charge.net),
        payoutId: text(charge.payout),
        metadataJson: charge as Prisma.InputJsonObject,
      });
      events += 1;
      if (Number(charge.fee ?? 0) > 0) {
        await this.upsertStripeEvent(workspace, {
          sourceId: `${text(charge.id)}:fee`,
          eventType: "FEE",
          date: date(charge.created),
          grossAmount: cents(charge.fee),
          feeAmount: cents(charge.fee),
          netAmount: -cents(charge.fee),
          payoutId: text(charge.payout),
          metadataJson: charge as Prisma.InputJsonObject,
        });
        events += 1;
      }
    }
    for (const refund of parsed.refunds ?? []) {
      await this.upsertStripeEvent(workspace, {
        sourceId: text(refund.id),
        eventType: "REFUND",
        date: date(refund.created),
        grossAmount: -cents(refund.amount),
        feeAmount: 0,
        netAmount: -cents(refund.amount),
        payoutId: text(refund.payout),
        metadataJson: refund as Prisma.InputJsonObject,
      });
      events += 1;
    }
    for (const payout of parsed.payouts ?? []) {
      await prisma.stripePayout.upsert({
        where: { fiscalYearId_sourceId: { fiscalYearId: workspace.fiscalYear.id, sourceId: text(payout.id) } },
        create: {
          companyId: workspace.company.id,
          fiscalYearId: workspace.fiscalYear.id,
          sourceId: text(payout.id),
          arrivalDate: date(payout.arrival_date),
          amount: new Prisma.Decimal(cents(payout.amount)),
          currency: text(payout.currency, "eur").toUpperCase(),
          status: text(payout.status, "unknown"),
          metadataJson: payout as Prisma.InputJsonObject,
        },
        update: {
          arrivalDate: date(payout.arrival_date),
          amount: new Prisma.Decimal(cents(payout.amount)),
          status: text(payout.status, "unknown"),
          metadataJson: payout as Prisma.InputJsonObject,
        },
      });
      payouts += 1;
    }
    return { events, payouts };
  }

  async syncStripe(_workspace: CompanyWorkspace) {
    throw new ExpectedRouteError("Synchronisation Stripe live désactivée. Utilise CONNECTORS_MODE=live et l'API connecteur dédiée.", 409);
  }

  async importStripeLiveData(workspace: CompanyWorkspace, input: { balanceTransactions: StripeBalanceTransaction[]; payouts: StripePayoutPayload[] }) {
    let events = 0;
    let payouts = 0;
    let unknown = 0;

    for (const tx of input.balanceTransactions) {
      const eventType = stripeEventType(tx.type);
      if (!eventType) {
        unknown += 1;
        continue;
      }
      await this.upsertStripeEvent(workspace, {
        sourceId: tx.id,
        eventType,
        date: new Date(tx.created * 1000),
        grossAmount: cents(tx.amount),
        feeAmount: cents(tx.fee),
        netAmount: cents(tx.net),
        currency: tx.currency?.toUpperCase() ?? "EUR",
        payoutId: tx.payout ?? undefined,
        metadataJson: tx as unknown as Prisma.InputJsonObject,
      });
      events += 1;
      if (Number(tx.fee ?? 0) > 0) {
        await this.upsertStripeEvent(workspace, {
          sourceId: `${tx.id}:fee`,
          eventType: "FEE",
          date: new Date(tx.created * 1000),
          grossAmount: cents(tx.fee),
          feeAmount: cents(tx.fee),
          netAmount: -cents(tx.fee),
          currency: tx.currency?.toUpperCase() ?? "EUR",
          payoutId: tx.payout ?? undefined,
          metadataJson: tx as unknown as Prisma.InputJsonObject,
        });
        events += 1;
      }
    }

    for (const payout of input.payouts) {
      await prisma.stripePayout.upsert({
        where: { fiscalYearId_sourceId: { fiscalYearId: workspace.fiscalYear.id, sourceId: payout.id } },
        create: {
          companyId: workspace.company.id,
          fiscalYearId: workspace.fiscalYear.id,
          sourceId: payout.id,
          arrivalDate: new Date(payout.arrival_date * 1000),
          amount: new Prisma.Decimal(cents(payout.amount)),
          currency: payout.currency?.toUpperCase() ?? "EUR",
          status: payout.status,
          metadataJson: payout as unknown as Prisma.InputJsonObject,
        },
        update: {
          arrivalDate: new Date(payout.arrival_date * 1000),
          amount: new Prisma.Decimal(cents(payout.amount)),
          status: payout.status,
          metadataJson: payout as unknown as Prisma.InputJsonObject,
        },
      });
      payouts += 1;
    }

    return { events, payouts, unknown };
  }

  async runStripeMatching(workspace: CompanyWorkspace) {
    const run = await this.core.getOrCreateRun(workspace, "STRIPE");
    const [payouts, transactions, feeEvents, refunds, disputes] = await Promise.all([
      prisma.stripePayout.findMany({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id } }),
      prisma.transaction.findMany({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          OR: [
            { label: { contains: "stripe", mode: "insensitive" } },
            { label: { contains: "payout", mode: "insensitive" } },
            { counterparty: { contains: "stripe", mode: "insensitive" } },
            { categorization: { OR: [{ accountDebit: "511" }, { accountCredit: "511" }] } },
          ],
        },
      }),
      prisma.stripeEvent.findMany({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, eventType: "FEE" } }),
      prisma.stripeEvent.findMany({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, eventType: "REFUND" } }),
      prisma.stripeEvent.findMany({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, eventType: "DISPUTE" } }),
    ]);
    const usedTransactions = new Set<string>();
    const matches = [];
    const issues = [];
    const exactAmountEpsilon = (await this.reconciliationPolicy.getTolerances()).exactAmountEpsilon;

    for (const payout of payouts) {
      const candidate = transactions
        .filter((transaction) => !usedTransactions.has(transaction.id))
        .map((transaction) => ({
          transaction,
          amountDiff: money(absMoney(transaction.amount) - absMoney(payout.amount)),
          dateDiff: Math.abs(daysBetween(transaction.date, payout.arrivalDate)),
        }))
        .filter((candidate) => Math.abs(candidate.amountDiff) <= exactAmountEpsilon || /stripe|payout/i.test(candidate.transaction.label))
        .sort((a, b) => Math.abs(a.amountDiff) - Math.abs(b.amountDiff) || a.dateDiff - b.dateDiff)[0];
      if (candidate) {
        usedTransactions.add(candidate.transaction.id);
        matches.push({
          runId: run.id,
          kind: "STRIPE_PAYOUT" as const,
          leftEntityType: "stripePayout",
          leftEntityId: payout.id,
          rightEntityType: "transaction",
          rightEntityId: candidate.transaction.id,
          status: Math.abs(candidate.amountDiff) <= exactAmountEpsilon ? "AUTO_MATCHED" as const : "DIFFERENCE" as const,
          amountDifference: new Prisma.Decimal(candidate.amountDiff),
          dateDifferenceDays: candidate.dateDiff,
          confidence: new Prisma.Decimal(Math.abs(candidate.amountDiff) <= exactAmountEpsilon ? 1 : 0.6),
        });
      } else {
        issues.push({
          issueKey: `STRIPE_PAYOUT_UNMATCHED:transaction:${payout.id}`,
          code: "STRIPE_PAYOUT_UNMATCHED",
          severity: "BLOCKING" as const,
          entityType: "stripePayout",
          entityId: payout.id,
          note: `Payout Stripe ${payout.sourceId}`,
        });
      }
    }

    if (feeEvents.length > 0) {
      issues.push({
        issueKey: `STRIPE_FEES_REVIEW:fiscal-year:${workspace.fiscalYear.id}`,
        code: "STRIPE_FEES_REVIEW",
        severity: "WARNING" as const,
        entityType: "fiscalYear",
        entityId: workspace.fiscalYear.id,
        note: `${feeEvents.length} frais Stripe à vérifier avant OD.`,
      });
    }
    for (const refund of refunds) {
      issues.push({
        issueKey: `STRIPE_REFUND_REVIEW:event:${refund.id}`,
        code: "STRIPE_REFUND_REVIEW",
        severity: "WARNING" as const,
        entityType: "stripeEvent",
        entityId: refund.id,
        note: "Refund Stripe à rapprocher.",
      });
    }
    for (const dispute of disputes) {
      issues.push({
        issueKey: `STRIPE_DISPUTE_REVIEW:event:${dispute.id}`,
        code: "STRIPE_DISPUTE_REVIEW",
        severity: "WARNING" as const,
        entityType: "stripeEvent",
        entityId: dispute.id,
        note: "Litige Stripe à rapprocher.",
      });
    }

    await this.core.replaceRunData(workspace, "STRIPE", {
      matches,
      issues,
      metadata: { payouts: payouts.length, events: feeEvents.length + refunds.length + disputes.length },
    });
    return this.summarizeStripeReconciliation(workspace);
  }

  async listStripeEvents(workspace: CompanyWorkspace, filters: { eventType?: string | null } = {}) {
    return prisma.stripeEvent.findMany({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, ...(filters.eventType ? { eventType: filters.eventType as never } : {}) },
      orderBy: [{ date: "asc" }],
    });
  }

  async listStripeMatches(workspace: CompanyWorkspace, filters: { status?: string | null } = {}) {
    const run = await prisma.reconciliationRun.findUnique({ where: { fiscalYearId_kind: { fiscalYearId: workspace.fiscalYear.id, kind: "STRIPE" } } });
    if (!run) return [];
    return prisma.reconciliationMatch.findMany({
      where: { runId: run.id, kind: "STRIPE_PAYOUT", ...(filters.status ? { status: filters.status as never } : {}) },
      orderBy: [{ status: "desc" }, { createdAt: "asc" }],
    });
  }

  async getStripeMatchDetail(workspace: CompanyWorkspace, matchId: string) {
    const match = await prisma.reconciliationMatch.findFirst({
      where: { id: matchId, run: { fiscalYearId: workspace.fiscalYear.id, kind: "STRIPE" } },
    });
    if (!match) throw new ExpectedRouteError("Match Stripe introuvable.", 404);
    const [payout, transaction, events] = await Promise.all([
      match.leftEntityType === "stripePayout" ? prisma.stripePayout.findUnique({ where: { id: match.leftEntityId } }) : null,
      match.rightEntityType === "transaction" && match.rightEntityId ? prisma.transaction.findUnique({ where: { id: match.rightEntityId } }) : null,
      prisma.stripeEvent.findMany({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id }, orderBy: { date: "asc" } }),
    ]);
    return {
      match,
      payout,
      transaction,
      events: payout ? events.filter((event) => event.payoutId === payout.sourceId) : events,
      reason: match.status === "AUTO_MATCHED" ? "Payout Stripe rapproché avec un mouvement bancaire." : "Payout Stripe à justifier.",
    };
  }

  async summarizeStripeReconciliation(workspace: CompanyWorkspace) {
    const [summary, payouts, events] = await Promise.all([
      this.core.summarizeRun(workspace, "STRIPE"),
      prisma.stripePayout.count({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id } }),
      prisma.stripeEvent.count({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id } }),
    ]);
    return { ...summary, payouts, events };
  }

  private async upsertStripeEvent(workspace: CompanyWorkspace, input: {
    sourceId: string;
    eventType: "CHARGE" | "FEE" | "REFUND" | "DISPUTE" | "PAYOUT";
    date: Date;
    grossAmount: number;
    feeAmount: number;
    netAmount: number;
    currency?: string;
    payoutId?: string;
    metadataJson?: Prisma.InputJsonValue;
  }) {
    await prisma.stripeEvent.upsert({
      where: { fiscalYearId_sourceId: { fiscalYearId: workspace.fiscalYear.id, sourceId: input.sourceId } },
      create: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        sourceId: input.sourceId,
        eventType: input.eventType,
        date: input.date,
        grossAmount: new Prisma.Decimal(input.grossAmount),
        feeAmount: new Prisma.Decimal(input.feeAmount),
        netAmount: new Prisma.Decimal(input.netAmount),
        currency: input.currency ?? "EUR",
        payoutId: input.payoutId || null,
        metadataJson: input.metadataJson,
      },
      update: {
        date: input.date,
        grossAmount: new Prisma.Decimal(input.grossAmount),
        feeAmount: new Prisma.Decimal(input.feeAmount),
        netAmount: new Prisma.Decimal(input.netAmount),
        payoutId: input.payoutId || null,
        metadataJson: input.metadataJson,
      },
    });
  }
}

function text(value: unknown, fallback = "") {
  return String(value ?? fallback);
}

function date(value: unknown) {
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function cents(value: unknown) {
  return money(Number(value ?? 0) / 100);
}

function stripeEventType(type: string): "CHARGE" | "REFUND" | null {
  if (type === "charge" || type === "payment") return "CHARGE";
  if (type === "refund" || type === "payment_refund") return "REFUND";
  return null;
}
