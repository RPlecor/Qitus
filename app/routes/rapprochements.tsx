import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { AppShell, KpiCard, Main, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ConnectorSyncCenter } from "~/modules/reconciliations/connector-sync-center.server";
import { ReconciliationFreshnessCenter } from "~/modules/reconciliations/reconciliation-freshness-center.server";
import { ReconciliationIssueWorkflow } from "~/modules/reconciliations/reconciliation-issue-workflow.server";
import { connectorMessageLabel, connectorModeLabel, connectorProviderLabel, connectorSourceLabel, reconciliationRunStatusLabel } from "~/modules/reconciliations/reconciliation-labels";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const [readiness, freshness, connectors] = await Promise.all([
    new ReconciliationIssueWorkflow().summarizeReconciliationReadiness(workspace),
    new ReconciliationFreshnessCenter().getFreshness(workspace),
    Promise.resolve(new ConnectorSyncCenter().getConnectorStatus(workspace)),
  ]);
  return json({ readiness, freshness, connectors });
}

export default function Rapprochements() {
  const { readiness, freshness, connectors } = useLoaderData<typeof loader>();
  const cards = [
    { href: "/rapprochements/banque", title: "Banque", summary: readiness.bank, freshness: freshness.runs.BANK },
    { href: "/rapprochements/stripe", title: "Stripe", summary: readiness.stripe, freshness: freshness.runs.STRIPE },
    { href: "/rapprochements/tiers", title: "Tiers", summary: readiness.thirdParty, freshness: freshness.runs.THIRD_PARTY },
    { href: "/rapprochements/attente", title: "Comptes d'attente", summary: readiness.suspense, freshness: freshness.runs.SUSPENSE },
  ];
  return (
    <AppShell active="rapprochements">
      <Main title="Rapprochements" subtitle="Banque, Stripe, tiers et comptes d'attente" action={<Link className="btn btn-p" to="/rapprochements/revue">Revue des issues</Link>}>
        <div className={`alert ${readiness.status === "blocked" ? "orange" : "blue"}`}>
          <strong>{readiness.status === "blocked" ? "Rapprochements à traiter" : "Rapprochements prêts"}</strong>
          <span>{readiness.issues.blocking} blocage(s), {readiness.issues.warning} avertissement(s), {freshness.staleCount} à relancer</span>
        </div>
        <div className="kpi-grid">
          <KpiCard label="Blocages" value={String(readiness.issues.blocking)} hint="Issues ouvertes bloquantes" />
          <KpiCard label="Avertissements" value={String(readiness.issues.warning)} hint="À documenter" />
          <KpiCard label="Progression banque" value={`${readiness.bank.progress}%`} hint={reconciliationRunStatusLabel(readiness.bank.status)} />
          <KpiCard label="Fraîcheur" value={freshness.staleCount === 0 ? "OK" : String(freshness.staleCount)} hint={freshness.staleCount === 0 ? "Rapprochements à jour" : "Rapprochements à relancer"} />
        </div>
        <section className="card">
          <div className="sec-head"><h2>Connecteurs</h2><span>{connectorModeLabel(connectors.mode)}</span></div>
          <TableShell>
          <table className="tbl">
            <tbody>
              {connectors.connectors.map((connector) => (
                <tr key={connector.provider}><td>{connectorProviderLabel(connector.provider)}</td><td>{connectorSourceLabel(connector.source)}</td><td>{connector.configured ? "Configuré" : "Non configuré"}</td><td>{connectorMessageLabel(connector)}</td></tr>
              ))}
            </tbody>
          </table>
          </TableShell>
        </section>
        <div className="grid two">
          {cards.map((card) => (
            <Link key={card.href} className="card" to={card.href}>
              <div className="sec-head"><h2>{card.title}</h2><span>{card.freshness.label}</span></div>
              <p className="sub">{card.summary.matched} matché(s), {card.summary.openIssues} issue(s) ouverte(s), progression {card.summary.progress}%.</p>
              {card.freshness.staleReasons.length > 0 ? <p className="sub">{card.freshness.staleReasons[0]}</p> : null}
            </Link>
          ))}
        </div>
      </Main>
    </AppShell>
  );
}
