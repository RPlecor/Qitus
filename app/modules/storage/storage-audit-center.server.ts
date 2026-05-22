import { createDocumentStorageAdapter } from "../documents/document-storage-adapter.server";
import { createEvidenceStorageAdapter } from "../evidence/evidence-storage-adapter.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export type StorageAuditItem = {
  id: string;
  kind: "document" | "attachment";
  filename: string;
  storageKey: string;
  expectedSizeBytes: number | null;
  available: boolean;
  sizeBytes: number | null;
  errorMessage: string | null;
};

export class StorageAuditCenter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  async getStorageAudit(workspace: CompanyWorkspace) {
    const [documents, attachments] = await Promise.all([
      this.auditDocuments(workspace),
      this.auditAttachments(workspace),
    ]);
    const items = [...documents, ...attachments];
    const missing = items.filter((item) => !item.available);
    return {
      mode: this.config.objectStorageMode,
      checkedAt: new Date().toISOString(),
      summary: {
        total: items.length,
        available: items.length - missing.length,
        missing: missing.length,
      },
      items,
    };
  }

  async listMissingArtifacts(workspace: CompanyWorkspace) {
    const audit = await this.getStorageAudit(workspace);
    return audit.items.filter((item) => !item.available);
  }

  private async auditDocuments(workspace: CompanyWorkspace): Promise<StorageAuditItem[]> {
    const storage = createDocumentStorageAdapter(this.config);
    const documents = await prisma.document.findMany({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
      orderBy: { generatedAt: "desc" },
    });
    return Promise.all(documents.map(async (document) => {
      try {
        const available = await storage.exists(document.storageKey);
        const bytes = available ? await storage.get(document.storageKey).catch(() => null) : null;
        return {
          id: document.id,
          kind: "document" as const,
          filename: document.filename,
          storageKey: document.storageKey,
          expectedSizeBytes: document.sizeBytes,
          available,
          sizeBytes: bytes?.sizeBytes ?? null,
          errorMessage: null,
        };
      } catch (error) {
        return auditError("document", document.id, document.filename, document.storageKey, document.sizeBytes, error);
      }
    }));
  }

  private async auditAttachments(workspace: CompanyWorkspace): Promise<StorageAuditItem[]> {
    const storage = createEvidenceStorageAdapter(this.config);
    const attachments = await prisma.attachment.findMany({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(attachments.map(async (attachment) => {
      try {
        const available = await storage.exists(attachment.storageKey);
        const bytes = available ? await storage.get(attachment.storageKey).catch(() => null) : null;
        return {
          id: attachment.id,
          kind: "attachment" as const,
          filename: attachment.originalFilename,
          storageKey: attachment.storageKey,
          expectedSizeBytes: attachment.sizeBytes,
          available,
          sizeBytes: bytes?.sizeBytes ?? null,
          errorMessage: null,
        };
      } catch (error) {
        return auditError("attachment", attachment.id, attachment.originalFilename, attachment.storageKey, attachment.sizeBytes, error);
      }
    }));
  }
}

function auditError(
  kind: StorageAuditItem["kind"],
  id: string,
  filename: string,
  storageKey: string,
  expectedSizeBytes: number | null,
  error: unknown
): StorageAuditItem {
  return {
    id,
    kind,
    filename,
    storageKey,
    expectedSizeBytes,
    available: false,
    sizeBytes: null,
    errorMessage: error instanceof Error ? error.message : "Artefact storage indisponible.",
  };
}
