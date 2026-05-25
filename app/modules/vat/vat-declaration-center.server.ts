import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VatDeclaration, VatDeclarationStatus, VatDeclarationType } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { LocalDocumentStorageAdapter, type DocumentStorageAdapter } from "../documents/document-storage-adapter.server";
import { VatReferenceCenter } from "../official-references/vat-reference-center.server";
import { ExpectedRouteError } from "../route-errors.server";
import { VatPositionCenter, resolvePeriod, type VatPositionFilters } from "./vat-position-center.server";

export type GenerateVatDeclarationInput = VatPositionFilters & {
  type?: "CA3" | "CA12" | null;
};

export type VatControl = {
  code: string;
  severity: "blocking" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
  issueKey?: string;
};

export type VatReview = {
  status: "not_applicable" | "blocked" | "ready_with_warnings" | "ready";
  blockingCount: number;
  warningCount: number;
  controls: VatControl[];
};

export type VatDeclarationFreshnessReason = {
  code: "import_completed" | "transaction_corrected" | "journal_entry_updated" | "closing_adjustment_approved" | "profile_updated";
  label: string;
  at: string;
};

export type VatDeclarationFreshness = {
  declarationId: string;
  type: VatDeclarationType;
  periodStart: string;
  periodEnd: string;
  status: VatDeclarationStatus;
  active: boolean;
  isStale: boolean;
  lifecycleStatus: "active" | "stale" | "superseded";
  statusLabel: "Active" | "Obsolète" | "Superseded";
  staleReasons: VatDeclarationFreshnessReason[];
};

type FreshnessDeclaration = {
  id: string;
  type: VatDeclarationType;
  status: VatDeclarationStatus;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
};

export class VatDeclarationCenter {
  constructor(
    private readonly position = new VatPositionCenter(),
    private readonly storage: DocumentStorageAdapter = new LocalDocumentStorageAdapter(),
    private readonly activity = new ActivityLogCenter(),
    private readonly vatReference = new VatReferenceCenter()
  ) {}

  async listDeclarations(workspace: CompanyWorkspace) {
    const [declarations, freshness] = await Promise.all([
      prisma.vatDeclaration.findMany({
        where: { fiscalYearId: workspace.fiscalYear.id },
        orderBy: { createdAt: "desc" },
      }),
      this.getFreshness(workspace),
    ]);
    const freshnessById = new Map(freshness.declarations.map((declaration) => [declaration.declarationId, declaration]));
    return declarations.map((declaration) => ({
      id: declaration.id,
      type: declaration.type,
      status: declaration.status,
      active: freshnessById.get(declaration.id)?.active ?? declaration.status === "DRAFT",
      lifecycleStatus: freshnessById.get(declaration.id)?.lifecycleStatus ?? (declaration.status === "SUPERSEDED" ? "superseded" : "active"),
      freshness: freshnessById.get(declaration.id) ?? null,
      staleReasons: freshnessById.get(declaration.id)?.staleReasons ?? [],
      periodStart: declaration.periodStart.toISOString().slice(0, 10),
      periodEnd: declaration.periodEnd.toISOString().slice(0, 10),
      documentId: declaration.documentId,
      amounts: declaration.amountsJson,
      createdAt: declaration.createdAt.toISOString(),
    }));
  }

