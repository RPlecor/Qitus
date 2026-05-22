import type { DocumentType } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { DocumentFreshnessCenter, type DocumentFreshnessSummary } from "./document-freshness-center.server";
import { LocalDocumentStorageAdapter, type DocumentStorageAdapter } from "./document-storage-adapter.server";

export type DocumentCatalogItem = {
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
  freshness: DocumentFreshnessSummary | null;
};

export class DocumentCatalog {
  constructor(
    private readonly storage: DocumentStorageAdapter = new LocalDocumentStorageAdapter(),
    private readonly freshness = new DocumentFreshnessCenter()
  ) {}

  async listDocuments(workspace: CompanyWorkspace): Promise<DocumentCatalogItem[]> {
    const [documents, freshness] = await Promise.all([
      prisma.document.findMany({
        where: { fiscalYearId: workspace.fiscalYear.id },
        orderBy: { generatedAt: "desc" },
      }),
      this.freshness.getFreshness(workspace),
    ]);
    const freshnessById = new Map(freshness.documents.map((document) => [document.documentId, document]));
    return documents.map((document) => ({
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
      freshness: freshnessById.get(document.id) ?? null,
    }));
  }

  async getDocumentDetail(workspace: CompanyWorkspace, documentId: string): Promise<DocumentCatalogItem> {
    const document = await prisma.document.findFirstOrThrow({
      where: { id: documentId, fiscalYearId: workspace.fiscalYear.id },
    });
    const freshness = await this.freshness.getFreshness(workspace);
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
      freshness: freshness.documents.find((candidate) => candidate.documentId === document.id) ?? null,
    };
  }

  async getDownload(workspace: CompanyWorkspace, documentId: string) {
    const document = await prisma.document.findFirstOrThrow({
      where: { id: documentId, fiscalYearId: workspace.fiscalYear.id },
    });
    const stored = await this.storage.get(document.storageKey);
    return {
      body: stored.body,
      filename: document.filename,
      contentType: contentTypeFor(document.format),
    };
  }
}

function contentTypeFor(format: string) {
  if (format === "txt") return "text/plain";
  if (format === "json") return "application/json";
  if (format === "csv") return "text/csv";
  if (format === "pdf") return "application/pdf";
  if (format === "html") return "text/html";
  return "text/markdown";
}
