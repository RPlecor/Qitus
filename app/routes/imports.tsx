import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useRevalidator, useSearchParams } from "@remix-run/react";
import { useEffect } from "react";
import { AppShell, Main, StatusBadge } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ImportCleanupCenter } from "~/modules/import-orchestrator/import-cleanup-center.server";
import { ImportHistory } from "~/modules/import-orchestrator/import-history.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const { fiscalYear } = workspace;
  const imports = await new ImportHistory().listImports(fiscalYear.id);
  const cleanup = new ImportCleanupCenter();
  const resetPreview = await cleanup.previewFiscalYearImportReset(workspace);
  const deletionPreviews = Object.fromEntries(await Promise.all(
    imports.map(async (importRow) => [importRow.id, await cleanup.previewImportDeletion(workspace, importRow.id)] as const)
  ));
  return json({ imports, resetPreview, deletionPreviews });
}

export default function Imports() {
  const { imports, resetPreview, deletionPreviews } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const hasRunningImport = imports.some((importRow) => ["PENDING", "PARSING", "CATEGORIZING"].includes(importRow.status));

  useEffect(() => {
    if (!hasRunningImport) return;
    const interval = window.setInterval(() => revalidator.revalidate(), 2000);
    return () => window.clearInterval(interval);
  }, [hasRunningImport, revalidator]);

  return (
    <AppShell active="imports">
      <Main title="Imports" subtitle="CSV bancaires">
        {searchParams.get("deleted") ? <div className="alert blue"><strong>{searchParams.get("deleted")}</strong></div> : null}
        {searchParams.get("reset") ? <div className="alert blue"><strong>{searchParams.get("reset")}</strong></div> : null}
        {searchParams.get("error") ? <div className="alert red"><strong>{searchParams.get("error")}</strong></div> : null}
        <div className="card" style={{ maxWidth: 680 }}>
          <h2>Importez un relevé bancaire.</h2>
          <p className="sub">Formats MVP : Qonto, BNP Paribas, Société Générale, Boursorama, ou mapping manuel.</p>
          <Form method="post" action="/api/imports" encType="multipart/form-data">
            <div className="field">
              <label>Fichier CSV</label>
              <input type="file" name="file" accept=".csv,text/csv" required />
            </div>
            <button className="btn btn-p" type="submit">Lancer l'import</button>
          </Form>
        </div>
        <div className="card" style={{ maxWidth: 760 }}>
          <h2>Réinitialiser les imports de l'exercice.</h2>
          <p className="sub">
            Supprime {resetPreview.importCount} import(s), {resetPreview.transactionCount} transaction(s),
            {" "}{resetPreview.journalEntryCount} écriture(s) d'import et {resetPreview.journalLineCount} ligne(s) comptable(s).
            Les règles, le profil, les pièces et l'audit sont conservés.
          </p>
          {resetPreview.warnings.map((warning) => <div key={warning} className="alert orange">{warning}</div>)}
          <Form method="post" action="/api/imports/reset" className="stack-sm">
            <div className="field">
              <label>Confirmation</label>
              <input name="confirmation" placeholder="RESET IMPORTS" disabled={resetPreview.importCount === 0} />
            </div>
            <button className="btn btn-danger" type="submit" disabled={resetPreview.importCount === 0}>Réinitialiser les imports de cet exercice</button>
          </Form>
        </div>
        <div className="sec-head"><h2>Historique</h2></div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Fichier</th><th>Format</th><th>Étape</th><th>Progression</th><th className="r">Lignes</th><th className="r">Catégorisées</th><th className="r">À vérifier</th><th>Durée</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {imports.map((importRow) => (
              <tr key={importRow.id}>
                <td className="mono">{formatDate(importRow.createdAt)}</td>
                <td>{importRow.filename}</td>
                <td>{importRow.format}</td>
                <td>{stepLabel(importRow.currentStep)}</td>
                <td>
                  <div className="progress" aria-label={`${importRow.progress}%`}>
                    <span style={{ width: `${importRow.progress}%` }} />
                  </div>
                  <span className="mono">{importRow.progress}%</span>
                </td>
                <td className="r mono">{importRow.parsedRows}/{importRow.totalRows}</td>
                <td className="r mono">{importRow.categorizedRows}</td>
                <td className="r mono">{importRow.reviewRows}</td>
                <td className="mono">{formatDuration(importRow.durationMs)}</td>
                <td><StatusBadge status={toBadgeStatus(importRow.statusKind)} /></td>
                <td>
                  <div className="row-actions">
                    {importRow.actions.needsMapping ? <Link className="btn btn-sm" to={`/imports/${importRow.id}/mapping`}>Mapping</Link> : null}
                    {importRow.actions.canRetry ? <Form method="post" action={`/api/imports/${importRow.id}/retry`}><button className="btn btn-sm" type="submit">Retry</button></Form> : null}
                    {importRow.actions.canRetryCategorization ? <Form method="post" action={`/api/imports/${importRow.id}/retry-categorization`}><button className="btn btn-sm" type="submit">Relancer la catégorisation</button></Form> : null}
                    <details className="danger-details">
                      <summary className="btn btn-sm btn-danger">Supprimer</summary>
                      <div className="danger-popover">
                        <p className="sub">
                          {deletionPreviews[importRow.id]?.transactionCount ?? 0} transaction(s),
                          {" "}{deletionPreviews[importRow.id]?.journalEntryCount ?? 0} écriture(s) et
                          {" "}{deletionPreviews[importRow.id]?.journalLineCount ?? 0} ligne(s) seront supprimées.
                        </p>
                        <Form method="post" action={`/api/imports/${importRow.id}`}>
                          <input name="confirmation" placeholder="SUPPRIMER" aria-label="Confirmation suppression import" />
                          <button className="btn btn-sm btn-danger" type="submit">Confirmer</button>
                        </Form>
                      </div>
                    </details>
                  </div>
                  {importRow.errorMessage ? <div className="err-short">{importRow.errorMessage}</div> : null}
                </td>
              </tr>
            ))}
            {imports.length === 0 ? (
              <tr><td colSpan={11} className="sub">Aucun import lancé pour cet exercice.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Main>
    </AppShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function toBadgeStatus(statusKind: "done" | "warn" | "error" | "pending") {
  if (statusKind === "done") return "done";
  if (statusKind === "error") return "error";
  if (statusKind === "pending") return "pending";
  return "warn";
}

function stepLabel(step: string | null) {
  const labels: Record<string, string> = {
    queued: "En attente",
    "detect-and-parse": "Détection CSV",
    "await-mapping": "Mapping requis",
    "create-transactions": "Transactions",
    categorize: "Catégorisation",
    "write-ledger": "Écritures",
    complete: "Terminé",
  };
  return step ? labels[step] ?? step : "—";
}

function formatDuration(value: number | null) {
  if (value == null) return "—";
  if (value < 1000) return `${value} ms`;
  return `${Math.round(value / 100) / 10} s`;
}