  async generateDraft(workspace: CompanyWorkspace, input: GenerateVatDeclarationInput = {}) {
    await this.vatReference.assertReady();
    const period = resolvePeriod(workspace, input);
    const type = resolveDeclarationType(workspace, input.type);
    const review = await this.assertVatDeclarationReady(workspace, {
      dateFrom: period.start.toISOString().slice(0, 10),
      dateTo: period.end.toISOString().slice(0, 10),
    });
    const superseded = await prisma.vatDeclaration.updateMany({
      where: { fiscalYearId: workspace.fiscalYear.id, type, periodStart: period.start, periodEnd: period.end, status: "DRAFT" },
      data: { status: "SUPERSEDED" },
    });
    if (superseded.count > 0) {
      await this.activity.recordActivity(workspace, {
        action: "vat.declaration_superseded",
        entityType: "vat_declaration",
        entityId: `${type}:${period.start.toISOString().slice(0, 10)}:${period.end.toISOString().slice(0, 10)}`,
        metadata: { type, periodStart: period.start.toISOString(), periodEnd: period.end.toISOString(), count: superseded.count },
      });
    }
    const position = await this.position.getVatPosition(workspace, {
      dateFrom: period.start.toISOString().slice(0, 10),
      dateTo: period.end.toISOString().slice(0, 10),
    });
    const source = renderVatDeclarationSource(workspace, type, position, review.controls, await this.vatReference.getVatAccounts());
    const filename = `${workspace.company.siren ?? "qitus"}-${type}-${position.periodStart}-${position.periodEnd}.md`;
    const storageKey = `${workspace.company.id}/${workspace.fiscalYear.id}/vat/${randomUUID()}-${filename}`;
    const sourcePath = path.join(process.cwd(), "tmp", "vat-declarations", storageKey.replace(/\//g, "_"));
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, source, "utf8");
    const stored = await this.storage.put(sourcePath, storageKey);
    const document = await prisma.document.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        type: "TVA_DECLARATION",
        format: "md",
        storageKey: stored.key,
        filename,
        sizeBytes: stored.sizeBytes,
        entriesCount: position.rows.length,
        generatedBy: "vat-declaration-center",
        scriptVersion: "phase-12-vat-draft",
      },
    });
    const declaration = await prisma.vatDeclaration.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        type,
        periodStart: period.start,
        periodEnd: period.end,
        sourceJson: { rows: position.rows, byRate: position.byRate, byNature: position.byNature },
        amountsJson: position.totals,
        controlsJson: review.controls,
        documentId: document.id,
        generatedByUserId: workspace.user.id,
      },
    });
    await this.activity.recordActivity(workspace, {
      action: "vat.declaration_generated",
      entityType: "vat_declaration",
      entityId: declaration.id,
      metadata: { type, filename, net: position.totals.net, warningCount: review.warningCount },
    });
    return { declaration: await this.getDeclaration(workspace, declaration.id), documentId: document.id };
  }

  async getDeclaration(workspace: CompanyWorkspace, declarationId: string) {
    const declaration = await prisma.vatDeclaration.findFirst({
      where: { id: declarationId, fiscalYearId: workspace.fiscalYear.id },
    });
    if (!declaration) throw new ExpectedRouteError("Déclaration TVA introuvable.", 404);
    const comparison = await this.compareDeclarationToLedger(workspace, declaration);
    return {
      id: declaration.id,
      type: declaration.type,
      status: declaration.status,
      periodStart: declaration.periodStart.toISOString().slice(0, 10),
      periodEnd: declaration.periodEnd.toISOString().slice(0, 10),
      source: declaration.sourceJson,
      amounts: declaration.amountsJson,
      controls: declaration.controlsJson,
      documentId: declaration.documentId,
      comparison,
      createdAt: declaration.createdAt.toISOString(),
    };
  }

  async downloadDeclaration(workspace: CompanyWorkspace, declarationId: string) {
    const declaration = await prisma.vatDeclaration.findFirst({
      where: { id: declarationId, fiscalYearId: workspace.fiscalYear.id },
    });
    if (!declaration?.documentId) throw new ExpectedRouteError("Document de déclaration TVA introuvable.", 404);
    const document = await prisma.document.findFirstOrThrow({ where: { id: declaration.documentId, fiscalYearId: workspace.fiscalYear.id } });
    const stored = await this.storage.get(document.storageKey);
    await this.activity.recordActivity(workspace, {
      action: "vat.declaration_downloaded",
      entityType: "vat_declaration",
      entityId: declaration.id,
      metadata: { filename: document.filename, type: declaration.type },
    });
    return { body: stored.body, filename: document.filename, contentType: "text/markdown" };
  }

  async supersedeDeclaration(workspace: CompanyWorkspace, declarationId: string) {
    const declaration = await prisma.vatDeclaration.findFirst({ where: { id: declarationId, fiscalYearId: workspace.fiscalYear.id } });
    if (!declaration) throw new ExpectedRouteError("Déclaration TVA introuvable.", 404);
    return prisma.vatDeclaration.update({ where: { id: declaration.id }, data: { status: "SUPERSEDED" } });
  }

  async getVatReview(workspace: CompanyWorkspace, filters: VatPositionFilters = {}): Promise<VatReview> {
    await this.vatReference.assertReady();
    if (workspace.company.vatRegime === "FRANCHISE") {
      return {
        status: "not_applicable",
        blockingCount: 0,
        warningCount: 1,
        controls: [warning("VAT_FRANCHISE", "Franchise TVA", "Aucune CA3/CA12 à générer ; surveiller le seuil de franchise.", "/couverture/vat")],
      };
    }

    const [position, missingRate, missingNature, declarations, declarationFreshness] = await Promise.all([
      this.position.getVatPosition(workspace, filters),
      prisma.categorization.count({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          status: { notIn: ["NEEDS_REVIEW", "REVIEW_LIGHT"] },
          transaction: { journalEntryId: { not: null } },
          vatOperationNature: { in: ["DOMESTIC_PURCHASE", "DOMESTIC_SALE", "INTRACOM_PURCHASE", "REVERSE_CHARGE"] },
          vatRate: null,
        },
      }),
      prisma.categorization.count({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          status: { notIn: ["NEEDS_REVIEW", "REVIEW_LIGHT"] },
          transaction: { journalEntryId: { not: null } },
          vatRate: { not: null },
          vatOperationNature: null,
        },
      }),
      prisma.vatDeclaration.findMany({ where: { fiscalYearId: workspace.fiscalYear.id, status: "DRAFT" }, orderBy: { createdAt: "desc" } }),
      this.getFreshness(workspace),
    ]);

    const controls: VatControl[] = [];
    if (missingRate > 0) controls.push(blocker("VAT_RATE_MISSING", "Taux TVA manquant", `${missingRate} catégorisation(s) taxable(s) n'ont pas de taux TVA.`, "/tva/revue"));
    if (missingNature > 0) controls.push(warning("VAT_NATURE_MISSING", "Nature TVA manquante", `${missingNature} catégorisation(s) ont un taux mais pas de nature TVA.`, "/tva/revue"));
    if (position.totals.net !== 0 && declarations.length === 0) controls.push(warning("VAT_DECLARATION_MISSING", "Déclaration TVA absente", "Génère un brouillon CA3/CA12 pour documenter la position TVA.", "/tva"));
    const firstStale = declarationFreshness.declarations.find((declaration) => declaration.isStale);
    if (firstStale) controls.push(warning("VAT_DECLARATION_STALE", "Déclaration TVA obsolète", "Une donnée TVA ou comptable a changé après la génération.", "/tva/revue", `VAT_DECLARATION_STALE:declaration:${firstStale.declarationId}`));
    const amountEpsilon = (await this.vatReference.getTolerances()).amountEpsilon;
    if (Math.abs(position.accounts.reduce((sum, account) => sum + account.balance, 0)) > amountEpsilon) {
      controls.push(info("VAT_ACCOUNTS_OPEN", "Solde comptes TVA ouvert", "Les comptes TVA portent un solde à décaisser ou un crédit de TVA.", "/tva"));
    }

    const blockingCount = controls.filter((control) => control.severity === "blocking").length;
    const warningCount = controls.filter((control) => control.severity === "warning").length;
    return {
      status: blockingCount > 0 ? "blocked" : warningCount > 0 ? "ready_with_warnings" : "ready",
      blockingCount,
      warningCount,
      controls,
    };
  }

  async listControls(workspace: CompanyWorkspace, filters: VatPositionFilters = {}) {
    return (await this.getVatReview(workspace, filters)).controls;
  }

  async assertVatDeclarationReady(workspace: CompanyWorkspace, filters: VatPositionFilters = {}) {
    const review = await this.getVatReview(workspace, filters);
    if (review.status === "not_applicable") throw new ExpectedRouteError("L'entreprise est en franchise de TVA : aucune CA3/CA12 n'est générée.", 409);
    if (review.blockingCount > 0) throw new ExpectedRouteError(`Déclaration TVA bloquée : ${review.blockingCount} contrôle(s) bloquant(s).`, 409);
    return review;
  }

  async compareDeclarationToLedger(workspace: CompanyWorkspace, declaration: VatDeclaration) {
    const position = await this.position.getVatPosition(workspace, {
      dateFrom: declaration.periodStart.toISOString().slice(0, 10),
      dateTo: declaration.periodEnd.toISOString().slice(0, 10),
    });
    const amounts = declaration.amountsJson as { net?: number };
    const delta = Math.round(((amounts.net ?? 0) - position.totals.net) * 100) / 100;
    return { declarationNet: amounts.net ?? 0, ledgerNet: position.totals.net, delta, matches: Math.abs(delta) <= (await this.vatReference.getTolerances()).amountEpsilon };
  }

  async getFreshness(workspace: CompanyWorkspace) {
    const [declarations, reasons] = await Promise.all([
      prisma.vatDeclaration.findMany({
        where: { fiscalYearId: workspace.fiscalYear.id },
        orderBy: { createdAt: "desc" },
      }),
      this.getStaleReasons(workspace),
    ]);
    return buildVatDeclarationFreshness(declarations, reasons);
  }

  async getDocumentFreshness(workspace: CompanyWorkspace, documentId: string) {
    const declaration = await prisma.vatDeclaration.findFirst({
      where: { fiscalYearId: workspace.fiscalYear.id, documentId },
    });
    if (!declaration) return null;
    return this.getDeclarationFreshness(workspace, declaration.id);
  }

  async getDeclarationFreshness(workspace: CompanyWorkspace, declarationId: string) {
    const freshness = await this.getFreshness(workspace);
    return freshness.declarations.find((declaration) => declaration.declarationId === declarationId) ?? null;
  }

  async getStaleReasons(workspace: CompanyWorkspace): Promise<VatDeclarationFreshnessReason[]> {
    const [lastImport, lastCategorization, lastEntry, lastClosingAdjustment, lastProfileChange] = await Promise.all([
      prisma.import.findFirst({
        where: { fiscalYearId: workspace.fiscalYear.id, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true, originalFilename: true },
      }),
      prisma.categorization.findFirst({
        where: { fiscalYearId: workspace.fiscalYear.id, status: { in: ["USER_CONFIRMED", "USER_CORRECTED", "MANUAL"] } },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.journalEntry.findFirst({
        where: { fiscalYearId: workspace.fiscalYear.id },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true, journal: true, label: true },
      }),
      prisma.closingAdjustmentProposal.findFirst({
        where: { fiscalYearId: workspace.fiscalYear.id, status: "APPROVED", approvedAt: { not: null } },
        orderBy: { approvedAt: "desc" },
        select: { approvedAt: true, label: true },
      }),
      prisma.activityLog.findFirst({
        where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, action: { in: ["profile.updated", "profile.onboarding_completed"] } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, action: true },
      }),
    ]);

    return [
      lastImport?.completedAt ? {
        code: "import_completed" as const,
        label: `Dernier import terminé${lastImport.originalFilename ? ` : ${lastImport.originalFilename}` : ""}`,
        at: lastImport.completedAt.toISOString(),
      } : null,
      lastCategorization ? {
        code: "transaction_corrected" as const,
        label: "Dernière correction transaction ou TVA",
        at: lastCategorization.updatedAt.toISOString(),
      } : null,
      lastEntry ? {
        code: "journal_entry_updated" as const,
        label: `Dernière écriture ${lastEntry.journal}${lastEntry.label ? ` : ${lastEntry.label}` : ""}`,
        at: lastEntry.updatedAt.toISOString(),
      } : null,
      lastClosingAdjustment?.approvedAt ? {
        code: "closing_adjustment_approved" as const,
        label: `Dernière OD validée : ${lastClosingAdjustment.label}`,
        at: lastClosingAdjustment.approvedAt.toISOString(),
      } : null,
      lastProfileChange ? {
        code: "profile_updated" as const,
        label: lastProfileChange.action === "profile.onboarding_completed" ? "Profil fiscal initialisé" : "Profil fiscal modifié",
        at: lastProfileChange.createdAt.toISOString(),
      } : null,
    ].filter((reason): reason is VatDeclarationFreshnessReason => Boolean(reason));
  }

  async previewSettlement(workspace: CompanyWorkspace, declarationId: string) {
    const declaration = await this.getDeclaration(workspace, declarationId);
    const amounts = declaration.amounts as { net?: number };
    const net = amounts.net ?? 0;
    return {
      declarationId,
      kind: net >= 0 ? "vat_to_pay" : "vat_credit",
      amount: Math.abs(net),
      label: net >= 0 ? "TVA à décaisser indicative" : "Crédit de TVA indicatif",
      note: "Phase 12 ne crée pas l'écriture de paiement TVA automatiquement.",
    };
  }

  async summarizeOpenVatBalance(workspace: CompanyWorkspace) {
    const position = await this.position.getVatPosition(workspace);
    return {
      net: position.totals.net,
      kind: position.totals.net >= 0 ? "vat_to_pay" : "vat_credit",
      label: position.totals.net >= 0 ? "TVA à décaisser indicative" : "Crédit de TVA indicatif",
      accounts: position.accounts,
    };
  }

  async assertNoAutomaticSettlement() {
    throw new ExpectedRouteError("La régularisation TVA est seulement prévisualisée en Phase 12.", 409);
  }
}

