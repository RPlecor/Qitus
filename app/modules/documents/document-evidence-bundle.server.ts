import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { AccountingCoverageCenter, type AccountingCoverageOverview } from "../accounting-coverage/accounting-coverage-center.server";
import { EvidenceRequirementCenter, type EvidenceRequirementSummary } from "../accounting-coverage/evidence-requirement-center.server";
import { LocalEvidenceStorageAdapter, type EvidenceStorageAdapter } from "../evidence/evidence-storage-adapter.server";
import { JournalAuditCenter } from "../journal/journal-audit-center.server";
import { JournalExportCenter } from "../journal/journal-export-center.server";
import { VatLedgerPolicy } from "../ledger/vat-ledger-policy";
import { VatDeclarationCenter } from "../vat/vat-declaration-center.server";
import { VatDeclarationFreshnessCenter } from "../vat/vat-declaration-freshness-center.server";
import { VatPositionCenter, type VatPosition } from "../vat/vat-position-center.server";
import { BankLineReconciliationCenter } from "../reconciliations/bank-line-reconciliation-center.server";
import { ReconciliationIssueWorkflow } from "../reconciliations/reconciliation-issue-workflow.server";
import { ReconciliationReportCenter } from "../reconciliations/reconciliation-report-center.server";
import { StripeReconciliationCenter } from "../reconciliations/stripe-reconciliation-center.server";
import { SuspenseAccountCenter } from "../reconciliations/suspense-account-center.server";
import { ThirdPartyMatchingCenter } from "../reconciliations/third-party-matching-center.server";
import { ClosingWorkpaperCenter } from "../closing-workpapers/closing-workpaper-center.server";
import { ClosingAdjustmentCenter } from "../closing-adjustments/closing-adjustment-center.server";
import { ClosingAdjustmentFreshnessCenter } from "../closing-adjustments/closing-adjustment-freshness-center.server";
import { ClosingAdjustmentReviewWorkflow } from "../closing-adjustments/closing-adjustment-review-workflow.server";
import { DocumentCatalog } from "./document-catalog.server";
import { LocalDocumentStorageAdapter, type DocumentStorageAdapter } from "./document-storage-adapter.server";
import { collectEvidenceSections, type EvidenceSectionProvider } from "./evidence-section-provider.server";

export type EvidenceManifest = {
  generatedAt: string;
  company: {
    id: string;
    name: string;
    siren: string | null;
  };
  fiscalYear: {
    id: string;
    startDate: string;
    endDate: string;
  };
  journal: {
    summary: Awaited<ReturnType<JournalAuditCenter["getAuditSummary"]>>["summary"];
    auditStatus: string;
    csv: string;
  };
  vat: {
    deductible: number;
    collected: number;
    net: number;
    position?: VatPosition;
    declarations?: Array<{
      id: string;
      type: string;
      status: string;
      periodStart: string;
      periodEnd: string;
      documentId: string | null;
      active?: boolean;
      freshness?: unknown;
    }>;
    declarationFreshness?: Awaited<ReturnType<VatDeclarationFreshnessCenter["getFreshness"]>>;
  };
  expertValidation: {
    reviewerName: string | null;
    reviewNote: string | null;
    reviewedAt: string | null;
  } | null;
  coverage: Pick<AccountingCoverageOverview, "score" | "label" | "status" | "covered" | "partial" | "missing" | "highRisk"> & {
    areas: Array<{ code: string; status: string; risk: string; nextPhase: string }>;
  };
  attachments: {
    summary: EvidenceRequirementSummary;
    missingEvidenceSummary: {
      required: number;
      recommended: number;
      labels: string[];
    };
    files: Array<{
      id: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
      status: string;
      available: boolean;
      contentBase64: string | null;
      links: Array<{ entityType: string; entityId: string; relationType: string }>;
    }>;
  };
  eInvoices: {
    manifest: Array<{
      id: string;
      source: string;
      format: string;
      status: string;
      supplierName: string | null;
      supplierSiret: string | null;
      invoiceNumber: string | null;
      issueDate: string | null;
      amountHt: string | null;
      amountVat: string | null;
      amountTtc: string | null;
      attachmentId: string | null;
      rawXmlAvailable: boolean;
      rawXmlBase64: string | null;
      latestDraftStatus: string | null;
      journalEntryId: string | null;
    }>;
  };
  reconciliations: {
    readiness: unknown;
    bank: unknown;
    stripe: unknown;
    thirdParty: unknown;
    suspense: unknown;
    report: unknown;
  };
  closing: {
    workpapers: unknown;
    adjustments: unknown;
    freshness: unknown;
    review: unknown;
    summary: unknown;
  };
  documents: Array<{
    id: string;
    type: string;
    filename: string;
    format: string;
    sizeBytes: number | null;
    entriesCount: number | null;
    scriptVersion: string | null;
    generatedAt: string;
    freshness: string | null;
  }>;
};

