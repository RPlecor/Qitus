import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { VatControlCenter } from "~/modules/vat/vat-control-center.server";
import { VatDeclarationCenter } from "~/modules/vat/vat-declaration-center.server";
import { VatPositionCenter } from "~/modules/vat/vat-position-center.server";
import { VatRegularizationCenter } from "~/modules/vat/vat-regularization-center.server";
import { VatReviewWorkflow } from "~/modules/vat/vat-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const filters = { dateFrom: url.searchParams.get("dateFrom"), dateTo: url.searchParams.get("dateTo") };
  const [position, review, declarations, settlement, queue] = await Promise.all([
    new VatPositionCenter().getVatPosition(workspace, filters),
    new VatControlCenter().getVatReview(workspace, filters),
    new VatDeclarationCenter().listDeclarations(workspace),
    new VatRegularizationCenter().summarizeOpenVatBalance(workspace),
    new VatReviewWorkflow().getReviewQueue(workspace, filters),
  ]);
  return json({ position, review, declarations, settlement, queue, query: Object.fromEntries(url.searchParams) });
}

export default function TvaPage() {
  const { position, review, declarations, settlement, queue, query } = useLoaderData<typeof loader>();
  const declarationType = position.regime === "REEL_NORMAL" ? "CA3" : "CA12";
  const hasActiveDeclaration = declarations.some((declaration) => declaration.active);

  return (
    <AppShell active="tva">
      <Main title="TVA" subtitle="Position déclarative et brouillons CA3/CA12">
        {query.success ? <div className="alert blue"><strong>{query.success}</strong></div> : null}
        {query.error ? <div className="alert red"><strong>{query.error}</strong></div> : null}

        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Régime</div><span className="kpi-val">{position.regime}</span><div className="sub">{position.exigibility}</div></div>
          <div className="kpi"><div className="kpi-label">TVA collectée</div><span className="kpi-val">{formatEuro(position.totals.collected)}</span><div className="sub">44571</div></div>
          <div className="kpi"><div className="kpi-label">TVA déductible</div><span className="kpi-val">{formatEuro(position.totals.deductible)}</span><div className="sub">44566</div></div>
          <div className="kpi"><div className="kpi-label">Net</div><span className="kpi-val">{formatEuro(position.totals.net)}</span><div className="sub">{settlement.label ?? settlement.kind}</div></div>
        </div>

        <Form method="get" className="card">
          <div className="form-row">
            <div className="field"><label>Début</label><input type="date" name="dateFrom" defaultValue={query.dateFrom ?? position.periodStart} /></div>
            <div className="field"><label>Fin</label><input type="date" name="dateTo" defaultValue={query.dateTo ?? position.periodEnd} /></div>
            <div className="field"><label>&nbsp;</label><button className="btn" type="submit">Filtrer</button></div>
          </div>
        </Form>

        <section className="panel">
          <div className="row between">
            <h2>Contrôles TVA</h2>
            <span className={review.status === "blocked" ? "st-error" : review.status === "ready" ? "st-done" : "st-warn"}>{statusLabel(review.status)}</span>
          </div>
          {queue.issues.length > 0 ? <p className="sub">{queue.issues.length} point{queue.issues.length > 1 ? "s" : ""} à traiter dans la revue guidée.</p> : null}
          <ul className="evidence-list">
            {review.controls.map((control) => <li key={control.code}><span>{control.title} · {control.detail}</span><Link className="btn btn-sm" to={control.href}>Voir</Link></li>)}
            {review.controls.length === 0 ? <li>Aucun contrôle TVA actif.</li> : null}
          </ul>
          <div className="row-actions">
            <Link className="btn" to="/tva/revue">Ouvrir la revue TVA</Link>
            <Form method="post" action="/api/vat/declarations/generate">
              <input type="hidden" name="type" value={declarationType} />
              <input type="hidden" name="dateFrom" value={query.dateFrom ?? position.periodStart} />
              <input type="hidden" name="dateTo" value={query.dateTo ?? position.periodEnd} />
              <button className="btn btn-p" type="submit" disabled={review.status === "not_applicable" || review.status === "blocked"}>{hasActiveDeclaration ? `Régénérer ${declarationType}` : `Générer ${declarationType}`}</button>
            </Form>
          </div>
        </section>

        <div className="grid two">
          <section className="panel">
            <h2>Par taux</h2>
            <VatBucketTable rows={position.byRate} />
          </section>
          <section className="panel">
            <h2>Par nature</h2>
            <VatBucketTable rows={position.byNature} />
          </section>
        </div>

        <section className="panel">
          <h2>Comptes TVA</h2>
          <table className="tbl">
            <thead><tr><th>Compte</th><th>Libellé</th><th>Débit</th><th>Crédit</th><th>Solde</th></tr></thead>
            <tbody>
              {position.accounts.map((account) => <tr key={account.account}><td className="cpt">{account.account}</td><td>{account.label}</td><td>{formatEuro(account.debit)}</td><td>{formatEuro(account.credit)}</td><td>{formatEuro(account.balance)}</td></tr>)}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Déclarations brouillon</h2>
          <table className="tbl">
            <thead><tr><th>Type</th><th>Période</th><th>Statut</th><th>Fraîcheur</th><th>Net</th><th></th></tr></thead>
            <tbody>
              {declarations.map((declaration) => (
                <tr key={declaration.id}>
                  <td>{declaration.type}</td>
                  <td>{declaration.periodStart} → {declaration.periodEnd}</td>
                  <td>{declaration.status}</td>
                  <td>{declaration.freshness?.statusLabel ?? (declaration.active ? "Active" : "Superseded")}</td>
                  <td>{formatEuro(Number((declaration.amounts as { net?: number }).net ?? 0))}</td>
                  <td><Link className="btn btn-sm" to={`/tva/${declaration.id}`}>Ouvrir</Link></td>
                </tr>
              ))}
              {declarations.length === 0 ? <tr><td colSpan={6} className="sub">Aucune déclaration TVA générée.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </Main>
    </AppShell>
  );
}

function VatBucketTable({ rows }: { rows: Array<{ key: string; baseHt: number; deductible: number; collected: number; reverseChargeDue: number; net: number }> }) {
  return (
    <table className="tbl">
      <thead><tr><th>Clé</th><th>Base HT</th><th>Déductible</th><th>Collectée</th><th>Net</th></tr></thead>
      <tbody>
        {rows.map((row) => <tr key={row.key}><td>{row.key}</td><td>{formatEuro(row.baseHt)}</td><td>{formatEuro(row.deductible)}</td><td>{formatEuro(row.collected + row.reverseChargeDue)}</td><td>{formatEuro(row.net)}</td></tr>)}
        {rows.length === 0 ? <tr><td colSpan={5} className="sub">Aucune ligne TVA sur la période.</td></tr> : null}
      </tbody>
    </table>
  );
}

function statusLabel(status: string) {
  if (status === "not_applicable") return "Non applicable";
  if (status === "blocked") return "Bloquée";
  if (status === "ready_with_warnings") return "Générable avec alertes";
  return "Prête";
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