export function resolveDeclarationType(workspace: CompanyWorkspace, requested?: "CA3" | "CA12" | null): VatDeclarationType {
  if (requested) return requested;
  return workspace.company.vatRegime === "REEL_NORMAL" ? "CA3" : "CA12";
}

export function renderVatDeclarationSource(
  workspace: CompanyWorkspace,
  type: VatDeclarationType,
  position: Awaited<ReturnType<VatPositionCenter["getVatPosition"]>>,
  controls: Array<{ severity: string; title: string; detail: string }>,
  vatAccounts: Awaited<ReturnType<VatReferenceCenter["getVatAccounts"]>>
) {
  return [
    `# Déclaration TVA ${type} - brouillon`,
    "",
    "> Brouillon local - non télétransmis.",
    "",
    "## Période",
    "",
    `- Entreprise : ${workspace.company.name}`,
    `- Régime : ${workspace.company.vatRegime}`,
    `- Exigibilité : ${workspace.company.vatExigibility}`,
    `- Période : ${position.periodStart} au ${position.periodEnd}`,
    "",
    "## Montants",
    "",
    "| Case | Libellé | Montant EUR | Source |",
    "|---|---|---:|---|",
    `| A1 | Base HT taxable | ${money(position.totals.baseHt)} | Journal TVA |`,
    `| TVA_COLLECTEE | TVA collectée | ${money(position.totals.collected)} | ${vatAccounts.collected} |`,
    `| TVA_DEDUCTIBLE | TVA déductible | ${money(position.totals.deductible)} | ${vatAccounts.deductible} |`,
    `| TVA_AUTOLIQUIDEE | TVA due autoliquidation | ${money(position.totals.reverseChargeDue)} | ${vatAccounts.reverseCharge} |`,
    `| TVA_NETTE | TVA nette à décaisser / crédit | ${money(position.totals.net)} | collectée + autoliquidée - déductible |`,
    "",
    "## Ventilation par taux",
    "",
    "| Taux | Base HT | Déductible | Collectée | Autoliquidée | Net |",
    "|---|---:|---:|---:|---:|---:|",
    ...position.byRate.map((row) => `| ${row.key} | ${money(row.baseHt)} | ${money(row.deductible)} | ${money(row.collected)} | ${money(row.reverseChargeDue)} | ${money(row.net)} |`),
    "",
    "## Contrôles",
    "",
    ...controls.map((control) => `- ${control.severity.toUpperCase()} - ${control.title} : ${control.detail}`),
    "",
  ].join("\n");
}

