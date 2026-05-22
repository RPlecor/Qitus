import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { JournalExplorer } from "../journal/journal-explorer.server";
import { LocalDocumentStorageAdapter, type DocumentStorageAdapter } from "../documents/document-storage-adapter.server";
import { toPaperasseCompany } from "../documents/document-generation-center.server";
import { VatLedgerPolicy } from "../ledger/vat-ledger-policy";
import { PaperassePdfRenderer } from "./paperasse-pdf-renderer.server";
import { TaxPackageTemplateRenderer } from "./tax-package-template-renderer.server";

export type TaxPackageSummary = {
  documentId: string | null;
  filename: string;
  pdfDocumentId: string | null;
  pdfFilename: string | null;
  status: "missing" | "ready";
  generatedAt: string | null;
};

export class TaxPackageDraftCenter {
  constructor(
    private readonly journal = new JournalExplorer(),
    private readonly storage: DocumentStorageAdapter = new LocalDocumentStorageAdapter(),
    private readonly vatPolicy = new VatLedgerPolicy(),
    private readonly renderer = new TaxPackageTemplateRenderer(),
    private readonly pdfRenderer = new PaperassePdfRenderer()
  ) {}

  async getTaxPackageSummary(workspace: CompanyWorkspace): Promise<TaxPackageSummary> {
    const [document, pdfDocument] = await Promise.all([
      prisma.document.findFirst({
        where: { fiscalYearId: workspace.fiscalYear.id, type: DocumentType.LIASSE_FISCALE, format: { in: ["md", "html"] } },
        orderBy: { generatedAt: "desc" },
      }),
      prisma.document.findFirst({
        where: { fiscalYearId: workspace.fiscalYear.id, type: DocumentType.LIASSE_FISCALE, format: "pdf" },
        orderBy: { generatedAt: "desc" },
      }),
    ]);
    return {
      documentId: document?.id ?? null,
      filename: document?.filename ?? `liasse-fiscale-${workspace.fiscalYear.endDate.getFullYear()}-brouillon.md`,
      pdfDocumentId: pdfDocument?.id ?? null,
      pdfFilename: pdfDocument?.filename ?? null,
      status: document ? "ready" : "missing",
      generatedAt: document?.generatedAt.toISOString() ?? null,
    };
  }

  async generateTaxPackageDraft(workspace: CompanyWorkspace, options: { generatePdf?: boolean } = {}) {
    const [journal, vat, bankAccounts, entries] = await Promise.all([
      this.journal.summarizeJournal(workspace),
      this.vatPolicy.summarizeVatForFiscalYear(workspace),
      prisma.bankAccount.findMany({ where: { companyId: workspace.company.id } }),
      prisma.journalEntry.findMany({
        where: { fiscalYearId: workspace.fiscalYear.id },
        include: { lines: true, transactions: true },
        orderBy: { num: "asc" },
      }),
    ]);
    const filename = `liasse-fiscale-${workspace.fiscalYear.endDate.getFullYear()}-brouillon.md`;
    const source = this.renderer.renderStructuredSource({ workspace, journal, vat });
    const storageKey = `${workspace.company.id}/${workspace.fiscalYear.id}/tax-package/${randomUUID()}-${filename}`;
    const sourcePath = path.join(process.cwd(), "tmp", "tax-package", storageKey.replace(/\//g, "_"));
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, source, "utf8");
    const stored = await this.storage.put(sourcePath, storageKey);

    const oldDocuments = await prisma.document.findMany({
      orderBy: { generatedAt: "desc" },
      where: { fiscalYearId: workspace.fiscalYear.id, type: DocumentType.LIASSE_FISCALE },
      select: { id: true, storageKey: true },
    });
    if (oldDocuments.length > 0) {
      await prisma.document.deleteMany({ where: { id: { in: oldDocuments.map((document) => document.id) } } });
      await Promise.all(oldDocuments.map((document) => this.storage.delete(document.storageKey)));
    }

    const created = [];
    const document = await prisma.document.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        type: DocumentType.LIASSE_FISCALE,
        format: "md",
        storageKey: stored.key,
        filename,
        sizeBytes: stored.sizeBytes,
        entriesCount: journal.entriesCount,
        generatedBy: "tax-package-template-renderer",
        scriptVersion: "phase-8-5-structured-source",
      },
    });
    created.push(document);

    if (options.generatePdf ?? process.env.ENABLE_PDF_GENERATION === "1") {
      const pdf = await this.pdfRenderer.renderPdfFromStructuredSource({
        companyId: workspace.company.id,
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
        sourceMarkdown: source,
      });
      if (pdf.status === "ready") {
        const pdfKey = `${workspace.company.id}/${workspace.fiscalYear.id}/tax-package/${randomUUID()}-${pdf.filename}`;
        const pdfStored = await this.storage.put(pdf.path, pdfKey);
        created.push(await prisma.document.create({
          data: {
            companyId: workspace.company.id,
            fiscalYearId: workspace.fiscalYear.id,
            type: DocumentType.LIASSE_FISCALE,
            format: "pdf",
            storageKey: pdfStored.key,
            filename: pdf.filename,
            sizeBytes: pdfStored.sizeBytes,
            entriesCount: journal.entriesCount,
            generatedBy: "script:generate-pdfs",
            scriptVersion: pdf.scriptVersion,
          },
        }));
      }
    }

    return {
      documentId: document.id,
      filename: document.filename,
      status: "ready" as const,
      generatedAt: document.generatedAt.toISOString(),
      documents: created.map((doc) => ({
        id: doc.id,
        type: doc.type,
        filename: doc.filename,
        format: doc.format,
        sizeBytes: doc.sizeBytes,
        entriesCount: doc.entriesCount,
        generatedBy: doc.generatedBy,
        scriptVersion: doc.scriptVersion,
        generatedAt: doc.generatedAt.toISOString(),
        status: doc.status,
        errorMessage: doc.errorMessage,
      })),
    };
  }
}
