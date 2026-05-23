import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { AppShell, Main, TableShell } from "~/components/ui";
import { AccountingReviewCenter } from "~/modules/accounting-review/accounting-review-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DocumentCatalog } from "~/modules/documents/document-catalog.server";
import { DocumentGenerationAuditCenter } from "~/modules/documents/document-generation-audit-center.server";
import { DocumentFreshnessCenter } from "~/modules/documents/document-freshness-center.server";
import { documentFormatLabel, documentTypeLabel, freshnessLabel } from "~/modules/ui-labels";

export async function loader(args: LoaderFunctionArgs) {
  const { request } = args;
  const workspace = await requireCompanyWorkspace(args);
  const documents = await new DocumentCatalog().listDocuments(workspace);
  const freshness = await new DocumentFreshnessCenter().getFreshness(workspace);
  const generationAudit = await new DocumentGenerationAuditCenter().getLatestGenerationAudit(workspace);
  const review = await new AccountingReviewCenter().getReview(workspace);
  const error = new URL(request.url).searchParams.get("error");
  return json({ documents, error, review, freshness, generationAudit });
}

export default function Documents() {
  const { documents, error, review, freshness, generationAudit } = useLoaderData<typeof loader>();
  const hasFec = documents.some((document) => document.type === "FEC");
  return (
    <AppShell active="documents">
      <Main title="Documents" subtitle="Générés par Qitus">
        {error ? <div className="alert red">{error}</div> : null}
        {review.blockingCount > 0 ? (
          <div className="alert red">
            Génération bloquée par {review.blockingCount} contrôle{review.blockingCount > 1 ? "s" : ""}. Va dans Contrôle avant de générer.
          </div>
        ) : review.warningCount > 0 ? (
          <div className="alert orange">
            Génération possible avec {review.warningCount} point{review.warningCount > 1 ? "s" : ""} de pré-clôture à revoir.
          </div>
        ) : null}
        {freshness.staleCount > 0 ? (
          <div className="alert orange">
            {freshness.staleCount} document{freshness.staleCount > 1 ? "s" : ""} à régénérer après les dernières écritures ou OD.
          </div>
        ) : null}
        <div className="doc-grid">
          <div className="card doc-card">
            <h3>FEC</h3>
            <p>Fichier des écritures comptables 18 colonnes.</p>
            <Form method="post" action="/api/documents/fec/generate"><button className="btn btn-p">Générer</button></Form>
          </div>
          <div className="card doc-card">
            <h3>États financiers</h3>
            <p>Balance, bilan et compte de résultat en Markdown.</p>
            <Form method="post" action="/api/documents/statements/generate"><button className="btn">Générer</button></Form>
          </div>
          <div className="card doc-card">
            <h3>Liasse fiscale</h3>
            <p>Source structurée vérifiable. PDF dérivé si le runtime est disponible.</p>
            <Form method="post" action="/api/documents/liasse/generate"><button className="btn">Générer</button></Form>
          </div>
        </div>
        <div className="sec-head">
          <h2>Audit génération</h2>
          {hasFec ? <a className="btn" href="/api/documents/evidence-bundle">Télécharger paquet de preuve</a> : null}
        </div>
        <div className="card">
          {generationAudit ? (
            <>
              <h3>{generationAudit.label}</h3>
              <p className="sub">
                {generationAudit.types.map(documentTypeLabel).join(", ")} · {generationAudit.filenames.join(", ") || "Aucun fichier"} · {generationAudit.durationMs ?? 0} ms
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
            <thead><tr><th>Date</th><th>Type</th><th>Fichier</th><th>État</th><th>Format</th><th className="r">Taille</th><th>Écritures</th><th>Script</th><th>Généré par</th><th></th></tr></thead>
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
                  <td className="mono wrap-anywhere">{document.scriptVersion ?? "Non renseigné"}</td>
                  <td>{document.generatedBy}</td>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (!value) return "—";
  return `${Math.round(value / 102.4) / 10} Ko`;
}