function money(value: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function buildVatDeclarationFreshness(declarations: FreshnessDeclaration[], reasons: VatDeclarationFreshnessReason[]) {
  const summaries = declarations.map((declaration): VatDeclarationFreshness => {
    const staleReasons = reasons.filter((reason) => declaration.createdAt < new Date(reason.at));
    const isSuperseded = declaration.status === "SUPERSEDED";
    const isStale = !isSuperseded && staleReasons.length > 0;
    return {
      declarationId: declaration.id,
      type: declaration.type,
      periodStart: declaration.periodStart.toISOString().slice(0, 10),
      periodEnd: declaration.periodEnd.toISOString().slice(0, 10),
      status: declaration.status,
      active: declaration.status === "DRAFT" && !isStale,
      isStale,
      lifecycleStatus: isSuperseded ? "superseded" : isStale ? "stale" : "active",
      statusLabel: isSuperseded ? "Superseded" : isStale ? "Obsolète" : "Active",
      staleReasons,
    };
  });
  return {
    activeCount: summaries.filter((declaration) => declaration.active).length,
    staleCount: summaries.filter((declaration) => declaration.isStale).length,
    supersededCount: summaries.filter((declaration) => declaration.lifecycleStatus === "superseded").length,
    newestBusinessEventAt: newestReasonDate(reasons),
    reasons,
    declarations: summaries,
  };
}

function newestReasonDate(reasons: VatDeclarationFreshnessReason[]) {
  const newest = reasons.reduce<Date | null>((current, reason) => {
    const next = new Date(reason.at);
    return !current || next > current ? next : current;
  }, null);
  return newest?.toISOString() ?? null;
}

function blocker(code: string, title: string, detail: string, href: string, issueKey?: string): VatControl {
  return { code, title, detail, href, issueKey, severity: "blocking" };
}

function warning(code: string, title: string, detail: string, href: string, issueKey?: string): VatControl {
  return { code, title, detail, href, issueKey, severity: "warning" };
}

function info(code: string, title: string, detail: string, href: string, issueKey?: string): VatControl {
  return { code, title, detail, href, issueKey, severity: "info" };
}
