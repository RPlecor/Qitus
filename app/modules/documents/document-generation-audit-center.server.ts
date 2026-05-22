import type { ActivityLogSummary } from "../activity-log/activity-log-center.server";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import type { GeneratedDocumentSummary, DocumentGenerationType } from "./document-generation-center.server";

export type DocumentGenerationAuditInput = {
  types: DocumentGenerationType[];
  startedAt?: string;
};

export type DocumentGenerationAudit = {
  id: string;
  status: "attempted" | "succeeded" | "failed";
  label: string;
  detail: string;
  types: string[];
  filenames: string[];
  scriptVersion: string | null;
  entriesCount: number | null;
  durationMs: number | null;
  userMessage: string | null;
  createdAt: string;
};

export class DocumentGenerationAuditCenter {
  constructor(private readonly activity = new ActivityLogCenter()) {}

  async recordGenerationAttempt(workspace: CompanyWorkspace, input: DocumentGenerationAuditInput) {
    return this.activity.recordActivity(workspace, {
      action: "document_generation.attempted",
      entityType: "document_generation",
      metadata: {
        types: input.types,
        startedAt: input.startedAt ?? new Date().toISOString(),
      },
    });
  }

  async recordGenerationSuccess(workspace: CompanyWorkspace, result: { types: DocumentGenerationType[]; documents: GeneratedDocumentSummary[]; startedAt: string }) {
    const finishedAt = new Date().toISOString();
    return this.activity.recordActivity(workspace, {
      action: "document_generation.succeeded",
      entityType: "document_generation",
      entityId: result.documents.map((document) => document.id).join(","),
      metadata: {
        types: result.types,
        filenames: result.documents.map((document) => document.filename),
        scriptVersion: result.documents.find((document) => document.scriptVersion)?.scriptVersion ?? null,
        entriesCount: result.documents.find((document) => document.entriesCount !== null)?.entriesCount ?? null,
        startedAt: result.startedAt,
        finishedAt,
        durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(result.startedAt).getTime()),
        userMessage: "Génération documentaire terminée.",
      },
    });
  }

  async recordGenerationFailure(workspace: CompanyWorkspace, error: { types: DocumentGenerationType[]; startedAt: string; userMessage: string }) {
    const finishedAt = new Date().toISOString();
    return this.activity.recordActivity(workspace, {
      action: "document_generation.failed",
      entityType: "document_generation",
      metadata: {
        types: error.types,
        startedAt: error.startedAt,
        finishedAt,
        durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(error.startedAt).getTime()),
        userMessage: error.userMessage,
      },
    });
  }

  async getLatestGenerationAudit(workspace: CompanyWorkspace): Promise<DocumentGenerationAudit | null> {
    const rows = await this.activity.listActivity(workspace, { type: "document_generation", limit: 20 });
    const row = rows.find((candidate) => candidate.action === "document_generation.succeeded" || candidate.action === "document_generation.failed" || candidate.action === "document_generation.attempted");
    return row ? toGenerationAudit(row) : null;
  }

  async getDocumentAuditTrail(workspace: CompanyWorkspace, documentId: string): Promise<DocumentGenerationAudit[]> {
    const rows = await this.activity.listActivity(workspace, { type: "document_generation", limit: 100 });
    return rows
      .filter((row) => row.entityId?.split(",").includes(documentId) || documentId === "")
      .map(toGenerationAudit);
  }
}

export function toGenerationAudit(row: ActivityLogSummary): DocumentGenerationAudit {
  const metadata = row.metadata as Record<string, unknown> | null;
  const status = row.action === "document_generation.failed" ? "failed" : row.action === "document_generation.succeeded" ? "succeeded" : "attempted";
  return {
    id: row.id,
    status,
    label: status === "succeeded" ? "Dernière génération réussie" : status === "failed" ? "Dernière génération échouée" : "Génération lancée",
    detail: typeof metadata?.userMessage === "string" ? metadata.userMessage : "",
    types: Array.isArray(metadata?.types) ? metadata.types.map(String) : [],
    filenames: Array.isArray(metadata?.filenames) ? metadata.filenames.map(String) : [],
    scriptVersion: typeof metadata?.scriptVersion === "string" ? metadata.scriptVersion : null,
    entriesCount: typeof metadata?.entriesCount === "number" ? metadata.entriesCount : null,
    durationMs: typeof metadata?.durationMs === "number" ? metadata.durationMs : null,
    userMessage: typeof metadata?.userMessage === "string" ? metadata.userMessage : null,
    createdAt: row.createdAt,
  };
}