type AttachmentManifestReader = {
  listAttachments(workspace: CompanyWorkspace): Promise<Array<{
    id: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    status: string;
    storageKey: string;
    links: Array<{ entityType: string; entityId: string; relationType: string }>;
  }>>;
};

export class DocumentEvidenceBundle {
  constructor(
    private readonly catalog = new DocumentCatalog(),
    private readonly journalAudit = new JournalAuditCenter(),
    private readonly journalExport = new JournalExportCenter(),
    private readonly vatPolicy = new VatLedgerPolicy(),
    private readonly coverage = new AccountingCoverageCenter(),
    private readonly storage: DocumentStorageAdapter = new LocalDocumentStorageAdapter(),
    private readonly evidence = new EvidenceRequirementCenter(),
    private readonly evidenceStorage: EvidenceStorageAdapter = new LocalEvidenceStorageAdapter(),
    private readonly attachmentReader: AttachmentManifestReader = new PrismaAttachmentManifestReader(),
    private readonly vatPosition = new VatPositionCenter(),
    private readonly vatDeclarations = new VatDeclarationCenter(),
    private readonly vatDeclarationFreshness = new VatDeclarationFreshnessCenter(),
    private readonly reconciliationWorkflow = new ReconciliationIssueWorkflow(),
    private readonly reconciliationReport = new ReconciliationReportCenter(),
    private readonly bankReconciliation = new BankLineReconciliationCenter(),
    private readonly stripeReconciliation = new StripeReconciliationCenter(),
    private readonly thirdPartyMatching = new ThirdPartyMatchingCenter(),
    private readonly suspenseAccounts = new SuspenseAccountCenter(),
    private readonly closingWorkpapers = new ClosingWorkpaperCenter(),
    private readonly closingAdjustments = new ClosingAdjustmentCenter(),
    private readonly closingFreshness = new ClosingAdjustmentFreshnessCenter(),
    private readonly closingReview = new ClosingAdjustmentReviewWorkflow(),
    private readonly sectionProviders: EvidenceSectionProvider[] = []
  ) {}

