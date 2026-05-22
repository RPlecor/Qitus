import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { AppShell, KpiCard, Main, StatusPill, TableShell } from "~/components/ui";
import { AccountingCoverageCenter, type CoverageArea } from "~/modules/accounting-coverage/accounting-coverage-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const coverage = await new AccountingCoverageCenter().getCoverageOverview(workspace);
  return json({ coverage });
}

export default function Couverture() {
  const { coverage } = useLoaderData<typeof loader>();
  const highRiskAreas = coverage.areas.filter((area) => area.risk === "high" && area.status !== "covered");

  return (
    <AppShell active="couverture">
      <Main title="Couverture EC" subtitle="Gel beta et préparation expert-comptable">
        <div className={`alert ${coverage.status === "beta_ready" ? "blue" : coverage.status === "blocked" ? "red" : "orange"}`}>
          <strong>{coverage.label}</strong>
          <span>Score {coverage.score} / 100</span>
        </div>

        <div className="kpi-grid">
          <KpiCard label="Score" value={`${coverage.score}%`} hint="Couverture calculée" />
          <KpiCard label="Couverts" value={String(coverage.covered)} hint="Domaines prêts" />
          <KpiCard label="Partiels" value={String(coverage.partial)} hint="À compléter" />
          <KpiCard label="Manquants" value={String(coverage.missing)} hint={`${coverage.highRisk} risque élevé`} />
        </div>

        {highRiskAreas.length > 0 ? (
          <section className="panel">
            <h2>Risques principaux</h2>
            <ul className="evidence-list">
              {highRiskAreas.slice(0, 5).map((area) => (
                <li key={area.code}>
                  <span>{area.title}</span>
                  <StatusPill label={statusLabel(area.status)} tone="error" />
                  <Link className="btn btn-sm" to={`/couverture/${area.code}`}>Détail</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="sec-head"><h2>Domaines de couverture</h2></div>
        <TableShell>
        <table className="tbl">
          <thead><tr><th>Domaine</th><th>Statut</th><th>Risque</th><th>Résumé</th><th>Phase</th><th></th></tr></thead>
          <tbody>
            {coverage.areas.map((area: CoverageArea) => (
              <tr key={area.code}>
                <td>{area.title}</td>
                <td><StatusPill label={statusLabel(area.status)} tone={statusTone(area.status)} /></td>
                <td>{riskLabel(area.risk)}</td>
                <td className="sub">{area.summary}</td>
                <td>{area.nextPhase}</td>
                <td><Link className="btn btn-sm" to={`/couverture/${area.code}`}>Voir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        </TableShell>
      </Main>
    </AppShell>
  );
}

export function statusLabel(status: string) {
  if (status === "covered") return "Couvert";
  if (status === "partial") return "Partiel";
  if (status === "missing") return "Manquant";
  return "Non applicable";
}

export function statusTone(status: string): "ok" | "done" | "error" | "warn" | "neutral" {
  if (status === "covered") return "done";
  if (status === "missing") return "error";
  if (status === "partial") return "warn";
  return "neutral";
}

export function riskLabel(risk: string) {
  if (risk === "high") return "Élevé";
  if (risk === "medium") return "Moyen";
  return "Faible";
}
