import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main, StatusPill, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DossierSnapshotReviewCenter } from "~/modules/expert-dossier/dossier-snapshot-review-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const center = new DossierSnapshotReviewCenter();
  const state = await center.summarizeSnapshotState(workspace);
  const selectedId = url.searchParams.get("id") ?? state.latest?.id ?? null;
  const detail = selectedId ? await center.getSnapshotDetail(workspace, selectedId) : null;
  const diff = selectedId ? await center.getSnapshotDiff(workspace, selectedId) : null;
  return json({ state, detail, diff });
}

export default function DossierSnapshotsPage() {
  const { state, detail, diff } = useLoaderData<typeof loader>();
  return (
    <AppShell active="dossier-ec">
      <Main title="Snapshots dossier EC" subtitle="Historique des états transmis au cabinet" action={<Link className="btn" to="/dossier-ec">Retour dossier</Link>}>
        <div className={`alert ${state.latest?.freshness.isStale ? "orange" : state.latest ? "blue" : "red"}`}>
          <strong>{state.label}</strong>
          <span>{state.total} snapshot(s) · {state.stale} obsolète(s)</span>
        </div>

        <TableShell>
          <table className="tbl">
            <thead><tr><th>Snapshot</th><th>Statut</th><th>Fraîcheur</th><th>Créé le</th><th></th></tr></thead>
            <tbody>
              {state.snapshots.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td><strong>{snapshot.snapshotKey}</strong><div className="sub mono">{snapshot.id}</div></td>
                  <td>{snapshot.status}</td>
                  <td><StatusPill label={snapshot.freshness.statusLabel} tone={snapshot.freshness.isStale ? "warn" : "ok"} /></td>
                  <td>{formatDateTime(snapshot.createdAt)}</td>
                  <td><Link className="btn btn-sm" to={`/dossier-ec/snapshots?id=${snapshot.id}`}>Voir</Link></td>
                </tr>
              ))}
              {state.snapshots.length === 0 ? <tr><td colSpan={5} className="sub">Aucun snapshot préparé.</td></tr> : null}
            </tbody>
          </table>
        </TableShell>

        {detail ? (
          <div className="card">
            <h2>Détail</h2>
            <p>{detail.snapshotKey} · {detail.status} · {detail.freshness.statusLabel}</p>
            {detail.freshness.reasons.length > 0 ? (
              <ul>
                {detail.freshness.reasons.map((reason) => <li key={`${reason.code}-${reason.at}`}>{reason.label} · {formatDateTime(reason.at)}</li>)}
              </ul>
            ) : <p className="sub">Aucun changement postérieur au snapshot.</p>}
          </div>
        ) : null}

        {diff ? (
          <div className="card">
            <h2>Diff avec l'état courant</h2>
            <p>Score {diff.readiness.previousScore ?? "—"} → {diff.readiness.currentScore} · {diff.changedSections.length} section(s) modifiée(s)</p>
            <TableShell>
              <table className="tbl">
                <thead><tr><th>Section</th><th>Avant</th><th>Maintenant</th><th>Risque</th></tr></thead>
                <tbody>
                  {diff.changedSections.map((section) => (
                    <tr key={section.code}>
                      <td>{section.title}</td>
                      <td>{section.previousStatus ?? "—"}</td>
                      <td>{section.currentStatus}</td>
                      <td>{section.previousRisk ?? "—"} → {section.currentRisk}</td>
                    </tr>
                  ))}
                  {diff.changedSections.length === 0 ? <tr><td colSpan={4} className="sub">Aucune différence de section.</td></tr> : null}
                </tbody>
              </table>
            </TableShell>
          </div>
        ) : null}
      </Main>
    </AppShell>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
