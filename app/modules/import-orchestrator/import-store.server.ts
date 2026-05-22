import type { BankAccount, Company, FiscalYear, Import, Prisma, User } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import type { NormalizedTransaction } from "../import-pipeline/types";
import { ExpectedRouteError } from "../route-errors.server";
import { SubscriptionCenter } from "../billing/subscription-center.server";
import type { CsvImportUpload } from "./import-orchestrator.server";

export class ImportStore {
  async createPendingImport(workspace: CompanyWorkspace, file: CsvImportUpload) {
    return prisma.import.create({
      data: {
        fiscalYearId: workspace.fiscalYear.id,
        bankAccountId: file.bankAccountId ?? workspace.bankAccount.id,
        sourceType: file.sourceType ?? "CSV_UPLOAD",
        originalFilename: file.filename,
        status: "PENDING",
        currentStep: "queued",
        progress: 0,
        startedAt: new Date(),
      },
    });
  }

  async updateImport(importId: string, data: Prisma.ImportUpdateInput) {
    return prisma.import.update({ where: { id: importId }, data });
  }

  async findImportOrThrow(importId: string) {
    return prisma.import.findUniqueOrThrow({ where: { id: importId } });
  }

  async requireWorkspaceImport(workspace: CompanyWorkspace, importId: string) {
    const importRow = await prisma.import.findFirst({ where: { id: importId, fiscalYearId: workspace.fiscalYear.id } });
    if (!importRow) throw new ExpectedRouteError("Import introuvable pour cet exercice.", 404);
    return importRow;
  }

  async workspaceForImport(importId: string): Promise<CompanyWorkspace> {
    const importRow = await prisma.import.findUniqueOrThrow({
      where: { id: importId },
      include: {
        bankAccount: true,
        fiscalYear: {
          include: {
            company: { include: { user: true, fiscalYears: true, bankAccounts: true } },
          },
        },
      },
    });
    const company = importRow.fiscalYear.company;
    const bankAccount = importRow.bankAccount ?? company.bankAccounts[0];
    if (!bankAccount) throw new Error("Aucun compte bancaire disponible pour cet import.");
    return {
      user: company.user,
      company: stripCompanyUser(company),
      fiscalYear: importRow.fiscalYear,
      bankAccount,
      subscription: await new SubscriptionCenter().getSubscription({ company: stripCompanyUser(company) }),
      authMode: "dev",
    };
  }

  async createTransactionsIdempotently(fiscalYearId: string, importId: string, transactions: NormalizedTransaction[]) {
    const existing = await prisma.transaction.findMany({
      where: { fiscalYearId },
      select: { date: true, amount: true, normalizedLabel: true, sourceId: true, sourceRef: true },
    });
    const seen = new Set(existing.map((tx) => fingerprint(tx.date.toISOString().slice(0, 10), tx.amount.toString(), tx.normalizedLabel, tx.sourceRef, tx.sourceId)));
    let created = 0;

    for (const tx of transactions) {
      const key = fingerprint(tx.date, String(tx.amount), tx.normalizedLabel, tx.sourceRef, tx.sourceId);
      if (seen.has(key)) continue;
      seen.add(key);
      await prisma.transaction.create({
        data: {
          fiscalYearId,
          importId,
          sourceId: tx.sourceId,
          date: new Date(tx.date),
          label: tx.label,
          normalizedLabel: tx.normalizedLabel,
          counterparty: tx.counterparty,
          amount: tx.amount,
          currency: tx.currency,
          type: tx.type,
          sourceRef: tx.sourceRef,
          sourceCategory: tx.sourceCategory,
          notes: tx.notes,
        },
      });
      created += 1;
    }

    return created;
  }

  async listImports(fiscalYearId: string): Promise<Import[]> {
    return prisma.import.findMany({
      where: { fiscalYearId },
      orderBy: { createdAt: "desc" },
    });
  }
}

function fingerprint(date: string, amount: string, normalizedLabel: string, sourceRef?: string | null, sourceId?: string | null) {
  if (sourceId) return `source:${sourceId}`;
  return [date, amount, normalizedLabel, sourceRef ?? ""].join("|");
}

function stripCompanyUser(company: Company & { user: User; fiscalYears: FiscalYear[]; bankAccounts: BankAccount[] }) {
  const { user: _user, ...rest } = company;
  return rest;
}
