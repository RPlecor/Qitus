import Decimal from "decimal.js";
import type { EInvoice } from "@prisma/client";
import { assertFiscalYearMutable } from "../annual-closing/annual-closing-center.server";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";

type ProposedLine = {
  account: string;
  accountLabel: string;
  debit: number;
  credit: number;
};

type ProposedJournalEntry = {
  date: string;
  journal: "AC";
  ref: string | null;
  label: string;
  lines: ProposedLine[];
};

export class EInvoiceAccountingDraftCenter {
  constructor(private readonly activity = new ActivityLogCenter()) {}

  async createDraft(workspace: CompanyWorkspace, eInvoiceId: string) {
    const invoice = await this.requireInvoice(workspace, eInvoiceId);
    if (invoice.status === "ERROR") throw new ExpectedRouteError("La facture doit être parsée avant de créer un brouillon comptable.", 409);
    if (!invoice.amountTtc) throw new ExpectedRouteError("Montant TTC manquant : corrigez la facture avant de créer un brouillon.", 409);
    await prisma.eInvoiceAccountingDraft.updateMany({
      where: { eInvoiceId: invoice.id, status: { in: ["DRAFT", "READY"] } },
      data: { status: "SUPERSEDED" },
    });
    const proposed = await this.buildProposedEntry(workspace, invoice);
    assertBalanced(proposed.lines);
    const draft = await prisma.eInvoiceAccountingDraft.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        eInvoiceId: invoice.id,
        status: "READY",
        proposedJournalEntryJson: proposed,
        requiredActionJson: { approveCreatesJournalEntry: true, existingEntriesAreNotModified: true },
      },
    });
    await prisma.eInvoice.update({ where: { id: invoice.id }, data: { status: "ACCOUNTING_DRAFT" } });
    await this.activity.recordActivity(workspace, {
      action: "e_invoice.accounting_draft_created",
      entityType: "e_invoice",
      entityId: invoice.id,
      metadata: { draftId: draft.id, amountTtc: invoice.amountTtc.toString() },
    });
    return summarizeDraft(draft);
  }

  async approveDraft(workspace: CompanyWorkspace, draftId: string) {
    await assertFiscalYearMutable(workspace);
    const draft = await prisma.eInvoiceAccountingDraft.findFirst({
      where: { id: draftId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
      include: { eInvoice: true },
    });
    if (!draft) throw new ExpectedRouteError("Brouillon comptable introuvable.", 404);
    if (draft.status === "APPROVED" && draft.journalEntryId) return summarizeDraft(draft);
    if (draft.status !== "READY" && draft.status !== "DRAFT") throw new ExpectedRouteError("Ce brouillon ne peut plus être approuvé.", 409);
    const proposed = parseProposedEntry(draft.proposedJournalEntryJson);
    assertBalanced(proposed.lines);
    const maxEntry = await prisma.journalEntry.findFirst({
      where: { fiscalYearId: workspace.fiscalYear.id },
      orderBy: { num: "desc" },
    });
    const journalEntry = await prisma.journalEntry.create({
      data: {
        fiscalYearId: workspace.fiscalYear.id,
        num: (maxEntry?.num ?? 0) + 1,
        date: new Date(proposed.date),
        journal: proposed.journal,
        ref: proposed.ref,
        label: proposed.label,
        source: "E_INVOICE",
        lines: {
          create: proposed.lines.map((line) => ({
            account: line.account,
            accountLabel: line.accountLabel,
            debit: line.debit,
            credit: line.credit,
          })),
        },
      },
    });
    const updated = await prisma.eInvoiceAccountingDraft.update({
      where: { id: draft.id },
      data: {
        status: "APPROVED",
        approvedByUserId: workspace.user.id,
        approvedAt: new Date(),
        journalEntryId: journalEntry.id,
      },
    });
    if (draft.eInvoice.attachmentId) {
      await prisma.attachmentLink.upsert({
        where: {
          attachmentId_entityType_entityId_relationType: {
            attachmentId: draft.eInvoice.attachmentId,
            entityType: "JOURNAL_ENTRY",
            entityId: journalEntry.id,
            relationType: "INVOICE",
          },
        },
        create: {
          attachmentId: draft.eInvoice.attachmentId,
          entityType: "JOURNAL_ENTRY",
          entityId: journalEntry.id,
          relationType: "INVOICE",
          note: "Facture électronique approuvée",
          createdByUserId: workspace.user.id,
        },
        update: { note: "Facture électronique approuvée" },
      });
    }
    await prisma.eInvoice.update({ where: { id: draft.eInvoiceId }, data: { status: "ACCOUNTED" } });
    await this.activity.recordActivity(workspace, {
      action: "e_invoice.accounting_approved",
      entityType: "e_invoice",
      entityId: draft.eInvoiceId,
      metadata: { draftId: draft.id, journalEntryId: journalEntry.id },
    });
    return summarizeDraft(updated);
  }

  async rejectDraft(workspace: CompanyWorkspace, input: { draftId: string; note: string }) {
    const note = input.note.trim();
    if (!note) throw new ExpectedRouteError("Une note est requise pour rejeter le brouillon.", 400);
    const draft = await prisma.eInvoiceAccountingDraft.findFirst({
      where: { id: input.draftId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
    });
    if (!draft) throw new ExpectedRouteError("Brouillon comptable introuvable.", 404);
    if (draft.status === "APPROVED") throw new ExpectedRouteError("Une écriture déjà approuvée ne peut pas être rejetée.", 409);
    const updated = await prisma.eInvoiceAccountingDraft.update({
      where: { id: draft.id },
      data: { status: "REJECTED", note, rejectedAt: new Date() },
    });
    await this.activity.recordActivity(workspace, {
      action: "e_invoice.accounting_rejected",
      entityType: "e_invoice",
      entityId: draft.eInvoiceId,
      metadata: { draftId: draft.id, note },
    });
    return summarizeDraft(updated);
  }

  private async requireInvoice(workspace: CompanyWorkspace, eInvoiceId: string) {
    const invoice = await prisma.eInvoice.findFirst({
      where: { id: eInvoiceId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
    });
    if (!invoice) throw new ExpectedRouteError("Facture électronique introuvable.", 404);
    return invoice;
  }

  private async buildProposedEntry(workspace: CompanyWorkspace, invoice: EInvoice): Promise<ProposedJournalEntry> {
    const mapping = await findVendorMapping(workspace, invoice.supplierName);
    const amountVat = decimal(invoice.amountVat);
    const amountTtc = decimal(invoice.amountTtc);
    const amountHt = invoice.amountHt ? decimal(invoice.amountHt) : amountTtc.minus(amountVat);
    const label = `Facture ${invoice.supplierName ?? "fournisseur"}${invoice.invoiceNumber ? ` ${invoice.invoiceNumber}` : ""}`;
    const lines: ProposedLine[] = [
      {
        account: mapping?.accountDebit ?? "607",
        accountLabel: mapping?.accountLabel ?? "Achats de marchandises",
        debit: amountHt.toDecimalPlaces(2).toNumber(),
        credit: 0,
      },
    ];
    if (amountVat.gt(0)) {
      lines.push({
        account: "44566",
        accountLabel: "TVA déductible",
        debit: amountVat.toDecimalPlaces(2).toNumber(),
        credit: 0,
      });
    }
    lines.push({
      account: "401",
      accountLabel: `Fournisseur ${invoice.supplierName ?? ""}`.trim(),
      debit: 0,
      credit: amountTtc.toDecimalPlaces(2).toNumber(),
    });
    return {
      date: (invoice.issueDate ?? workspace.fiscalYear.endDate).toISOString().slice(0, 10),
      journal: "AC",
      ref: invoice.invoiceNumber,
      label,
      lines,
    };
  }
}

async function findVendorMapping(workspace: CompanyWorkspace, supplierName: string | null) {
  if (!supplierName) return null;
  const mappings = await prisma.vendorMapping.findMany({
    where: {
      active: true,
      OR: [{ companyId: workspace.company.id }, { companyId: null }],
    },
    orderBy: [{ companyId: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  const supplier = supplierName.toLowerCase();
  return mappings.find((mapping) => supplier.includes(mapping.pattern.toLowerCase()) || mapping.pattern.toLowerCase().includes(supplier)) ?? null;
}

function decimal(value: { toString(): string } | null) {
  return new Decimal(value?.toString() ?? 0);
}

function assertBalanced(lines: ProposedLine[]) {
  const debit = lines.reduce((sum, line) => sum.plus(line.debit), new Decimal(0));
  const credit = lines.reduce((sum, line) => sum.plus(line.credit), new Decimal(0));
  if (!debit.equals(credit)) throw new ExpectedRouteError("Le brouillon comptable n'est pas équilibré.", 409);
}

function parseProposedEntry(value: unknown): ProposedJournalEntry {
  const entry = value as ProposedJournalEntry;
  if (!entry || !Array.isArray(entry.lines) || !entry.date || !entry.journal) {
    throw new ExpectedRouteError("Brouillon comptable invalide.", 409);
  }
  return entry;
}

function summarizeDraft(draft: {
  id: string;
  eInvoiceId: string;
  status: string;
  proposedJournalEntryJson: unknown;
  journalEntryId: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: draft.id,
    eInvoiceId: draft.eInvoiceId,
    status: draft.status,
    proposedJournalEntry: draft.proposedJournalEntryJson,
    journalEntryId: draft.journalEntryId,
    note: draft.note,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  };
}
