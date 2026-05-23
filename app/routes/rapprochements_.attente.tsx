import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ReconciliationFreshnessCenter } from "~/modules/reconciliations/reconciliation-freshness-center.server";
import { reconciliationIssueCodeLabel, reconciliationIssueStatusLabel, reconciliationRunStatusLabel, reconciliationSeverityLabel } from "~/modules/reconciliations/reconciliation-labels";
import { SuspenseAccountCenter } from "~/modules/reconciliations/suspense-account-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const center = new SuspenseAccountCenter();
  const [summary, items, freshness] = await Promise.all([center.summarizeSuspenseAccounts(workspace), center.listSuspenseItems(workspace), new ReconciliationFreshnessCenter().getRunFreshness(workspace, "SUSPENSE")]);
  return json({ summary, items, freshness });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  try {
    await assertFiscalYearMutable(workspace);
    await new SuspenseAccountCenter().resolveSuspenseItem(workspace, {
      issueKey: String(form.get("issueKey")),
      status: String(form.get("status")) === "IGNORED" ? "IGNORED" : "RESOLVED",
      note: String(form.get("note") || "Traité depuis les comptes d'attente"),
    });
    await new ActivityLogCenter().recordActivity(workspace, { action: "reconciliation.suspense_resolved", entityType: "reconciliation", entityId: String(form.get("issueKey")), metadata: { status: String(form.get("status")) } });
    return redirect("/rapprochements/attente");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/rapprochements/attente");
  }
}

export default function RapprochementAttente() {
  const { summary, items, freshness } = useLoaderData<typeof loader>();
  return (
    <AppShell active="rapprochements">
      <Main title="Comptes d'attente" subtitle="471, 467, 511 et 580">
        <div className={`alert ${freshness.status === "stale" ? "orange" : "blue"}`}><strong>{freshness.label}</strong><span>{freshness.staleReasons[0] ?? "Comptes d'attente actualisés."}</span></div>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Statut</div><span className="kpi-val">{reconciliationRunStatusLabel(summary.status)}</span></div>
          <div className="kpi"><div className="kpi-label">Ouverts</div><span className="kpi-val">{summary.openIssues}</span></div>
          <div className="kpi"><div className="kpi-label">Résolus</div><span className="kpi-val">{summary.resolvedIssues}</span></div>
          <div className="kpi"><div className="kpi-label">Ignorés</div><span className="kpi-val">{summary.ignoredIssues}</span></div>
        </div>
        <table className="tbl">
          <thead><tr><th>Issue</th><th>Sévérité</th><th>Statut</th><th>Note</th><th>Action</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{reconciliationIssueCodeLabel(item.code)}<div className="sub">{item.entityType === "account" ? `Compte ${item.entityId}` : "Point à traiter"}</div></td>
                <td>{reconciliationSeverityLabel(item.severity)}</td>
                <td>{reconciliationIssueStatusLabel(item.status)}</td>
                <td>{item.note}</td>
                <td>
                  <Form method="post" className="row-actions">
                    <input type="hidden" name="issueKey" value={item.issueKey} />
                    <input type="hidden" name="note" value="Décision utilisateur depuis rapprochements" />
                    <button className="btn" name="status" value="RESOLVED" type="submit">Résoudre</button>
                    <button className="btn" name="status" value="IGNORED" type="submit">Ignorer</button>
                  </Form>
                </td>
              </tr>
            ))}
            {items.length === 0 ? <tr><td colSpan={5} className="sub">Aucun compte d'attente ouvert.</td></tr> : null}
          </tbody>
        </table>
      </Main>
    </AppShell>
  );
}
