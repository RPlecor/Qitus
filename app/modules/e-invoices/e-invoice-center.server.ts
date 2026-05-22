import { createHash, randomUUID } from "node:crypto";
import type { EInvoiceFormat, EInvoiceSource } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { LocalEvidenceStorageAdapter, type EvidenceStorageAdapter } from "../evidence/evidence-storage-adapter.server";
import { ExpectedRouteError } from "../route-errors.server";
import { StructuredInvoiceParserCenter } from "./structured-invoice-parser-center.server";
import type { StructuredInvoicePayload } from "./structured-invoice-types.server";

export type EInvoiceListFilters = {
  status?: string | null;
  limit?: number;
};

export type EInvoiceProviderPayload = {
  providerConnectionId?: string | null;
  sourceId: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
};

export class EInvoiceCenter {
  constructor(
    private readonly parser = new StructuredInvoiceParserCenter(),
    private readonly storage: EvidenceStorageAdapter = new LocalEvidenceStorageAdapter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async ingestAttachment(workspace: CompanyWorkspace, input: { attachmentId: string; filename: string; mimeType: string; bytes: Buffer }) {
    const attachment = await prisma.attachment.findFirst({
      where: { id: input.attachmentId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
    });
    if (!attachment) throw new ExpectedRouteError("Pièce introuvable.", 404);
    const parsed = await this.safeParse(workspace, { ...input, source: "UPLOAD", sourceId: null, attachmentId: attachment.id, rawAttachmentStorageKey: attachment.storageKey });
    if (!parsed) return null;
    await prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        status: parsed.status === "ERROR" ? "EXTRACTION_FAILED" : "EXTRACTED",
        supplierName: parsed.supplierName,
        invoiceDate: parsed.issueDate,
        invoiceNumber: parsed.invoiceNumber,
        amountHt: parsed.amountHt,
        amountVat: parsed.amountVat,
        amountTtc: parsed.amountTtc,
        currency: parsed.currency,
        extractedText: parsed.rawXmlStorageKey ? "Facture électronique structurée détectée." : attachment.extractedText,
        extractedJson: {
          ...(typeof attachment.extractedJson === "object" && attachment.extractedJson ? attachment.extractedJson as Record<string, unknown> : {}),
          eInvoiceId: parsed.id,
          eInvoiceFormat: parsed.format,
          eInvoiceStatus: parsed.status,
        },
      },
    });
    return this.getEInvoiceDetail(workspace, parsed.id);
  }

  async ingestProviderInvoice(workspace: CompanyWorkspace, input: EInvoiceProviderPayload) {
    return this.safeParse(workspace, { ...input, source: "PROVIDER", attachmentId: null, rawAttachmentStorageKey: null });
  }

  async listEInvoices(workspace: CompanyWorkspace, filters: EInvoiceListFilters = {}) {
    const rows = await prisma.eInvoice.findMany({
      where: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        status: parseEInvoiceStatus(filters.status),
        archivedAt: null,
      },
      include: { attachment: true, accountingDrafts: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(filters.limit ?? 100, 1), 500),
    });
    return rows.map((row) => summarizeEInvoice(row));
  }

  async getEInvoiceDetail(workspace: CompanyWorkspace, id: string) {
    const invoice = await prisma.eInvoice.findFirst({
      where: { id, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
      include: {
        attachment: true,
        accountingDrafts: { orderBy: { createdAt: "desc" }, include: { journalEntry: true } },
      },
    });
    if (!invoice) throw new ExpectedRouteError("Facture électronique introuvable.", 404);
    return {
      ...summarizeEInvoice(invoice),
      rawXmlStorageKey: invoice.rawXmlStorageKey,
      buyerName: invoice.buyerName,
      buyerSiret: invoice.buyerSiret,
      supplierSiret: invoice.supplierSiret,
      dueDate: invoice.dueDate?.toISOString().slice(0, 10) ?? null,
      vatBreakdown: invoice.vatBreakdownJson,
      lines: invoice.linesJson,
      errorMessage: invoice.errorMessage,
      attachment: invoice.attachment ? {
        id: invoice.attachment.id,
        filename: invoice.attachment.originalFilename,
        mimeType: invoice.attachment.mimeType,
      } : null,
      accountingDrafts: invoice.accountingDrafts.map((draft) => ({
        id: draft.id,
        status: draft.status,
        proposedJournalEntry: draft.proposedJournalEntryJson,
        proposedLinks: draft.proposedLinksJson,
        requiredAction: draft.requiredActionJson,
        note: draft.note,
        journalEntryId: draft.journalEntryId,
        createdAt: draft.createdAt.toISOString(),
      })),
    };
  }

  async reparseEInvoice(workspace: CompanyWorkspace, id: string) {
    const invoice = await prisma.eInvoice.findFirst({
      where: { id, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
      include: { attachment: true },
    });
    if (!invoice) throw new ExpectedRouteError("Facture électronique introuvable.", 404);
    if (!invoice.attachment) throw new ExpectedRouteError("Cette facture n'a pas de pièce source locale à reparcourir.", 409);
    const stored = await this.storage.get(invoice.attachment.storageKey);
    await prisma.eInvoiceAccountingDraft.updateMany({
      where: { eInvoiceId: invoice.id, status: { in: ["DRAFT", "READY"] } },
      data: { status: "SUPERSEDED" },
    });
    return this.ingestAttachment(workspace, {
      attachmentId: invoice.attachment.id,
      filename: invoice.attachment.originalFilename,
      mimeType: invoice.attachment.mimeType,
      bytes: stored.body,
    });
  }

  async archiveEInvoice(workspace: CompanyWorkspace, id: string) {
    const invoice = await prisma.eInvoice.findFirst({ where: { id, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id } });
    if (!invoice) throw new ExpectedRouteError("Facture électronique introuvable.", 404);
    const updated = await prisma.eInvoice.update({ where: { id: invoice.id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
    await this.activity.recordActivity(workspace, { action: "e_invoice.archived", entityType: "e_invoice", entityId: updated.id, metadata: { invoiceNumber: updated.invoiceNumber } });
    return summarizeEInvoice({ ...updated, attachment: null, accountingDrafts: [] });
  }

  private async safeParse(workspace: CompanyWorkspace, input: {
    filename: string;
    mimeType: string;
    bytes: Buffer;
    source: EInvoiceSource;
    sourceId: string | null;
    attachmentId: string | null;
    providerConnectionId?: string | null;
    rawAttachmentStorageKey: string | null;
  }) {
    const bytesChecksum = createHash("sha256").update(input.bytes).digest("hex");
    try {
      const parsed = this.parser.parse(input);
      if (!parsed.structured) return null;
      const checksum = this.parser.checksum(parsed.payload.rawXml);
      const rawXmlStorageKey = input.rawAttachmentStorageKey && isXml(input.mimeType, input.filename)
        ? input.rawAttachmentStorageKey
        : await this.storeRawXml(workspace, parsed.payload);
      const invoice = await this.upsertParsedInvoice(workspace, {
        payload: parsed.payload,
        checksum,
        rawXmlStorageKey,
        source: input.source,
        sourceId: input.sourceId,
        attachmentId: input.attachmentId,
        providerConnectionId: input.providerConnectionId ?? null,
      });
      await this.activity.recordActivity(workspace, {
        action: invoice.createdAt.getTime() === invoice.updatedAt.getTime() ? "e_invoice.received" : "e_invoice.parsed",
        entityType: "e_invoice",
        entityId: invoice.id,
        metadata: { format: invoice.format, invoiceNumber: invoice.invoiceNumber, supplierName: invoice.supplierName },
      });
      return invoice;
    } catch (error) {
      if (!looksLikeStructuredInvoice(input)) return null;
      const message = error instanceof Error ? error.message : "Facture électronique illisible.";
      const invoice = await prisma.eInvoice.upsert({
        where: { companyId_fiscalYearId_checksum: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, checksum: bytesChecksum } },
        create: {
          companyId: workspace.company.id,
          fiscalYearId: workspace.fiscalYear.id,
          attachmentId: input.attachmentId,
          providerConnectionId: input.providerConnectionId ?? null,
          source: input.source,
          sourceId: input.sourceId,
          format: "UNKNOWN",
          status: "ERROR",
          checksum: bytesChecksum,
          errorMessage: message,
        },
        update: { attachmentId: input.attachmentId, status: "ERROR", errorMessage: message },
      });
      await this.activity.recordActivity(workspace, {
        action: "e_invoice.parse_failed",
        entityType: "e_invoice",
        entityId: invoice.id,
        metadata: { filename: input.filename, error: message },
      });
      return invoice;
    }
  }

  private async upsertParsedInvoice(workspace: CompanyWorkspace, input: {
    payload: StructuredInvoicePayload;
    checksum: string;
    rawXmlStorageKey: string;
    source: EInvoiceSource;
    sourceId: string | null;
    attachmentId: string | null;
    providerConnectionId: string | null;
  }) {
    const data = payloadToPrisma(input.payload, {
      companyId: workspace.company.id,
      fiscalYearId: workspace.fiscalYear.id,
      source: input.source,
      sourceId: input.sourceId,
      checksum: input.checksum,
      rawXmlStorageKey: input.rawXmlStorageKey,
      attachmentId: input.attachmentId,
      providerConnectionId: input.providerConnectionId,
    });
    const existing = await prisma.eInvoice.findUnique({
      where: { companyId_fiscalYearId_checksum: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, checksum: input.checksum } },
    });
    if (existing) return prisma.eInvoice.update({ where: { id: existing.id }, data });
    return prisma.eInvoice.create({ data });
  }

  private async storeRawXml(workspace: CompanyWorkspace, payload: StructuredInvoicePayload) {
    const key = `${workspace.company.id}/${workspace.fiscalYear.id}/e-invoices/${randomUUID()}-${payload.format.toLowerCase()}.xml`;
    const stored = await this.storage.put(Buffer.from(payload.rawXml, "utf8"), key);
    return stored.key;
  }
}

function payloadToPrisma(payload: StructuredInvoicePayload, base: {
  companyId: string;
  fiscalYearId: string;
  source: EInvoiceSource;
  sourceId: string | null;
  checksum: string;
  rawXmlStorageKey: string;
  attachmentId: string | null;
  providerConnectionId: string | null;
}) {
  return {
    companyId: base.companyId,
    fiscalYearId: base.fiscalYearId,
    attachmentId: base.attachmentId,
    providerConnectionId: base.providerConnectionId,
    source: base.source,
    sourceId: base.sourceId,
    format: payload.format,
    status: "PARSED" as const,
    checksum: base.checksum,
    rawXmlStorageKey: base.rawXmlStorageKey,
    supplierName: payload.supplierName,
    supplierSiret: payload.supplierSiret,
    buyerName: payload.buyerName,
    buyerSiret: payload.buyerSiret,
    invoiceNumber: payload.invoiceNumber,
    issueDate: payload.issueDate ? new Date(payload.issueDate) : null,
    dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
    currency: payload.currency ?? "EUR",
    amountHt: payload.amountHt,
    amountVat: payload.amountVat,
    amountTtc: payload.amountTtc,
    vatBreakdownJson: payload.vatBreakdown,
    linesJson: payload.lines,
    errorMessage: null,
    archivedAt: null,
  };
}

export function summarizeEInvoice(invoice: {
  id: string;
  source: string;
  format: string;
  status: string;
  supplierName: string | null;
  invoiceNumber: string | null;
  issueDate: Date | null;
  currency: string | null;
  amountHt: { toString(): string } | null;
  amountVat: { toString(): string } | null;
  amountTtc: { toString(): string } | null;
  attachment?: { id: string; originalFilename: string } | null;
  accountingDrafts?: Array<{ id: string; status: string; journalEntryId?: string | null }>;
  createdAt: Date;
  updatedAt: Date;
}) {
  const latestDraft = invoice.accountingDrafts?.[0] ?? null;
  return {
    id: invoice.id,
    source: invoice.source,
    format: invoice.format,
    status: invoice.status,
    supplierName: invoice.supplierName,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate?.toISOString().slice(0, 10) ?? null,
    currency: invoice.currency ?? "EUR",
    amountHt: invoice.amountHt?.toString() ?? null,
    amountVat: invoice.amountVat?.toString() ?? null,
    amountTtc: invoice.amountTtc?.toString() ?? null,
    attachmentId: invoice.attachment?.id ?? null,
    attachmentFilename: invoice.attachment?.originalFilename ?? null,
    latestDraftStatus: latestDraft?.status ?? null,
    journalEntryId: latestDraft?.journalEntryId ?? null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

function parseEInvoiceStatus(value?: string | null) {
  const statuses = ["RECEIVED", "PARSED", "MATCHED", "ACCOUNTING_DRAFT", "ACCOUNTED", "NEEDS_REVIEW", "ARCHIVED", "ERROR"];
  return statuses.includes(value ?? "") ? value as never : undefined;
}

function isXml(mimeType: string, filename: string) {
  return mimeType === "application/xml" || mimeType === "text/xml" || filename.toLowerCase().endsWith(".xml");
}

function looksLikeStructuredInvoice(input: { filename: string; mimeType: string; bytes: Buffer }) {
  return isXml(input.mimeType, input.filename) || input.bytes.toString("utf8", 0, Math.min(input.bytes.length, 5000)).includes("Invoice");
}
