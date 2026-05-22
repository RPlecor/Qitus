import { Prisma } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";

export type BankReconciliationSummary = {
  id: string | null;
  bankAccountId: string;
  account: string;
  statementDate: string;
  statementBalance: number | null;
  ledgerBalance: number;
  difference: number | null;
  status: "missing" | "DRAFT" | "MATCHED" | "DIFFERENCE";
  confirmedAt: string | null;
};

export class BankReconciliationCenter {
  async getReconciliation(workspace: CompanyWorkspace): Promise<BankReconciliationSummary> {
    const [row, ledgerBalance] = await Promise.all([
      prisma.bankReconciliation.findUnique({
        where: { fiscalYearId_bankAccountId: { fiscalYearId: workspace.fiscalYear.id, bankAccountId: workspace.bankAccount.id } },
      }),
      this.computeLedgerBalance(workspace),
    ]);
    if (!row) {
      return {
        id: null,
        bankAccountId: workspace.bankAccount.id,
        account: workspace.bankAccount.pcgAccount,
        statementDate: workspace.fiscalYear.endDate.toISOString().slice(0, 10),
        statementBalance: null,
        ledgerBalance,
        difference: null,
        status: "missing",
        confirmedAt: null,
      };
    }
    return {
      id: row.id,
      bankAccountId: row.bankAccountId,
      account: workspace.bankAccount.pcgAccount,
      statementDate: row.statementDate.toISOString().slice(0, 10),
      statementBalance: Number(row.statementBalance),
      ledgerBalance: Number(row.ledgerBalance),
      difference: Number(row.difference),
      status: row.status,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
    };
  }

  async saveBankStatementBalance(workspace: CompanyWorkspace, input: { statementBalance: string | number; statementDate?: string | null }) {
    const ledgerBalance = await this.computeLedgerBalance(workspace);
    const statementBalance = round2(Number(input.statementBalance));
    const difference = round2(statementBalance - ledgerBalance);
    const status = Math.abs(difference) < 0.005 ? "MATCHED" : "DIFFERENCE";
    const row = await prisma.bankReconciliation.upsert({
      where: { fiscalYearId_bankAccountId: { fiscalYearId: workspace.fiscalYear.id, bankAccountId: workspace.bankAccount.id } },
      create: {
        fiscalYearId: workspace.fiscalYear.id,
        bankAccountId: workspace.bankAccount.id,
        statementDate: input.statementDate ? new Date(input.statementDate) : workspace.fiscalYear.endDate,
        statementBalance: new Prisma.Decimal(statementBalance),
        ledgerBalance: new Prisma.Decimal(ledgerBalance),
        difference: new Prisma.Decimal(difference),
        status,
      },
      update: {
        statementDate: input.statementDate ? new Date(input.statementDate) : workspace.fiscalYear.endDate,
        statementBalance: new Prisma.Decimal(statementBalance),
        ledgerBalance: new Prisma.Decimal(ledgerBalance),
        difference: new Prisma.Decimal(difference),
        status,
        confirmedAt: null,
      },
    });
    return this.getReconciliation({ ...workspace, bankAccount: workspace.bankAccount }).then((summary) => ({ ...summary, id: row.id }));
  }

  async confirmReconciliation(workspace: CompanyWorkspace) {
    const current = await this.getReconciliation(workspace);
    if (current.status !== "MATCHED") return current;
    await prisma.bankReconciliation.update({
      where: { fiscalYearId_bankAccountId: { fiscalYearId: workspace.fiscalYear.id, bankAccountId: workspace.bankAccount.id } },
      data: { confirmedAt: new Date() },
    });
    return this.getReconciliation(workspace);
  }

  private async computeLedgerBalance(workspace: CompanyWorkspace) {
    const lines = await prisma.journalLine.findMany({
      where: {
        account: workspace.bankAccount.pcgAccount,
        journalEntry: { fiscalYearId: workspace.fiscalYear.id },
      },
      select: { debit: true, credit: true },
    });
    return round2(lines.reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0));
  }
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
