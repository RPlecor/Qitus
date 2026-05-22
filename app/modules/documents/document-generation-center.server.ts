import { randomUUID } from "node:crypto";
import { DocumentType, type BankAccount, type Company, type FiscalYear } from "@prisma/client";
import { AccountingReviewCenter } from "../accounting-review/accounting-review-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import type { PaperasseCompanyInput } from "../paperasse/types";
import { PaperasseRuntime } from "../paperasse/paperasse-runtime";
import { DocumentGeneration } from "./document-generation";
import { LocalDocumentStorageAdapter, type DocumentStorageAdapter } from "./document-storage-adapter.server";

export type DocumentGenerationType = "fec" | "statements" | "liasse";
type PaperasseDocumentGenerationType = Exclude<DocumentGenerationType, "liasse">;

export type GeneratedDocumentSummary = {
  id: string;
  type: DocumentType;
  filename: string;
  format: string;
  sizeBytes: number | null;
  entriesCount: number | null;
  generatedBy: string;
  scriptVersion: string | null;
  generatedAt: string;
  status: string;
  errorMessage: string | null;
};

export class DocumentGenerationCenter {
  constructor(
    private readonly generator = new DocumentGeneration(
      new PaperasseRuntime({
        repoPath: process.env.PAPERASSE_REPO_PATH ?? "./vendor/paperasse",
        enablePdfGeneration: process.env.ENABLE_PDF_GENERATION === "1",
      })
    ),
    private readonly accountingReview = new AccountingReviewCenter(),
    private readonly storage: DocumentStorageAdapter = new LocalDocumentStorageAdapter()
  ) {}

  async generateDocuments(workspace: CompanyWorkspace, input: { types: PaperasseDocumentGenerationType[] }): Promise<GeneratedDocumentSummary[]> {
    for (const type of input.types) await this.accountingReview.assertDocumentsCanBeGenerated(workspace, type);

    const [bankAccounts, entries] = await Promise.all([
      prisma.bankAccount.findMany({ where: { companyId: workspace.company.id } }),
      prisma.journalEntry.findMany({
        where: { fiscalYearId: workspace.fiscalYear.id },
        include: { lines: true, transactions: true },
        orderBy: { num: "asc" },
      }),
    ]);

    const stored = await this.generator.generate({
      companyId: workspace.company.id,
      fiscalYearId: workspace.fiscalYear.id,
      jobId: randomUUID(),
      company: toPaperasseCompany(workspace.company, workspace.fiscalYear, bankAccounts),
      entries: entries.map((entry) => ({
        num: entry.num,
        date: entry.date.toISOString().slice(0, 10),
        journal: entry.journal,
        ref: entry.ref ?? undefined,
        label: entry.label,
        source: entry.source,
        transactionId: entry.transactions[0]?.id ?? "",
        lines: entry.lines.map((line) => ({
          account: line.account,
          accountLabel: line.accountLabel ?? undefined,
          debit: Number(line.debit),
          credit: Number(line.credit),
        })),
      })),
      types: input.types,
    });

    const replacedTypes = documentTypesForGeneration(input.types);
    const oldDocuments = await prisma.document.findMany({
      where: { fiscalYearId: workspace.fiscalYear.id, type: { in: replacedTypes } },
      select: { id: true, storageKey: true },
    });
    if (oldDocuments.length > 0) {
      await prisma.document.deleteMany({ where: { id: { in: oldDocuments.map((document) => document.id) } } });
      await Promise.all(oldDocuments.map((document) => this.storage.delete(document.storageKey)));
    }

    const created = [];
    for (const doc of stored) {
      created.push(await prisma.document.create({
        data: {
          companyId: workspace.company.id,
          fiscalYearId: workspace.fiscalYear.id,
          type: doc.type as DocumentType,
          format: doc.format,
          filename: doc.filename,
          storageKey: doc.storageKey,
          sizeBytes: doc.sizeBytes,
          entriesCount: entries.length,
          generatedBy: doc.generatedBy,
          scriptVersion: doc.scriptVersion,
        },
      }));
    }
    return created.map(summarizeDocument);
  }
}

export function documentTypesForGeneration(types: DocumentGenerationType[]) {
  const documentTypes = new Set<DocumentType>();
  for (const type of types) {
    if (type === "fec") documentTypes.add(DocumentType.FEC);
    if (type === "statements") {
      documentTypes.add(DocumentType.BALANCE);
      documentTypes.add(DocumentType.BILAN);
      documentTypes.add(DocumentType.COMPTE_RESULTAT);
    }
    if (type === "liasse") documentTypes.add(DocumentType.LIASSE_FISCALE);
  }
  return Array.from(documentTypes);
}

function summarizeDocument(document: {
  id: string;
  type: DocumentType;
  filename: string;
  format: string;
  sizeBytes: number | null;
  entriesCount: number | null;
  generatedBy: string;
  scriptVersion: string | null;
  generatedAt: Date;
  status: string;
  errorMessage: string | null;
}): GeneratedDocumentSummary {
  return {
    id: document.id,
    type: document.type,
    filename: document.filename,
    format: document.format,
    sizeBytes: document.sizeBytes,
    entriesCount: document.entriesCount,
    generatedBy: document.generatedBy,
    scriptVersion: document.scriptVersion,
    generatedAt: document.generatedAt.toISOString(),
    status: document.status,
    errorMessage: document.errorMessage,
  };
}

export function toPaperasseCompany(company: Company, fiscalYear: FiscalYear, bankAccounts: BankAccount[]): PaperasseCompanyInput {
  return {
    name: company.name,
    legalForm: company.legalForm,
    capital: company.capital,
    addressStreet: company.addressStreet,
    addressPostal: company.addressPostal,
    addressCity: company.addressCity,
    siren: company.siren,
    siret: company.siret,
    rcs: company.rcs,
    nafCode: company.nafCode,
    managerFirstName: company.managerFirstName,
    managerLastName: company.managerLastName,
    managerCivility: company.managerCivility,
    managerRole: company.managerRole,
    fiscalYearStart: fiscalYear.startDate.toISOString().slice(0, 10),
    fiscalYearEnd: fiscalYear.endDate.toISOString().slice(0, 10),
    vatRegime: company.vatRegime,
    corporateTax: company.corporateTax,
    vatRate: company.vatRate ? Number(company.vatRate) : null,
    bankAccounts,
  };
}