  async getBundleManifest(workspace: CompanyWorkspace): Promise<EvidenceManifest> {
    const [documents, audit, csv, vat, vatPosition, vatDeclarations, vatDeclarationFreshness, reconciliationReadiness, reconciliationReport, bankReconciliation, stripeReconciliation, thirdPartyMatching, suspenseAccounts, closingWorkpapers, closingSummary, closingAdjustments, closingFreshness, closingReview, expertValidation, coverage, evidenceSummary, evidenceRequirements, attachments, eInvoices] = await Promise.all([
      this.catalog.listDocuments(workspace),
      this.journalAudit.getAuditSummary(workspace),
      this.journalExport.exportCsv(workspace),
      this.vatPolicy.summarizeVatForFiscalYear(workspace),
      this.vatPosition.getVatPosition(workspace),
      this.vatDeclarations.listDeclarations(workspace),
      this.vatDeclarationFreshness.getFreshness(workspace),
      this.safeReconciliationReadiness(workspace),
      this.safeReconciliationReport(workspace),
      this.safeBankReconciliation(workspace),
      this.safeStripeReconciliation(workspace),
      this.safeThirdPartyMatching(workspace),
      this.safeSuspenseAccounts(workspace),
      this.safeClosingWorkpapers(workspace),
      this.safeClosingSummary(workspace),
      this.safeClosingAdjustments(workspace),
      this.safeClosingFreshness(workspace),
      this.safeClosingReview(workspace),
      prisma.shareLink.findFirst({
        where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, reviewedAt: { not: null } },
        orderBy: { reviewedAt: "desc" },
      }),
      this.coverage.getCoverageOverview(workspace),
      this.evidence.summarizeEvidenceGaps(workspace),
      this.evidence.listEvidenceRequirements(workspace),
      this.attachmentReader.listAttachments(workspace),
      this.listEInvoicesForManifest(workspace),
    ]);
    if (!documents.some((document) => document.type === DocumentType.FEC)) {
      throw new ExpectedRouteError("Aucun FEC généré : le paquet de preuve n'est pas encore disponible.", 409);
    }
    const manifest: EvidenceManifest = {
      generatedAt: new Date().toISOString(),
      company: {
        id: workspace.company.id,
        name: workspace.company.name,
        siren: workspace.company.siren,
      },
      fiscalYear: {
        id: workspace.fiscalYear.id,
        startDate: workspace.fiscalYear.startDate.toISOString().slice(0, 10),
        endDate: workspace.fiscalYear.endDate.toISOString().slice(0, 10),
      },
      journal: {
        summary: audit.summary,
        auditStatus: audit.status,
        csv,
      },
      vat: {
        ...vat,
        position: vatPosition,
        declarations: vatDeclarations.map((declaration) => ({
          id: declaration.id,
          type: declaration.type,
          status: declaration.status,
          periodStart: declaration.periodStart,
          periodEnd: declaration.periodEnd,
          documentId: declaration.documentId,
          active: declaration.active,
          freshness: declaration.freshness,
        })),
        declarationFreshness: vatDeclarationFreshness,
      },
      expertValidation: expertValidation ? {
        reviewerName: expertValidation.reviewerName,
        reviewNote: expertValidation.reviewNote,
        reviewedAt: expertValidation.reviewedAt?.toISOString() ?? null,
      } : null,
      coverage: {
        score: coverage.score,
        label: coverage.label,
        status: coverage.status,
        covered: coverage.covered,
        partial: coverage.partial,
        missing: coverage.missing,
        highRisk: coverage.highRisk,
        areas: coverage.areas.map((area) => ({
          code: area.code,
          status: area.status,
          risk: area.risk,
          nextPhase: area.nextPhase,
        })),
      },
      attachments: {
        summary: evidenceSummary,
        missingEvidenceSummary: {
          required: evidenceRequirements.filter((requirement) => requirement.missing && requirement.level === "required").length,
          recommended: evidenceRequirements.filter((requirement) => requirement.missing && requirement.level === "recommended").length,
          labels: evidenceRequirements.filter((requirement) => requirement.missing).slice(0, 50).map((requirement) => requirement.label),
        },
        files: await Promise.all(attachments.map((attachment) => this.attachmentManifestFile(attachment))),
      },
      eInvoices: {
        manifest: await Promise.all(eInvoices.map((invoice) => this.eInvoiceManifestFile(invoice))),
      },
      reconciliations: {
        readiness: reconciliationReadiness,
        bank: bankReconciliation,
        stripe: stripeReconciliation,
        thirdParty: thirdPartyMatching,
        suspense: suspenseAccounts,
        report: reconciliationReport,
      },
      closing: {
        workpapers: closingWorkpapers,
        adjustments: closingAdjustments.map((adjustment) => ({
          proposalKey: adjustment.proposalKey,
          kind: adjustment.kind,
          status: adjustment.status,
          label: adjustment.label,
          journalEntryId: adjustment.journalEntryId,
          note: adjustment.note,
          rejectedAt: adjustment.rejectedAt,
          calculation: adjustment.calculation,
          lines: adjustment.lines,
          freshness: closingFreshness.proposals.find((item) => item.proposalKey === adjustment.proposalKey) ?? null,
          evidence: closingReview.find((item) => item.proposal.proposalKey === adjustment.proposalKey)?.evidence ?? null,
        })),
        freshness: closingFreshness,
        review: closingReview.map((item) => ({
          proposalKey: item.proposal.proposalKey,
          status: item.proposal.status,
          freshness: item.freshness.statusLabel,
          evidenceMissing: item.evidence.missing,
          canApprove: item.canApprove,
          blockingReasons: item.blockingReasons,
        })),
        summary: closingSummary,
      },
      documents: documents.map((document) => ({
        id: document.id,
        type: document.type,
        filename: document.filename,
        format: document.format,
        sizeBytes: document.sizeBytes,
        entriesCount: document.entriesCount,
        scriptVersion: document.scriptVersion,
        generatedAt: document.generatedAt,
        freshness: document.freshness?.statusLabel ?? null,
      })),
    };
    return this.applyProviderSections(workspace, manifest);
  }

  private async applyProviderSections(workspace: CompanyWorkspace, manifest: EvidenceManifest): Promise<EvidenceManifest> {
    if (this.sectionProviders.length === 0) return manifest;
    const sections = await collectEvidenceSections(workspace, this.sectionProviders);
    return sections.reduce((current, section) => ({
      ...current,
      [section.sectionKey]: section.value,
    }), manifest) as EvidenceManifest;
  }

  private async attachmentManifestFile(attachment: Awaited<ReturnType<AttachmentManifestReader["listAttachments"]>>[number]) {
    const stored = await this.evidenceStorage.get(attachment.storageKey).catch(() => null);
    return {
      id: attachment.id,
      filename: attachment.originalFilename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      sha256: attachment.sha256,
      status: attachment.status,
      available: Boolean(stored),
      contentBase64: stored ? stored.body.toString("base64") : null,
      links: attachment.links.map((link) => ({
        entityType: link.entityType,
        entityId: link.entityId,
        relationType: link.relationType,
      })),
    };
  }

  private async listEInvoicesForManifest(workspace: CompanyWorkspace) {
    return prisma.eInvoice.findMany({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null },
      include: { accountingDrafts: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "asc" },
    }).catch(() => []);
  }

  private async eInvoiceManifestFile(invoice: Awaited<ReturnType<DocumentEvidenceBundle["listEInvoicesForManifest"]>>[number]) {
    const stored = invoice.rawXmlStorageKey ? await this.evidenceStorage.get(invoice.rawXmlStorageKey).catch(() => null) : null;
    const latestDraft = invoice.accountingDrafts[0] ?? null;
    return {
      id: invoice.id,
      source: invoice.source,
      format: invoice.format,
      status: invoice.status,
      supplierName: invoice.supplierName,
      supplierSiret: invoice.supplierSiret,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate?.toISOString().slice(0, 10) ?? null,
      amountHt: invoice.amountHt?.toString() ?? null,
      amountVat: invoice.amountVat?.toString() ?? null,
      amountTtc: invoice.amountTtc?.toString() ?? null,
      attachmentId: invoice.attachmentId,
      rawXmlAvailable: Boolean(stored),
      rawXmlBase64: stored ? stored.body.toString("base64") : null,
      latestDraftStatus: latestDraft?.status ?? null,
      journalEntryId: latestDraft?.journalEntryId ?? null,
    };
  }

  private async safeBankReconciliation(workspace: CompanyWorkspace) {
    if (!("bankAccount" in workspace) || !workspace.bankAccount) {
      return {
        balance: null,
        summary: { kind: "BANK", status: "MISSING", totalMatches: 0, matched: 0, unmatched: 0, ignored: 0, difference: 0, openIssues: 0, resolvedIssues: 0, ignoredIssues: 0, progress: 0 },
        matches: [],
      };
    }
    return this.bankReconciliation.getBankReconciliation(workspace);
  }

  private async safeReconciliationReadiness(workspace: CompanyWorkspace) {
    return this.reconciliationWorkflow.summarizeReconciliationReadiness(workspace).catch(() => ({
      status: "ready",
      bank: { kind: "BANK", status: "MISSING", totalMatches: 0, matched: 0, unmatched: 0, ignored: 0, difference: 0, openIssues: 0, resolvedIssues: 0, ignoredIssues: 0, progress: 0 },
      stripe: { kind: "STRIPE", status: "MISSING", totalMatches: 0, matched: 0, unmatched: 0, ignored: 0, difference: 0, openIssues: 0, resolvedIssues: 0, ignoredIssues: 0, progress: 0, payouts: 0, events: 0 },
      thirdParty: { kind: "THIRD_PARTY", status: "MISSING", totalMatches: 0, matched: 0, unmatched: 0, ignored: 0, difference: 0, openIssues: 0, resolvedIssues: 0, ignoredIssues: 0, progress: 0 },
      suspense: { kind: "SUSPENSE", status: "MISSING", totalMatches: 0, matched: 0, unmatched: 0, ignored: 0, difference: 0, openIssues: 0, resolvedIssues: 0, ignoredIssues: 0, progress: 0 },
      issues: { issues: [], open: 0, blocking: 0, warning: 0 },
    }));
  }

  private async safeReconciliationReport(workspace: CompanyWorkspace) {
    return this.reconciliationReport.buildFullReport(workspace).catch(() => null);
  }

  private async safeStripeReconciliation(workspace: CompanyWorkspace) {
    return this.stripeReconciliation.summarizeStripeReconciliation(workspace).catch(() => ({ kind: "STRIPE", status: "MISSING", totalMatches: 0, matched: 0, unmatched: 0, ignored: 0, difference: 0, openIssues: 0, resolvedIssues: 0, ignoredIssues: 0, progress: 0, payouts: 0, events: 0 }));
  }

  private async safeThirdPartyMatching(workspace: CompanyWorkspace) {
    return this.thirdPartyMatching.summarizeThirdPartyMatching(workspace).catch(() => ({ kind: "THIRD_PARTY", status: "MISSING", totalMatches: 0, matched: 0, unmatched: 0, ignored: 0, difference: 0, openIssues: 0, resolvedIssues: 0, ignoredIssues: 0, progress: 0 }));
  }

  private async safeSuspenseAccounts(workspace: CompanyWorkspace) {
    return this.suspenseAccounts.summarizeSuspenseAccounts(workspace).catch(() => ({ kind: "SUSPENSE", status: "MISSING", totalMatches: 0, matched: 0, unmatched: 0, ignored: 0, difference: 0, openIssues: 0, resolvedIssues: 0, ignoredIssues: 0, progress: 0 }));
  }

  private async safeClosingWorkpapers(workspace: CompanyWorkspace) {
    return this.closingWorkpapers.listWorkpapers(workspace, { includeArchived: true }).catch(() => []);
  }

  private async safeClosingSummary(workspace: CompanyWorkspace) {
    return this.closingWorkpapers.summarizeWorkpapers(workspace).catch(() => ({
      total: 0,
      draft: 0,
      ready: 0,
      archived: 0,
      proposals: { draft: 0, approved: 0, rejected: 0 },
      requiredEvidenceMissing: 0,
    }));
  }

  private async safeClosingAdjustments(workspace: CompanyWorkspace) {
    return this.closingAdjustments.listProposals(workspace).catch(() => []);
  }

  private async safeClosingFreshness(workspace: CompanyWorkspace) {
    return this.closingFreshness.getFreshness(workspace).catch(() => ({
      total: 0,
      staleCount: 0,
      freshCount: 0,
      finalCount: 0,
      proposals: [],
    }));
  }

  private async safeClosingReview(workspace: CompanyWorkspace) {
    return this.closingReview.getReviewQueue(workspace).catch(() => []);
  }

  async buildEvidenceBundle(workspace: CompanyWorkspace) {
    return this.getBundleManifest(workspace);
  }

  async downloadBundle(workspace: CompanyWorkspace) {
    const manifest = await this.getBundleManifest(workspace);
    const year = workspace.fiscalYear.endDate.getFullYear();
    return {
      body: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
      filename: `qitus-evidence-${year}.json`,
      contentType: "application/json",
    };
  }

  async persistEvidenceBundle(workspace: CompanyWorkspace) {
    const bundle = await this.downloadBundle(workspace);
    const storageKey = `${workspace.company.id}/${workspace.fiscalYear.id}/evidence/${randomUUID()}-${bundle.filename}`;
    const sourcePath = path.join(process.cwd(), "tmp", "evidence-bundles", storageKey.replace(/\//g, "_"));
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, bundle.body);
    const stored = await this.storage.put(sourcePath, storageKey);
    const oldDocuments = await prisma.document.findMany({
      where: { fiscalYearId: workspace.fiscalYear.id, type: DocumentType.EVIDENCE_BUNDLE },
      select: { id: true, storageKey: true },
    });
    if (oldDocuments.length > 0) {
      await prisma.document.deleteMany({ where: { id: { in: oldDocuments.map((document) => document.id) } } });
      await Promise.all(oldDocuments.map((document) => this.storage.delete(document.storageKey)));
    }
    const document = await prisma.document.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        type: DocumentType.EVIDENCE_BUNDLE,
        format: "json",
        storageKey: stored.key,
        filename: bundle.filename,
        sizeBytes: stored.sizeBytes,
        entriesCount: (JSON.parse(bundle.body.toString("utf8")) as EvidenceManifest).journal.summary.entriesCount,
        generatedBy: "document-evidence-bundle",
        scriptVersion: "phase-8-local-manifest",
      },
    });
    return {
      id: document.id,
      filename: document.filename,
      generatedAt: document.generatedAt.toISOString(),
    };
  }
}

class PrismaAttachmentManifestReader implements AttachmentManifestReader {
  async listAttachments(workspace: CompanyWorkspace) {
    return prisma.attachment.findMany({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null },
      include: { links: true },
      orderBy: { createdAt: "asc" },
    });
  }
}
