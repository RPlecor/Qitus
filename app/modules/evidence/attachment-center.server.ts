import { createHash, randomUUID } from "node:crypto";
import type { AttachmentStatus } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { AttachmentExtractionCenter } from "./attachment-extraction-center.server";
import { LocalEvidenceStorageAdapter, type EvidenceStorageAdapter } from "./evidence-storage-adapter.server";
import { EInvoiceCenter } from "../e-invoices/e-invoice-center.server";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain", "application/xml", "text/xml"]);

export type AttachmentUploadInput = {
  filename: string;
  mimeType: string;
  bytes: Buffer;
};

export type AttachmentFilters = {
  status?: string | null;
  orphanOnly?: boolean;
  extractionErrorOnly?: boolean;
  limit?: number;
};

export type AttachmentListItem = {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  supplierName: string | null;
  invoiceDate: string | null;
  invoiceNumber: string | null;
  amountTtc: string | null;
  linksCount: number;
  eInvoiceStatus: string | null;
  createdAt: string;
};

export class AttachmentCenter {
  constructor(
    private readonly storage: EvidenceStorageAdapter = new LocalEvidenceStorageAdapter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async uploadAttachment(workspace: CompanyWorkspace, input: AttachmentUploadInput) {
    validateAttachment(input);
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    const existing = await prisma.attachment.findUnique({
      where: { companyId_fiscalYearId_sha256: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, sha256 } },
      include: { links: true, eInvoices: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (existing && !existing.archivedAt) return summarizeAttachment(existing);
    if (existing?.archivedAt) {
      const restored = await prisma.attachment.update({
        where: { id: existing.id },
        data: { status: "UPLOADED", archivedAt: null },
        include: { links: true, eInvoices: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      await this.activity.recordActivity(workspace, {
        action: "attachment.uploaded",
        entityType: "attachment",
        entityId: restored.id,
        metadata: { filename: restored.originalFilename, restored: true },
      });
      return this.getAttachmentDetail(workspace, restored.id);
    }

    const storageKey = `${workspace.company.id}/${workspace.fiscalYear.id}/${randomUUID()}-${sanitizeFilename(input.filename)}`;
    const stored = await this.storage.put(input.bytes, storageKey);
    const attachment = await prisma.attachment.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        uploadedByUserId: workspace.user.id,
        originalFilename: input.filename,
        mimeType: normalizeMimeType(input.mimeType, input.filename),
        sizeBytes: stored.sizeBytes,
        storageKey: stored.key,
        sha256,
        currency: "EUR",
      },
      include: { links: true, eInvoices: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    await this.activity.recordActivity(workspace, {
      action: "attachment.uploaded",
      entityType: "attachment",
      entityId: attachment.id,
      metadata: { filename: attachment.originalFilename, sizeBytes: attachment.sizeBytes },
    });
    const eInvoice = await new EInvoiceCenter(undefined, this.storage).ingestAttachment(workspace, {
      attachmentId: attachment.id,
      filename: attachment.originalFilename,
      mimeType: attachment.mimeType,
      bytes: input.bytes,
    }).catch(() => undefined);
    if (!eInvoice) await new AttachmentExtractionCenter(this.storage).extractAttachment(workspace, attachment.id).catch(() => undefined);
    return this.getAttachmentDetail(workspace, attachment.id);
  }

  async listAttachments(workspace: CompanyWorkspace, filters: AttachmentFilters = {}): Promise<AttachmentListItem[]> {
    const rows = await prisma.attachment.findMany({
      where: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        status: parseAttachmentStatus(filters.status),
        archivedAt: filters.status === "ARCHIVED" ? { not: null } : filters.status ? undefined : null,
        links: filters.orphanOnly ? { none: {} } : undefined,
        ...(filters.extractionErrorOnly ? { status: "EXTRACTION_FAILED" } : {}),
      },
      include: { links: true, eInvoices: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(filters.limit ?? 100, 1), 500),
    });
    return rows.map(summarizeAttachment);
  }

  async getAttachmentDetail(workspace: CompanyWorkspace, attachmentId: string) {
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
      include: { links: { orderBy: { createdAt: "desc" } }, eInvoices: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!attachment) throw new ExpectedRouteError("Pièce introuvable.", 404);
    return {
      ...summarizeAttachment(attachment),
      storageKey: attachment.storageKey,
      sha256: attachment.sha256,
      extractedText: attachment.extractedText,
      extractedJson: attachment.extractedJson,
      amountHt: attachment.amountHt?.toString() ?? null,
      amountVat: attachment.amountVat?.toString() ?? null,
      currency: attachment.currency,
      archivedAt: attachment.archivedAt?.toISOString() ?? null,
      links: attachment.links.map((link) => ({
        id: link.id,
        entityType: link.entityType,
        entityId: link.entityId,
        relationType: link.relationType,
        note: link.note,
        createdAt: link.createdAt.toISOString(),
      })),
    };
  }

  async downloadAttachment(workspace: CompanyWorkspace, attachmentId: string) {
    const detail = await this.getAttachmentDetail(workspace, attachmentId);
    const stored = await this.storage.get(detail.storageKey);
    return {
      body: stored.body,
      filename: detail.originalFilename,
      contentType: detail.mimeType,
    };
  }

  async archiveAttachment(workspace: CompanyWorkspace, attachmentId: string) {
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
      include: { links: true, eInvoices: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!attachment) throw new ExpectedRouteError("Pièce introuvable.", 404);
    const updated = await prisma.attachment.update({
      where: { id: attachment.id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
      include: { links: true, eInvoices: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    await this.activity.recordActivity(workspace, {
      action: "attachment.archived",
      entityType: "attachment",
      entityId: attachment.id,
      metadata: { filename: attachment.originalFilename },
    });
    return summarizeAttachment(updated);
  }
}

export function summarizeAttachment(attachment: {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  supplierName: string | null;
  invoiceDate: Date | null;
  invoiceNumber: string | null;
  amountTtc: { toString(): string } | null;
  links: unknown[];
  eInvoices?: Array<{ status: string }>;
  createdAt: Date;
}): AttachmentListItem {
  return {
    id: attachment.id,
    originalFilename: attachment.originalFilename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    status: attachment.status,
    supplierName: attachment.supplierName,
    invoiceDate: attachment.invoiceDate?.toISOString().slice(0, 10) ?? null,
    invoiceNumber: attachment.invoiceNumber,
    amountTtc: attachment.amountTtc?.toString() ?? null,
    linksCount: attachment.links.length,
    eInvoiceStatus: attachment.eInvoices?.[0]?.status ?? null,
    createdAt: attachment.createdAt.toISOString(),
  };
}

function validateAttachment(input: AttachmentUploadInput) {
  const mimeType = normalizeMimeType(input.mimeType, input.filename);
  if (!ACCEPTED_MIME_TYPES.has(mimeType)) throw new ExpectedRouteError("Format de pièce non supporté. Formats acceptés : PDF, PNG, JPG, TXT, XML.", 415);
  if (input.bytes.byteLength === 0) throw new ExpectedRouteError("La pièce est vide.", 400);
  if (input.bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new ExpectedRouteError("La pièce dépasse la limite de 10 Mo.", 413);
}

function parseAttachmentStatus(value?: string | null): AttachmentStatus | undefined {
  const allowed = ["UPLOADED", "EXTRACTED", "EXTRACTION_FAILED", "ARCHIVED"];
  return allowed.includes(value ?? "") ? value as AttachmentStatus : undefined;
}

export function normalizeMimeType(mimeType: string, filename: string) {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".xml")) return "application/xml";
  return mimeType || "application/octet-stream";
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "piece";
}
