import { Prisma } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { BankReconciliationCenter } from "./bank-reconciliation-center.server";
import { absMoney, daysBetween, money, ReconciliationCore } from "./reconciliation-core.server";

export type BankMatchFilters = {
  status?: string | null;
};

export class BankLineReconciliationCenter {
  constructor(
    private readonly core = new ReconciliationCore(),
    private readonly balances = new BankReconciliationCenter()
  ) {}

  async getBankReconciliation(workspace: CompanyWorkspace) {
    const [balance, summary, matches] = await Promise.all([
      this.balances.getReconciliation(workspace),
      this.summarizeBankReconciliation(workspace),
      this.listBankMatches(workspace, {}),
    ]);
    return { balance, summary, matches };
  }

  async runBankMatching(workspace: CompanyWorkspace) {
    const run = await this.core.getOrCreateRun(workspace, "BANK");
    const [transactions, bankLines] = await Promise.all([
      prisma.transaction.findMany({
        where: { fiscalYearId: workspace.fiscalYear.id },
        include: { journalEntry: { include: { lines: true } } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      prisma.journalLine.findMany({
        where: { account: workspace.bankAccount.pcgAccount, journalEntry: { fiscalYearId: workspace.fiscalYear.id } },
        include: { journalEntry: { include: { transactions: true } } },
        orderBy: [{ journalEntry: { date: "asc" } }],
      }),
    ]);

    const matchedLineIds = new Set<string>();
    const matches: Prisma.ReconciliationMatchCreateManyInput[] = [];
    const issues = [];

    for (const transaction of transactions) {
      const linkedLine = transaction.journalEntry?.lines.find((line) => line.account === workspace.bankAccount.pcgAccount);
      if (linkedLine) {
        const entry = transaction.journalEntry;
        if (!entry) continue;
        matchedLineIds.add(linkedLine.id);
        matches.push({
          runId: run.id,
          kind: "BANK_TRANSACTION_LEDGER",
          leftEntityType: "transaction",
          leftEntityId: transaction.id,
          rightEntityType: "journalLine",
          rightEntityId: linkedLine.id,
          status: absMoney(transaction.amount) === absMoney(Number(linkedLine.debit) - Number(linkedLine.credit)) ? "AUTO_MATCHED" : "DIFFERENCE",
          amountDifference: new Prisma.Decimal(money(absMoney(transaction.amount) - absMoney(Number(linkedLine.debit) - Number(linkedLine.credit)))),
          dateDifferenceDays: Math.abs(daysBetween(transaction.date, entry.date)),
          confidence: new Prisma.Decimal(1),
        });
        continue;
      }
      issues.push({
        issueKey: `BANK_UNMATCHED_TRANSACTION:transaction:${transaction.id}`,
        code: "BANK_UNMATCHED_TRANSACTION",
        severity: "BLOCKING" as const,
        entityType: "transaction",
        entityId: transaction.id,
        note: transaction.label,
      });
      matches.push({
        runId: run.id,
        kind: "BANK_TRANSACTION_LEDGER",
        leftEntityType: "transaction",
        leftEntityId: transaction.id,
        status: "UNMATCHED",
        amountDifference: new Prisma.Decimal(absMoney(transaction.amount)),
        dateDifferenceDays: 0,
        confidence: new Prisma.Decimal(0),
      });
    }

    for (const line of bankLines) {
      if (matchedLineIds.has(line.id)) continue;
      if (line.journalEntry.transactions.length > 0) continue;
      issues.push({
        issueKey: `BANK_UNMATCHED_LEDGER_LINE:journalLine:${line.id}`,
        code: "BANK_UNMATCHED_LEDGER_LINE",
        severity: "BLOCKING" as const,
        entityType: "journalLine",
        entityId: line.id,
        note: line.journalEntry.label,
      });
      matches.push({
        runId: run.id,
        kind: "BANK_TRANSACTION_LEDGER",
        leftEntityType: "journalLine",
        leftEntityId: line.id,
        status: "UNMATCHED",
        amountDifference: new Prisma.Decimal(absMoney(Number(line.debit) - Number(line.credit))),
        dateDifferenceDays: 0,
        confidence: new Prisma.Decimal(0),
      });
    }

    await this.core.replaceRunData(workspace, "BANK", {
      matches,
      issues,
      metadata: { account: workspace.bankAccount.pcgAccount, transactionCount: transactions.length, bankLineCount: bankLines.length },
    });
    return this.getBankReconciliation(workspace);
  }

  async listBankMatches(workspace: CompanyWorkspace, filters: BankMatchFilters = {}) {
    const run = await prisma.reconciliationRun.findUnique({ where: { fiscalYearId_kind: { fiscalYearId: workspace.fiscalYear.id, kind: "BANK" } } });
    if (!run) return [];
    return prisma.reconciliationMatch.findMany({
      where: {
        runId: run.id,
        kind: "BANK_TRANSACTION_LEDGER",
        ...(filters.status ? { status: filters.status as never } : {}),
      },
      orderBy: [{ status: "desc" }, { createdAt: "asc" }],
    });
  }

  async getBankMatchDetail(workspace: CompanyWorkspace, matchId: string) {
    const match = await this.requireMatch(workspace, matchId);
    const [transaction, bankLine] = await Promise.all([
      match.leftEntityType === "transaction" ? prisma.transaction.findUnique({ where: { id: match.leftEntityId } }) : null,
      (match.rightEntityType === "journalLine" && match.rightEntityId) ? prisma.journalLine.findUnique({ where: { id: match.rightEntityId }, include: { journalEntry: true } }) : match.leftEntityType === "journalLine" ? prisma.journalLine.findUnique({ where: { id: match.leftEntityId }, include: { journalEntry: true } }) : null,
    ]);
    return {
      match,
      transaction,
      bankLine,
      reason: match.status === "AUTO_MATCHED" ? "Montant, date et écriture liée concordent." : match.status === "DIFFERENCE" ? "Montant ou date à revoir." : "Aucun match bancaire confirmé.",
    };
  }

  async confirmMatch(workspace: CompanyWorkspace, input: { matchId: string; note?: string | null }) {
    const match = await this.requireMatch(workspace, input.matchId);
    const updated = await prisma.reconciliationMatch.update({
      where: { id: match.id },
      data: { status: "USER_MATCHED", note: input.note ?? match.note },
    });
    await prisma.reconciliationIssue.updateMany({
      where: { runId: match.runId, entityId: { in: [match.leftEntityId, match.rightEntityId ?? ""] }, status: "OPEN" },
      data: { status: "RESOLVED", note: input.note ?? "Rapprochement confirmé" },
    });
    await this.core.markRunCompletedIfReady(match.runId);
    return updated;
  }

  async ignoreMatch(workspace: CompanyWorkspace, input: { matchId: string; note: string }) {
    const match = await this.requireMatch(workspace, input.matchId);
    const updated = await prisma.reconciliationMatch.update({
      where: { id: match.id },
      data: { status: "IGNORED", note: input.note },
    });
    await prisma.reconciliationIssue.updateMany({
      where: { runId: match.runId, entityId: { in: [match.leftEntityId, match.rightEntityId ?? ""] }, status: "OPEN" },
      data: { status: "IGNORED", note: input.note },
    });
    await this.core.markRunCompletedIfReady(match.runId);
    return updated;
  }

  async saveStatementBalances(workspace: CompanyWorkspace, input: { statementBalance: string | number; statementDate?: string | null; confirm?: boolean }) {
    const balance = await this.balances.saveBankStatementBalance(workspace, input);
    if (input.confirm) {
      await this.balances.confirmReconciliation(workspace);
      const run = await prisma.reconciliationRun.findUnique({
        where: { fiscalYearId_kind: { fiscalYearId: workspace.fiscalYear.id, kind: "BANK" } },
      });
      if (run) await this.core.markRunCompletedIfReady(run.id);
    }
    return this.getBankReconciliation(workspace);
  }

  async summarizeBankReconciliation(workspace: CompanyWorkspace) {
    return this.core.summarizeRun(workspace, "BANK");
  }

  private async requireMatch(workspace: CompanyWorkspace, matchId: string) {
    const match = await prisma.reconciliationMatch.findFirst({
      where: { id: matchId, run: { fiscalYearId: workspace.fiscalYear.id, kind: "BANK" } },
    });
    if (!match) throw new ExpectedRouteError("Rapprochement bancaire introuvable.", 404);
    return match;
  }
}
