import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
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

  return (
    <AppShell active="dashboard">
      <Main title="Bonjour" subtitle={`${companyName} · Exercice ${fiscalYearLabel}`} action={<ButtonLink to="/imports" primary>Importer des transactions</ButtonLink>}>
        {demoMessage ? <div className="alert blue">{demoMessage}</div> : null}
        <div className={`alert ${consistency.status === "consistent" ? "blue" : "orange"}`}>
          <strong>{consistency.label}</strong>
          <span>{consistency.checks.filter((check) => !check.ok).length} point à revoir</span>
        </div>
        {overview.alerts.map((alert) => (
          <div key={`${alert.type}-${alert.message}`} className={`alert ${alert.tone}`}>{alert.message}</div>
        ))}
        <div className="kpi-grid">
          <KpiCard label="Chiffre d'affaires" value={formatEuro(overview.kpis.revenue)} hint="Écritures générées" />
          <KpiCard label="Charges" value={formatEuro(overview.kpis.expenses)} hint="Hors clôture" />
          <KpiCard label="Résultat" value={formatEuro(overview.kpis.result)} hint="Avant IS" />
          <KpiCard label="Trésorerie" value={formatEuro(overview.kpis.cash)} hint="Compte 5121" />
          <KpiCard label="À vérifier" value={String(overview.transactionState.reviewCount)} hint="Transactions en revue" />
          <KpiCard label="Documents" value={overview.documentFreshness?.staleCount ? "À régénérer" : "À jour"} hint={`${overview.documentFreshness?.staleCount ?? 0} obsolète`} />
          <KpiCard label="OD brouillon" value={String(overview.closingAdjustments?.draft ?? 0)} hint={`${overview.closingAdjustments?.approved ?? 0} validée`} />
          <KpiCard label="Couverture EC" value={overview.coverage ? `${overview.coverage.score}%` : "—"} hint={overview.coverage?.label ?? "Non calculée"} />
        </div>
        <div className="sec-head">
          <h2>Dernières transactions</h2>
          <ButtonLink to="/transactions">Tout voir</ButtonLink>
        </div>
        <TableShell>
          <table className="tbl">
            <tbody>
              {overview.recentTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="mono">{formatShortDate(transaction.date)}</td>
                  <td>
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
