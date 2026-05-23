import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { VatDeclarationCenter } from "~/modules/vat/vat-declaration-center.server";
import { VatDeclarationFreshnessCenter } from "~/modules/vat/vat-declaration-freshness-center.server";
import { VatRegularizationCenter } from "~/modules/vat/vat-regularization-center.server";
import { freshnessLabel, vatDeclarationStatusLabel } from "~/modules/ui-labels";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const declaration = await new VatDeclarationCenter().getDeclaration(workspace, String(args.params.declarationId));
  const [settlement, freshness] = await Promise.all([
    new VatRegularizationCenter().previewSettlement(workspace, declaration.id),
    new VatDeclarationFreshnessCenter().getDeclarationFreshness(workspace, declaration.id),
  ]);
  return json({ declaration, settlement, freshness });
}

export default function VatDeclarationDetail() {
  const { declaration, settlement, freshness } = useLoaderData<typeof loader>();
  const amounts = declaration.amounts as { baseHt?: number; deductible?: number; collected?: number; reverseChargeDue?: number; net?: number };
  const controls = declaration.controls as Array<{ code: string; severity: string; title: string; detail: string }>;
  const source = declaration.source as { byRate?: Array<{ key: string; baseHt: number; deductible: number; collected: number; reverseChargeDue: number; net: number }> };

  return (
    <AppShell active="tva">
      <Main title={`Déclaration TVA ${declaration.type}`} subtitle={`${declaration.periodStart} → ${declaration.periodEnd}`}>
        <div className="row-actions">
          <Link className="btn btn-ghost" to="/tva">← TVA</Link>
          {declaration.documentId ? <a className="btn" href={`/api/vat/declarations/${declaration.id}/download`}>Télécharger</a> : null}
          {freshness?.isStale ? <Link className="btn" to={`/tva/revue?issue=${encodeURIComponent(`VAT_DECLARATION_STALE:declaration:${declaration.id}`)}`}>Régénérer</Link> : null}
        </div>

        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Statut</div><span className="kpi-val">{vatDeclarationStatusLabel(declaration.status)}</span></div>
          <div className="kpi"><div className="kpi-label">Fraîcheur</div><span className="kpi-val">{freshnessLabel(freshness?.statusLabel ?? "Active")}</span></div>
          <div className="kpi"><div className="kpi-label">TVA collectée</div><span className="kpi-val">{formatEuro(amounts.collected ?? 0)}</span></div>
          <div className="kpi"><div className="kpi-label">TVA déductible</div><span className="kpi-val">{formatEuro(amounts.deductible ?? 0)}</span></div>
        </div>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Net</div><span className="kpi-val">{formatEuro(amounts.net ?? 0)}</span><div className="sub">{settlement.label}</div></div>
        </div>
        {freshness?.isStale ? (
          <div className="alert orange">
            Déclaration à régénérer : {freshness.staleReasons.map((reason) => reason.label).join(", ")}
          </div>
        ) : null}

        <section className="panel">
          <h2>Cases brouillon</h2>
          <table className="tbl">
            <tbody>
              <tr><td>Base HT taxable</td><td>{formatEuro(amounts.baseHt ?? 0)}</td></tr>
              <tr><td>TVA collectée</td><td>{formatEuro(amounts.collected ?? 0)}</td></tr>
              <tr><td>TVA déductible</td><td>{formatEuro(amounts.deductible ?? 0)}</td></tr>
              <tr><td>TVA autoliquidée</td><td>{formatEuro(amounts.reverseChargeDue ?? 0)}</td></tr>
              <tr><td>TVA nette</td><td>{formatEuro(amounts.net ?? 0)}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Sources par taux</h2>
          <table className="tbl">
            <thead><tr><th>Taux</th><th>Base HT</th><th>Déductible</th><th>Collectée</th><th>Net</th></tr></thead>
            <tbody>
              {(source.byRate ?? []).map((row) => <tr key={row.key}><td>{row.key}</td><td>{formatEuro(row.baseHt)}</td><td>{formatEuro(row.deductible)}</td><td>{formatEuro(row.collected + row.reverseChargeDue)}</td><td>{formatEuro(row.net)}</td></tr>)}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Contrôles</h2>
          <ul className="evidence-list">
            {controls.map((control) => <li key={control.code ?? control.title}>{control.severity === "blocking" ? "Bloquant" : "Avertissement"} · {control.title} · {control.detail}</li>)}
            {controls.length === 0 ? <li>Aucun contrôle actif au moment de la génération.</li> : null}
          </ul>
          <p className="sub">Comparaison journal courant : écart {formatEuro(declaration.comparison.delta)}.</p>
        </section>
      </Main>
    </AppShell>
  );
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
