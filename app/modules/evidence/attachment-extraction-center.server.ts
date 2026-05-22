import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { LocalEvidenceStorageAdapter, type EvidenceStorageAdapter } from "./evidence-storage-adapter.server";

const execFileAsync = promisify(execFile);

export type ManualExtractionInput = {
  attachmentId: string;
  supplierName?: string | null;
  invoiceDate?: string | null;
  invoiceNumber?: string | null;
  amountHt?: string | null;
  amountVat?: string | null;
  amountTtc?: string | null;
  currency?: string | null;
  extractedText?: string | null;
};

export type AttachmentExtractionSummary = {
  status: string;
  supplierName: string | null;
  invoiceDate: string | null;
  invoiceNumber: string | null;
  amountHt: string | null;
  amountVat: string | null;
  amountTtc: string | null;
  currency: string | null;
  extractedTextPreview: string | null;
};

export class AttachmentExtractionCenter {
  constructor(
    private readonly storage: EvidenceStorageAdapter = new LocalEvidenceStorageAdapter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async extractAttachment(workspace: CompanyWorkspace, attachmentId: string) {
    const attachment = await this.requireAttachment(workspace, attachmentId);
    try {
      const extractedText = await this.extractText(attachment);
      const parsed = parseExtractedText(extractedText);
      const updated = await prisma.attachment.update({
        where: { id: attachment.id },
        data: {
          status: "EXTRACTED",
          extractedText,
          extractedJson: parsed,
          supplierName: parsed.supplierName,
          invoiceDate: parsed.invoiceDate ? new Date(parsed.invoiceDate) : null,
          invoiceNumber: parsed.invoiceNumber,
          amountHt: parsed.amountHt,
          amountVat: parsed.amountVat,
          amountTtc: parsed.amountTtc,
          currency: parsed.currency ?? "EUR",
        },
      });
      await this.activity.recordActivity(workspace, {
        action: "attachment.extracted",
        entityType: "attachment",
        entityId: attachment.id,
        metadata: { filename: attachment.originalFilename, supplierName: parsed.supplierName },
      });
      return this.summarize(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : "Extraction impossible.";
      const updated = await prisma.attachment.update({
        where: { id: attachment.id },
        data: {
          status: "EXTRACTION_FAILED",
          extractedJson: { error: message },
        },
      });
      await this.activity.recordActivity(workspace, {
        action: "attachment.extraction_failed",
        entityType: "attachment",
        entityId: attachment.id,
        metadata: { filename: attachment.originalFilename, error: message },
      });
      return this.summarize(updated);
    }
  }

  async saveManualExtraction(workspace: CompanyWorkspace, input: ManualExtractionInput) {
    const attachment = await this.requireAttachment(workspace, input.attachmentId);
    const updated = await prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        status: "EXTRACTED",
        supplierName: emptyToNull(input.supplierName),
        invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : null,
        invoiceNumber: emptyToNull(input.invoiceNumber),
        amountHt: parseDecimalInput(input.amountHt),
        amountVat: parseDecimalInput(input.amountVat),
        amountTtc: parseDecimalInput(input.amountTtc),
        currency: emptyToNull(input.currency) ?? "EUR",
        extractedText: emptyToNull(input.extractedText) ?? attachment.extractedText,
        extractedJson: {
          ...(typeof attachment.extractedJson === "object" && attachment.extractedJson ? attachment.extractedJson as Record<string, unknown> : {}),
          manual: true,
        },
      },
    });
    await this.activity.recordActivity(workspace, {
      action: "attachment.manual_extraction_updated",
      entityType: "attachment",
      entityId: attachment.id,
      metadata: { filename: attachment.originalFilename },
    });
    return this.summarize(updated);
  }

  async getExtractionSummary(workspace: CompanyWorkspace, attachmentId: string) {
    return this.summarize(await this.requireAttachment(workspace, attachmentId));
  }

  private async extractText(attachment: { storageKey: string; mimeType: string; originalFilename: string }) {
    const stored = await this.storage.get(attachment.storageKey);
    if (attachment.mimeType === "text/plain") return stored.body.toString("utf8");

    const dir = path.join(process.cwd(), "tmp", "evidence-extraction");
    await mkdir(dir, { recursive: true });
    const sourcePath = path.join(dir, `${randomUUID()}-${attachment.originalFilename.replace(/[^a-zA-Z0-9._-]+/g, "-")}`);
    await writeFile(sourcePath, stored.body);
    try {
      if (attachment.mimeType === "application/xml" || attachment.mimeType === "text/xml") {
        return stored.body.toString("utf8");
      }
      if (attachment.mimeType === "application/pdf") {
        const result = await execFileAsync("pdftotext", [sourcePath, "-"], { timeout: 15_000, maxBuffer: 2_000_000 });
        return result.stdout.trim();
      }
      if (attachment.mimeType === "image/png" || attachment.mimeType === "image/jpeg") {
        const result = await execFileAsync("tesseract", [sourcePath, "stdout"], { timeout: 20_000, maxBuffer: 2_000_000 });
        return result.stdout.trim();
      }
      throw new Error("Type de fichier non extractible automatiquement.");
    } finally {
      await rm(sourcePath, { force: true }).catch(() => undefined);
    }
  }

  private async requireAttachment(workspace: CompanyWorkspace, attachmentId: string) {
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
    });
    if (!attachment) throw new ExpectedRouteError("Pièce introuvable.", 404);
    return attachment;
  }

  private summarize(attachment: {
    status: string;
    supplierName: string | null;
    invoiceDate: Date | null;
    invoiceNumber: string | null;
    amountHt: { toString(): string } | null;
    amountVat: { toString(): string } | null;
    amountTtc: { toString(): string } | null;
    currency: string | null;
    extractedText: string | null;
  }): AttachmentExtractionSummary {
    return {
      status: attachment.status,
      supplierName: attachment.supplierName,
      invoiceDate: attachment.invoiceDate?.toISOString().slice(0, 10) ?? null,
      invoiceNumber: attachment.invoiceNumber,
      amountHt: attachment.amountHt?.toString() ?? null,
      amountVat: attachment.amountVat?.toString() ?? null,
      amountTtc: attachment.amountTtc?.toString() ?? null,
      currency: attachment.currency,
      extractedTextPreview: attachment.extractedText?.slice(0, 500) ?? null,
    };
  }
}

