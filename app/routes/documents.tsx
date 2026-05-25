import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { AppShell, GuidanceAlert, Main, TableShell } from "~/components/ui";
import type { ActionableGuidance } from "~/modules/actionable-guidance";
import { AccountingReviewCenter } from "~/modules/accounting-review/accounting-review-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DocumentCatalog } from "~/modules/documents/document-catalog.server";
import { DocumentGenerationAuditCenter } from "~/modules/documents/document-generation-audit-center.server";
import { DocumentFreshnessCenter } from "~/modules/documents/document-freshness-center.server";
import { FecPrecheckCenter } from "~/modules/expert-dossier/fec-precheck-center.server";
import { TaxPackageDraftCenter } from "~/modules/tax-package/tax-package-draft-center.server";
import { documentFormatLabel, documentTypeLabel, freshnessLabel } from "~/modules/ui-labels";

export async function loader(args: LoaderFunctionArgs) {
  const { request } = args;
  const workspace = await requireCompanyWorkspace(args);
  const documents = await new DocumentCatalog().listDocuments(workspace);
  const freshness = await new DocumentFreshnessCenter().getFreshness(workspace);
  const generationAudit = await new DocumentGenerationAuditCenter().getLatestGenerationAudit(workspace);
  const review = await new AccountingReviewCenter().getReview(workspace);
  const [fecPrecheck, taxPackage] = await Promise.all([
    new FecPrecheckCenter().getFecPrecheck(workspace).catch((error) => ({
      status: "blocked" as const,
      label: "FEC bloqué",
      fec: null,
      journal: null,
      issues: [{ label: "Référentiel ou journal indisponible", detail: error instanceof Error ? error.message : "Le FEC ne peut pas encore être contrôlé.", severity: "blocking" as const, code: "MISSING_FEC" as const }],
      blockingCount: 1,
      warningCount: 0,
    })),
    new TaxPackageDraftCenter().getTaxPackageSummary(workspace),
  ]);
  const error = new URL(request.url).searchParams.get("error");
  return json({ documents, error, review, freshness, generationAudit, fecPrecheck, taxPackage });
}

export default function Documents() {
  const { documents, error, review, freshness, generationAudit, fecPrecheck, taxPackage } = useLoaderData<typeof loader>();
  const hasFec = documents.some((document) => document.type === "FEC");
  const reviewGuidance = buildReviewGuidance(review.blockingCount, review.warningCount);
  const freshnessGuidance = buildFreshnessGuidance(freshness.staleCount, review.blockingCount);
  return (
    <AppShell active="documents">
      <Main title="Documents" subtitle="Générés par Qitus">
        {error ? <div className="alert red">{error}</div> : null}
        {reviewGuidance ? <GuidanceAlert guidance={reviewGuidance} /> : null}
        {freshnessGuidance ? <GuidanceAlert guidance={freshnessGuidance} /> : null}
        <div className="card">
          <div className="sec-head">
            <div>
              <h2>Certitude des sorties fiscales</h2>
              <p className="sub">Qitus vérifie le journal, les référentiels actifs et les cases CERFA avant de préparer les fichiers.</p>
            </div>
          </div>
          <div className="doc-grid">
            <FiscalOutputStatus title="FEC" status={fecPrecheck.status} detail={`${fecPrecheck.journal?.summary.entriesCount ?? 0} écriture${(fecPrecheck.journal?.summary.entriesCount ?? 0) > 1 ? "s" : ""} dans le journal`} actionLabel={fecPrecheck.status === "ready" ? "Télécharger le FEC" : "Générer le FEC"} href={fecPrecheck.fec ? `/api/documents/${fecPrecheck.fec.id}/download` : "/documents"} />
            <FiscalOutputStatus title="Liasse fiscale CERFA" status={taxPackage.status === "blocked" ? "blocked" : taxPackage.status === "ready" ? "ready" : "warning"} detail={taxPackage.completeness ? taxPackageDetail(taxPackage.completeness) : "Préparation complète case par case"} actionLabel={taxPackage.documentId ? "Télécharger la liasse" : "Générer la liasse"} href={taxPackage.documentId ? `/api/documents/${taxPackage.documentId}/download` : "/documents"} />
          </div>
        </div>
        <div className="doc-grid">
          <div className="card doc-card">
            <h3>FEC</h3>
            <p>Fichier des écritures comptables 18 colonnes, précontrôlé avant téléchargement.</p>
            <p className="sub">{fecPrecheck.label}</p>
            <Form method="post" action="/api/documents/fec/generate"><button className="btn btn-p">Générer le FEC</button></Form>
          </div>
          <div className="card doc-card">
            <h3>États financiers</h3>
            <p>Balance, bilan et compte de résultat en document lisible.</p>
            <Form method="post" action="/api/documents/statements/generate"><button className="btn">Générer</button></Form>
          </div>
          <div className="card doc-card">
            <h3>Liasse fiscale CERFA</h3>
            <p>Préparation complète case par case, à relire avec votre expert-comptable.</p>
            <p className="sub">{taxPackage.completeness?.label ?? "Aucune liasse générée pour cet exercice."}</p>
            <Form method="post" action="/api/documents/liasse/generate"><button className="btn">Générer la liasse</button></Form>
          </div>
        </div>
        <div className="sec-head">
          <h2>Dernière génération</h2>
          {hasFec ? <a className="btn" href="/api/documents/evidence-bundle">Télécharger le dossier de preuves</a> : null}
        </div>
        <div className="card">
          {generationAudit ? (
            <>
              <h3>{generationAudit.label}</h3>
              <p className="sub">
                {generationAudit.types.map(documentTypeLabel).join(", ")} · {generationAudit.filenames.join(", ") || "Aucun fichier"} · {formatDuration(generationAudit.durationMs)}
              </p>
              <p className="sub">{generationAudit.userMessage ?? "Audit disponible via le journal d'activité."}</p>
            </>
          ) : (
            <p className="sub">Aucune génération documentée pour cet exercice.</p>
          )}
        </div>
        <div className="sec-head"><h2>Documents générés</h2></div>
        <TableShell>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Type</th><th>Fichier</th><th>État</th><th>Format</th><th className="r">Taille</th><th>Écritures</th><th>Version</th><th>Produit par</th><th></th></tr></thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td className="mono">{formatDate(document.generatedAt)}</td>
                  <td>{documentTypeLabel(document.type)}</td>
                  <td>{document.filename}</td>
                  <td>{freshnessLabel(document.freshness?.statusLabel ?? "À jour")}</td>
                  <td>{documentFormatLabel(document.format)}</td>
                  <td className="r mono">{formatBytes(document.sizeBytes)}</td>
                  <td className="mono">{document.entriesCount ?? "—"}</td>
                  <td className="mono wrap-anywhere">{document.scriptVersion ? humanScriptVersion(document.scriptVersion) : "Non renseignée"}</td>
                  <td>{humanGeneratedBy(document.generatedBy)}</td>
                  <td><a className="btn btn-sm" href={`/api/documents/${document.id}/download`} download={document.filename}>Télécharger</a></td>
                </tr>
              ))}
              {documents.length === 0 ? (
                <tr><td colSpan={10} className="sub">Aucun document généré pour cet exercice.</td></tr>
              ) : null}
            </tbody>
          </table>
        </TableShell>
      </Main>
    </AppShell>
  );
}

