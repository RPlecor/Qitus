import { DocumentType, type Company, type FiscalYear } from "@prisma/client";
import { prisma } from "../db.server";
import { DocumentCatalog } from "./document-catalog.server";
import {
  DocumentGenerationCenter,
  documentTypesForGeneration,
  type DocumentGenerationType,
  type GeneratedDocumentSummary,
} from "./document-generation-center.server";
import { LocalDocumentStorageAdapter } from "./document-storage-adapter.server";

export type { DocumentGenerationType };

export type DocumentSummary = {
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

export class DocumentCenter {
  constructor(
    private readonly catalog = new DocumentCatalog(),
    private readonly generation = new DocumentGenerationCenter(),
    private readonly storage = new LocalDocumentStorageAdapter()
  ) {}

  async listDocuments(fiscalYearId: string): Promise<DocumentSummary[]> {
    const documents = await prisma.document.findMany({
      where: { fiscalYearId },
      orderBy: { generatedAt: "desc" },
    });
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
    }));
  }

  async generateDocuments(input: {
    company: Company;
    fiscalYear: FiscalYear;
    types: Array<Exclude<DocumentGenerationType, "liasse">>;
  }): Promise<GeneratedDocumentSummary[]> {
    return this.generation.generateDocuments({ company: input.company, fiscalYear: input.fiscalYear } as never, { types: input.types });
  }

  async getDownload(documentId: string, options?: { fiscalYearId?: string }) {
    if (!options?.fiscalYearId) return this.catalog.getDownload({ fiscalYear: { id: "" } } as never, documentId);
    const document = await prisma.document.findFirstOrThrow({
      where: { id: documentId, fiscalYearId: options.fiscalYearId },
    });
    const stored = await this.storage.get(document.storageKey);
    return {
      body: stored.body,
      filename: document.filename,
      contentType: document.format === "txt" ? "text/plain" : document.format === "pdf" ? "application/pdf" : document.format === "json" ? "application/json" : "text/markdown",
    };
  }
}

export { documentTypesForGeneration };

export function qitusDocumentErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.split("\n")[0] || "La génération du document a échoué.";
  return "La génération du document a échoué.";
}