export function parseExtractedText(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const invoiceNumber = matchFirst(text, /(?:facture|invoice|n[°o]|num[ée]ro)\s*[:#-]?\s*([A-Z0-9._/-]{3,})/i);
  const invoiceDate = normalizeDate(matchFirst(text, /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/));
  const amountTtc = parseMoney(matchFirst(text, /(?:ttc|total\s+ttc|total)\s*[:=]?\s*([0-9\s.,]+)\s*(?:€|eur)?/i));
  const amountVat = parseMoney(matchFirst(text, /(?:tva|vat)\s*[:=]?\s*([0-9\s.,]+)\s*(?:€|eur)?/i));
  const amountHt = parseMoney(matchFirst(text, /(?:ht|hors taxe|subtotal)\s*[:=]?\s*([0-9\s.,]+)\s*(?:€|eur)?/i));
  return {
    supplierName: lines[0]?.slice(0, 120) ?? null,
    invoiceDate,
    invoiceNumber,
    amountHt,
    amountVat,
    amountTtc,
    currency: text.includes("€") || /eur/i.test(text) ? "EUR" : "EUR",
  };
}

function matchFirst(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.trim() ?? null;
}

function normalizeDate(value: string | null) {
  if (!value) return null;
  const [day, month, year] = value.split(/[/-]/);
  if (!day || !month || !year) return null;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseMoney(value: string | null) {
  if (!value) return null;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}

function parseDecimalInput(value?: string | null) {
  const normalized = emptyToNull(value)?.replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
