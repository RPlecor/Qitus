import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { reconciliationIssueCodeLabel, reconciliationIssueStatusLabel, reconciliationKindLabel, reconciliationSeverityLabel } from "~/modules/reconciliations/reconciliation-labels";
import { ReconciliationReviewWorkflow } from "~/modules/reconciliations/reconciliation-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const queue = await new ReconciliationReviewWorkflow().getReviewQueue(workspace, {
    kind: url.searchParams.get("kind") as never,
    status: url.searchParams.get("status") || "OPEN",
    severity: url.searchParams.get("severity"),
    source: url.searchParams.get("source"),
  });
  return json({ queue, filters: Object.fromEntries(url.searchParams.entries()) });
}

export default function RapprochementRevue() {
  const { queue, filters } = useLoaderData<typeof loader>();
  return (
    <AppShell active="rapprochements">
      <Main title="Revue des rapprochements" subtitle={`${queue.open} ouvert(s), ${queue.resolved} résolu(s), ${queue.ignored} ignoré(s)`} action={<Link className="btn" to="/rapprochements">Retour</Link>}>
        <div className="card">
          <Form method="get" className="form-row">
            <div className="field"><label>Type</label><select name="kind" defaultValue={filters.kind ?? ""}><option value="">Tous</option><option value="BANK">Banque</option><option value="STRIPE">Stripe</option><option value="THIRD_PARTY">Tiers</option><option value="SUSPENSE">Attente</option></select></div>
            <div className="field"><label>Statut</label><select name="status" defaultValue={filters.status ?? "OPEN"}><option value="OPEN">Ouvert</option><option value="RESOLVED">Résolu</option><option value="IGNORED">Ignoré</option><option value="">Tous</option></select></div>
            <div className="field"><label>Sévérité</label><select name="severity" defaultValue={filters.severity ?? ""}><option value="">Toutes</option><option value="BLOCKING">Bloquant</option><option value="WARNING">Avertissement</option></select></div>
            <button className="btn btn-p" type="submit">Filtrer</button>
          </Form>
        </div>
        <table className="tbl">
          <thead><tr><th>Point</th><th>Type</th><th>Sévérité</th><th>Statut</th><th>Note</th><th>Action</th></tr></thead>
          <tbody>
            {queue.issues.map((issue) => (
              <tr key={issue.id}>
                <td>{reconciliationIssueCodeLabel(issue.code)}<div className="sub">{issue.entityType === "account" ? `Compte ${issue.entityId}` : "Point de rapprochement"}</div></td>
                <td>{reconciliationKindLabel(issue.run.kind)}</td>
                <td>{reconciliationSeverityLabel(issue.severity)}</td>
                <td>{reconciliationIssueStatusLabel(issue.status)}</td>
                <td>{issue.note}</td>
                <td>
                  <div className="row-actions">
                    <Link className="btn btn-sm" to={hrefFor(issue.code)}>Voir</Link>
                    {issue.status === "OPEN" ? <IssueAction issueKey={issue.issueKey} intent="resolve" label="Résoudre" /> : null}
                    {issue.status === "OPEN" ? <IssueAction issueKey={issue.issueKey} intent="ignore" label="Ignorer" /> : null}
                    {issue.status !== "OPEN" ? <IssueAction issueKey={issue.issueKey} intent="reopen" label="Réouvrir" /> : null}
                  </div>
                </td>
              </tr>
            ))}
            {queue.issues.length === 0 ? <tr><td colSpan={6} className="sub">Aucun point de rapprochement pour ce filtre.</td></tr> : null}
          </tbody>
        </table>
      </Main>
    </AppShell>
  );
}

function IssueAction({ issueKey, intent, label }: { issueKey: string; intent: "resolve" | "ignore" | "reopen"; label: string }) {
  return (
    <Form method="post" action={`/api/reconciliations/issues/${encodeURIComponent(issueKey)}/${intent}`} className="row-actions">
      <input type="hidden" name="note" value={`Décision utilisateur depuis la revue: ${label.toLowerCase()}.`} />
      <button className="btn btn-sm" type="submit">{label}</button>
    </Form>
  );
}

function hrefFor(code: string) {
  if (code.startsWith("BANK")) return "/rapprochements/banque";
  if (code.startsWith("STRIPE")) return "/rapprochements/stripe";
  if (code.startsWith("THIRD_PARTY")) return "/rapprochements/tiers";
  if (code.startsWith("SUSPENSE")) return "/rapprochements/attente";
  return "/rapprochements";
}