function FiscalOutputStatus(props: { title: string; status: "ready" | "warning" | "blocked"; detail: string; actionLabel: string; href: string }) {
  const label = props.status === "ready" ? "Vérifié" : props.status === "warning" ? "À relire" : "Bloqué";
  return (
    <div className="card doc-card">
      <h3>{props.title}</h3>
      <p><strong>{label}</strong></p>
      <p className="sub">{props.detail}</p>
      <a className="btn btn-sm" href={props.href}>{props.actionLabel}</a>
    </div>
  );
}

function buildReviewGuidance(blockingCount: number, warningCount: number): ActionableGuidance | null {
  if (blockingCount > 0) {
    return {
      title: "Génération bloquée",
      message: `Génération bloquée par ${blockingCount} contrôle${blockingCount > 1 ? "s" : ""}.`,
      tone: "blocking",
      source: "documents",
      isActionRequired: true,
      primaryAction: { label: "Ouvrir le contrôle", href: "/controle" },
    };
  }
  if (warningCount > 0) {
    return {
      title: "Pré-clôture à vérifier",
      message: `Génération possible avec ${warningCount} point${warningCount > 1 ? "s" : ""} de pré-clôture à revoir.`,
      tone: "warning",
      source: "documents",
      isActionRequired: true,
      primaryAction: { label: "Ouvrir le contrôle", href: "/controle" },
    };
  }
  return null;
}

function buildFreshnessGuidance(staleCount: number, blockingCount: number): ActionableGuidance | null {
  if (staleCount <= 0) return null;
  return {
    title: "Documents à mettre à jour",
    message: `${staleCount} document${staleCount > 1 ? "s sont" : " est"} à mettre à jour après les dernières écritures ou OD.`,
    tone: "warning",
    source: "documents",
    isActionRequired: true,
    primaryAction: blockingCount > 0
      ? { label: "Résoudre les contrôles bloquants", href: "/controle" }
      : { label: "Régénérer les documents", href: "/documents" },
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (!value) return "—";
  return `${Math.round(value / 102.4) / 10} Ko`;
}

function formatDuration(value: number | null | undefined) {
  if (value == null) return "durée non renseignée";
  if (value < 1000) return "< 1 s";
  return `${Math.round(value / 100) / 10} s`;
}

function humanGeneratedBy(value: string) {
  if (value.includes("tax-package") || value === "Qitus") return "Qitus";
  if (value.includes("script")) return "Qitus";
  return value;
}

function taxPackageDetail(completeness: { calculated: number; zeroByAbsence?: number; toComplete: number; notApplicable: number }) {
  const zero = completeness.zeroByAbsence ?? 0;
  return [
    `${completeness.calculated} case${completeness.calculated > 1 ? "s" : ""} calculée${completeness.calculated > 1 ? "s" : ""}`,
    zero > 0 ? `dont ${zero} à 0 faute de mouvement` : null,
    `${completeness.toComplete} à compléter avec votre expert-comptable`,
    `${completeness.notApplicable} non applicable${completeness.notApplicable > 1 ? "s" : ""}`,
  ].filter(Boolean).join(" · ");
}

function humanScriptVersion(value: string) {
  if (value.startsWith("tax-package-cerfa-")) return value.replace("tax-package-cerfa-", "");
  if (value.startsWith("phase-")) return "Version Qitus";
  return value;
}
