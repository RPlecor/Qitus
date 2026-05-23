import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { AppShell, ButtonLink, KpiCard, Main, StatusBadge, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DashboardOverview } from "~/modules/dashboard/dashboard-overview.server";
import { OperationalDashboardConsistency } from "~/modules/dashboard/operational-dashboard-consistency.server";
import { getDemoDatasetDefinition } from "~/modules/demo/demo-workspace-reset.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const { company, fiscalYear } = workspace;
  const url = new URL(args.request.url);
  const [overview, consistency] = await Promise.all([
    new DashboardOverview().getOverview(workspace),
    new OperationalDashboardConsistency().getConsistencyReport(workspace),
  ]);
  return json({
    companyName: company.name,
    fiscalYearLabel: `${fiscalYear.startDate.getFullYear()}`,
    demoMessage: demoSuccessMessage(url.searchParams.get("demoDataset")),
    overview,
    consistency,
  });
}

export default function Dashboard() {
  const { companyName, fiscalYearLabel, demoMessage, overview, consistency } = useLoaderData<typeof loader>();
  const automationFetcher = useFetcher<{ completed: number; failed: number; skipped: number }>();
  const issueCount = consistency.checks.filter((check) => !check.ok).length;

  return (
    <AppShell active="dashboard">
      <Main
        title={companyName}
        subtitle={`Exercice ${fiscalYearLabel}`}
        action={<ButtonLink to="/imports" primary>Importer des transactions</ButtonLink>}
      >
        {demoMessage ? <div className="alert blue">{demoMessage}</div> : null}

        {/* ── Alertes — groupées dans un panel compact ── */}
        {(overview.alerts.length > 0 || issueCount > 0) ? (
          <div className="dash-notices">
            {issueCount > 0 ? (
              <div className="notice-item notice-warn">
                <span className="notice-dot warn" />
                <span>{consistency.label} — <strong>{issueCount} point{issueCount > 1 ? "s" : ""} à revoir</strong></span>
              </div>
            ) : (
              <div className="notice-item notice-ok">
                <span className="notice-dot ok" />
                <span>{consistency.label}</span>
              </div>
            )}
            {overview.alerts.map((alert) => (
              <div key={`${alert.type}-${alert.message}`} className={`notice-item notice-${alert.tone}`}>
                <span className={`notice-dot ${alert.tone}`} />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* ── KPI financiers — première ligne ── */}
        <div className="dash-section-label">Financier</div>
        <div className="kpi-grid">
          <KpiCard label="Chiffre d'affaires" value={formatEuro(overview.kpis.revenue)} hint="Écritures générées" />
          <KpiCard label="Charges" value={formatEuro(overview.kpis.expenses)} hint="Hors clôture" />
          <KpiCard label="Résultat" value={formatEuro(overview.kpis.result)} hint="Avant IS" />
          <KpiCard label="Trésorerie" value={formatEuro(overview.kpis.cash)} hint="Compte 5121" />
        </div>

        {/* ── KPI opérationnels — seconde ligne ── */}
        <div className="dash-section-label">Opérationnel</div>
        <div className="kpi-grid">
          <KpiCard label="À vérifier" value={String(overview.transactionState.reviewCount)} hint="Transactions en revue" />
          <KpiCard label="Documents" value={overview.documentFreshness?.staleCount ? "À régénérer" : "À jour"} hint={`${overview.documentFreshness?.staleCount ?? 0} obsolète`} />
          <KpiCard label="OD brouillon" value={String(overview.closingAdjustments?.draft ?? 0)} hint={`${overview.closingAdjustments?.approved ?? 0} validée`} />
          <KpiCard label="Couverture EC" value={overview.coverage ? `${overview.coverage.score}%` : "—"} hint={overview.coverage?.label ?? "Non calculée"} />
        </div>

        {/* ── Impacts (ChangeImpactCenter shadow mode) ── */}
        {overview.changeImpacts?.mode === "shadow" && overview.changeImpacts.impacts.length > 0 ? (
          <div className="card impact-card">
            <div className="sec-head">
              <h2>Impacts à traiter</h2>
              <span className="sub">{overview.changeImpacts.performanceBudget.durationMs} ms</span>
            </div>
            {overview.changeImpacts.impacts.slice(0, 3).map((impact) => (
              <div key={impact.code} className={`impact-row ${impact.severity}`}>
                <div className="impact-content">
                  <strong>{impact.title}</strong>
                  <span>{impact.message}</span>
                </div>
                <Link className="btn btn-sm" to={impact.primaryAction.href}>{impact.primaryAction.label}</Link>
              </div>
            ))}
          </div>
        ) : null}

        {overview.automation && overview.automation.total > 0 ? (
          <div className="card impact-card">
            <div className="sec-head">
              <div>
                <h2>État du dossier</h2>
                <span className="sub">
                  {overview.automation.safeRunnable} traitement(s) sûr(s) · {overview.automation.suggestions} validation(s) conseillée(s) · {overview.automation.validationRequired} brouillon(s) ou action(s) à relire
                </span>
              </div>
              {overview.automation.safeRunnable > 0 ? (
                <automationFetcher.Form method="post" action="/api/automation/run-safe">
                  <button className="btn btn-sm" type="submit" disabled={automationFetcher.state !== "idle"}>
                    {automationFetcher.state === "idle" ? "Mettre à jour le sûr" : "Mise à jour..."}
                  </button>
                </automationFetcher.Form>
              ) : null}
            </div>
            {automationFetcher.data ? (
              <div className={automationFetcher.data.failed > 0 ? "alert orange" : "alert green"}>
                {automationFetcher.data.completed} traitement(s) terminé(s), {automationFetcher.data.skipped} ignoré(s), {automationFetcher.data.failed} échoué(s).
              </div>
            ) : null}
            {overview.automation.opportunities.slice(0, 4).map((item) => (
              <div key={item.opportunityKey} className={`impact-row ${item.eligibilityStatus === "blocked" ? "blocking" : item.category === 1 ? "warning" : "info"}`}>
                <div className="impact-content">
                  <strong>{item.title}</strong>
                  <span>{item.eligibilityStatus === "safe" ? item.detail : `${item.detail} ${item.eligibilityReasons[0] ?? ""}`}</span>
                </div>
                <Link className="btn btn-sm" to={item.href}>{item.eligibilityStatus === "safe" ? "Voir" : "Valider"}</Link>
              </div>
            ))}
          </div>
        ) : null}

        {/* ── Dernières transactions ── */}
        <div className="sec-head">
          <h2>Dernières transactions</h2>
          <ButtonLink to="/transactions">Tout voir</ButtonLink>
        </div>
        <TableShell>
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Libellé</th>
                <th>Compte</th>
                <th className="r">Montant</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="mono">{formatShortDate(transaction.date)}</td>
                  <td className="col-vendor">
                    {transaction.needsReview ? <Link to={`/transactions/${transaction.id}`}>{transaction.label}</Link> : transaction.label}
                  </td>
                  <td><span className="cpt">{transaction.account}</span></td>
                  <td className="r mono">{formatEuro(Number(transaction.amount))}</td>
                  <td><StatusBadge status={transaction.needsReview ? "warn" : "ok"} /></td>
                </tr>
              ))}
              {overview.recentTransactions.length === 0 ? (
                <tr><td colSpan={5} className="sub">Aucune transaction importée.</td></tr>
              ) : null}
            </tbody>
          </table>
        </TableShell>
      </Main>
    </AppShell>
  );
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(value));
}

function demoSuccessMessage(datasetId: string | null) {
  if (!datasetId) return null;
  try {
    const dataset = getDemoDatasetDefinition(datasetId);
    return `Dataset chargé : ${dataset.label}`;
  } catch {
    return "Dataset chargé.";
  }
}
