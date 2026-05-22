import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useRevalidator } from "@remix-run/react";
import { useEffect } from "react";
import { AppShell, Main, StatusBadge } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ImportHistory } from "~/modules/import-orchestrator/import-history.server";

export async function loader(args: LoaderFunctionArgs) {
  const { fiscalYear } = await requireCompanyWorkspace(args);
  const imports = await new ImportHistory().listImports(fiscalYear.id);
  return json({ imports });
}

export default function Imports() {
  const { imports } = useLoaderData<typeof loader>();
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
                    {importRow.actions.canRetryCategorization ? <Form method="post" action={`/api/imports/${importRow.id}/retry-categorization`}><button className="btn btn-sm" type="submit">Retry IA</button></Form> : null}
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
