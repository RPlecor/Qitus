import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ConnectorSyncCenter } from "~/modules/reconciliations/connector-sync-center.server";
import { ReconciliationFreshnessCenter } from "~/modules/reconciliations/reconciliation-freshness-center.server";
import { connectorMessageLabel, reconciliationMatchStatusLabel, reconciliationRunStatusLabel, stripeEventTypeLabel } from "~/modules/reconciliations/reconciliation-labels";
import { StripeReconciliationCenter } from "~/modules/reconciliations/stripe-reconciliation-center.server";
import { ExpectedRouteError, jsonOrRedirectError } from "~/modules/route-errors.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const center = new StripeReconciliationCenter();
  const [summary, events, matches, freshness, connectors] = await Promise.all([
    center.summarizeStripeReconciliation(workspace),
    center.listStripeEvents(workspace),
    center.listStripeMatches(workspace),
    new ReconciliationFreshnessCenter().getRunFreshness(workspace, "STRIPE"),
    Promise.resolve(new ConnectorSyncCenter().getConnectorStatus(workspace)),
  ]);
  return json({ summary, events, matches, freshness, connectors, internalTestMode: getRuntimeConfig().qitusInternalTestMode });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const center = new StripeReconciliationCenter();
  try {
    await assertFiscalYearMutable(workspace);
    if (form.get("intent") === "fixture") {
      if (!getRuntimeConfig().qitusInternalTestMode) throw new ExpectedRouteError("Banc de test interne désactivé.", 403);
      await center.importStripeFixture(workspace);
      await new ActivityLogCenter().recordActivity(workspace, { action: "internal_test.stripe_imported", entityType: "reconciliation", metadata: { provider: "stripe", testMode: true } });
    }
    if (form.get("intent") === "sync") {
      const config = getRuntimeConfig();
      if (!config.qitusInternalTestMode && config.connectorsMode === "fixture") throw new ExpectedRouteError("Banc de test interne désactivé.", 403);
      await new ConnectorSyncCenter(config).syncStripe(workspace);
      await new ActivityLogCenter().recordActivity(workspace, { action: "reconciliation.stripe_synced", entityType: "reconciliation", metadata: { provider: "stripe" } });
    }
    if (form.get("intent") === "run") {
      await center.runStripeMatching(workspace);
      await new ActivityLogCenter().recordActivity(workspace, { action: "reconciliation.stripe_run", entityType: "reconciliation", metadata: { kind: "STRIPE" } });
    }
    return redirect("/rapprochements/stripe");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/rapprochements/stripe");
  }
}

export default function RapprochementStripe() {
  const { summary, events, matches, freshness, connectors, internalTestMode } = useLoaderData<typeof loader>();
  const stripeConnector = connectors.connectors.find((connector) => connector.provider === "stripe");
  return (
    <AppShell active="rapprochements">
      <Main title="Rapprochement Stripe" subtitle={`${summary.payouts} payout(s), ${summary.events} événement(s)`}>
        <div className={`alert ${freshness.status === "stale" ? "orange" : "blue"}`}>
          <strong>{freshness.label}</strong>
          <span>{freshness.staleReasons[0] ?? (stripeConnector ? connectorMessageLabel(stripeConnector) : internalTestMode ? "Données Stripe de test disponibles en mode interne." : "Connecteur Stripe à configurer.")}</span>
        </div>
        <div className="card">
          <div className="row-actions">
            {internalTestMode ? <Form method="post"><input type="hidden" name="intent" value="fixture" /><button className="btn" type="submit">Tester un payout Stripe</button></Form> : null}
            <Form method="post"><input type="hidden" name="intent" value="sync" /><button className="btn" type="submit">Mettre à jour Stripe</button></Form>
            <Form method="post"><input type="hidden" name="intent" value="run" /><button className="btn btn-p" type="submit">Lancer rapprochement</button></Form>
          </div>
        </div>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Statut</div><span className="kpi-val">{reconciliationRunStatusLabel(summary.status)}</span></div>
          <div className="kpi"><div className="kpi-label">Payouts matchés</div><span className="kpi-val">{summary.matched}</span></div>
          <div className="kpi"><div className="kpi-label">Points ouverts</div><span className="kpi-val">{summary.openIssues}</span></div>
          <div className="kpi"><div className="kpi-label">Progression</div><span className="kpi-val">{summary.progress}%</span></div>
        </div>
        <section className="card">
          <div className="sec-head"><h2>Matches payouts</h2></div>
          <table className="tbl">
            <thead><tr><th>Payout</th><th>Banque</th><th>Statut</th><th>Écart</th></tr></thead>
            <tbody>
              {matches.map((match) => <tr key={match.id}><td>{short(match.leftEntityId)}</td><td>{match.rightEntityId ? short(match.rightEntityId) : "—"}</td><td>{reconciliationMatchStatusLabel(match.status)}</td><td>{formatEuro(Number(match.amountDifference))}</td></tr>)}
              {matches.length === 0 ? <tr><td colSpan={4} className="sub">Aucun match Stripe.</td></tr> : null}
            </tbody>
          </table>
        </section>
        <section className="card">
          <div className="sec-head"><h2>Événements Stripe</h2></div>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Type</th><th>Brut</th><th>Frais</th><th>Net</th></tr></thead>
            <tbody>
              {events.slice(0, 25).map((event) => <tr key={event.id}><td>{formatDate(event.date)}</td><td>{stripeEventTypeLabel(event.eventType)}</td><td>{formatEuro(Number(event.grossAmount))}</td><td>{formatEuro(Number(event.feeAmount))}</td><td>{formatEuro(Number(event.netAmount))}</td></tr>)}
              {events.length === 0 ? <tr><td colSpan={5} className="sub">Aucun événement Stripe importé.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </Main>
    </AppShell>
  );
}

function short(value: string) {
  return value.slice(0, 8);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
