import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ReconciliationFreshnessCenter } from "~/modules/reconciliations/reconciliation-freshness-center.server";
import { reconciliationEntityTypeLabel, reconciliationMatchStatusLabel, reconciliationRunStatusLabel } from "~/modules/reconciliations/reconciliation-labels";
import { ThirdPartyMatchingCenter } from "~/modules/reconciliations/third-party-matching-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const center = new ThirdPartyMatchingCenter();
  const [summary, items, freshness] = await Promise.all([center.summarizeThirdPartyMatching(workspace), center.listOpenItems(workspace), new ReconciliationFreshnessCenter().getRunFreshness(workspace, "THIRD_PARTY")]);
  return json({ summary, items, freshness });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    await new ThirdPartyMatchingCenter().runThirdPartyMatching(workspace);
    await new ActivityLogCenter().recordActivity(workspace, { action: "reconciliation.third_party_run", entityType: "reconciliation", metadata: { kind: "THIRD_PARTY" } });
    return redirect("/rapprochements/tiers");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/rapprochements/tiers");
  }
}

export default function RapprochementTiers() {
  const { summary, items, freshness } = useLoaderData<typeof loader>();
  return (
    <AppShell active="rapprochements">
      <Main title="Lettrage tiers" subtitle="Clients, fournisseurs et autres tiers">
        <div className={`alert ${freshness.status === "stale" ? "orange" : "blue"}`}><strong>{freshness.label}</strong><span>{freshness.staleReasons[0] ?? "Lettrage tiers exploitable."}</span></div>
        <Form method="post" className="card"><button className="btn btn-p" type="submit">Lancer le lettrage tiers</button></Form>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Statut</div><span className="kpi-val">{reconciliationRunStatusLabel(summary.status)}</span></div>
          <div className="kpi"><div className="kpi-label">Matchés</div><span className="kpi-val">{summary.matched}</span></div>
          <div className="kpi"><div className="kpi-label">Ouverts</div><span className="kpi-val">{summary.openIssues}</span></div>
          <div className="kpi"><div className="kpi-label">Progression</div><span className="kpi-val">{summary.progress}%</span></div>
        </div>
        <table className="tbl">
          <thead><tr><th>Ligne</th><th>Match</th><th>Statut</th><th>Écart</th></tr></thead>
          <tbody>
            {items.map((item) => <tr key={item.id}><td>{reconciliationEntityTypeLabel(item.leftEntityType)} {item.leftEntityId.slice(0, 8)}</td><td>{item.rightEntityId?.slice(0, 8) ?? "—"}</td><td>{reconciliationMatchStatusLabel(item.status)}</td><td>{formatEuro(Number(item.amountDifference))}</td></tr>)}
            {items.length === 0 ? <tr><td colSpan={4} className="sub">Aucun compte tiers ouvert.</td></tr> : null}
          </tbody>
        </table>
      </Main>
    </AppShell>
  );
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
