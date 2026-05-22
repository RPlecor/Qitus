import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, KpiCard, Main, StatusPill, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { VatControlCenter } from "~/modules/vat/vat-control-center.server";
import { VatDeclarationCenter } from "~/modules/vat/vat-declaration-center.server";
import { VatLedgerReadinessCenter } from "~/modules/vat/vat-ledger-readiness-center.server";
import { VatPositionCenter } from "~/modules/vat/vat-position-center.server";
import { VatRegularizationCenter } from "~/modules/vat/vat-regularization-center.server";
import { VatReviewWorkflow } from "~/modules/vat/vat-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const filters = { dateFrom: url.searchParams.get("dateFrom"), dateTo: url.searchParams.get("dateTo") };
  const [position, review, declarations, settlement, queue, ledgerReadiness] = await Promise.all([
    new VatPositionCenter().getVatPosition(workspace, filters),
    new VatControlCenter().getVatReview(workspace, filters),
    new VatDeclarationCenter().listDeclarations(workspace),
    new VatRegularizationCenter().summarizeOpenVatBalance(workspace),
    new VatReviewWorkflow().getReviewQueue(workspace, filters),
    new VatLedgerReadinessCenter().getReadiness(workspace),
  ]);
  return json({ position, review, declarations, settlement, queue, ledgerReadiness, query: Object.fromEntries(url.searchParams) });
}

export default function TvaPage() {
  const { position, review, declarations, settlement, queue, ledgerReadiness, query } = useLoaderData<typeof loader>();
  const declarationType = position.regime === "REEL_NORMAL" ? "CA3" : "CA12";
  const hasActiveDeclaration = declarations.some((declaration) => declaration.active);
  const visibleDeclarations = declarations.filter((declaration) => declaration.status !== "SUPERSEDED");
  const hiddenSupersededCount = declarations.length - visibleDeclarations.length;

  return (
    <AppShell active="tva">
      <Main title="TVA" subtitle="Position déclarative et brouillons CA3/CA12">
        {query.success ? <div className="alert blue"><strong>{query.success}</strong></div> : null}
        {query.error ? <div className="alert red"><strong>{query.error}</strong></div> : null}
        {ledgerReadiness.status !== "ok" ? <VatReadinessAlert readiness={ledgerReadiness} /> : null}

        <div className="kpi-grid">
          <KpiCard label="Régime" value={vatRegimeLabel(position.regime)} hint={vatExigibilityLabel(position.exigibility)} />
          <KpiCard label="TVA collectée" value={formatEuro(position.totals.collected)} hint="44571" />
          <KpiCard label="TVA déductible" value={formatEuro(position.totals.deductible)} hint="44566" />
          <KpiCard label="Net" value={formatEuro(position.totals.net)} hint={settlement.label ?? settlement.kind} />
        </div>

        <Form method="get" className="card filter-bar">
          <div className="field"><label>Début</label><input type="date" name="dateFrom" defaultValue={query.dateFrom ?? position.periodStart} /></div>
          <div className="field"><label>Fin</label><input type="date" name="dateTo" defaultValue={query.dateTo ?? position.periodEnd} /></div>
          <button className="btn" type="submit">Filtrer</button>
        </Form>

        <section className="panel">
          <div className="row between">
            <h2>Contrôles TVA</h2>
            <StatusPill label={statusLabel(review.status)} tone={review.status === "blocked" ? "error" : review.status === "ready" ? "ok" : "warn"} />
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
          <TableShell>
          <table className="tbl">
            <thead><tr><th>Compte</th><th>Libellé</th><th>Débit</th><th>Crédit</th><th>Solde</th></tr></thead>
            <tbody>
              {position.accounts.map((account) => <tr key={account.account}><td className="cpt">{account.account}</td><td>{account.label}</td><td className="r mono">{formatEuro(account.debit)}</td><td className="r mono">{formatEuro(account.credit)}</td><td className="r mono">{formatEuro(account.balance)}</td></tr>)}
            </tbody>
          </table>
          </TableShell>
        </section>

        <section className="panel">
          <div className="row between">
            <h2>Déclarations brouillon</h2>
            {hiddenSupersededCount > 0 ? <span className="sub">{hiddenSupersededCount} ancienne{hiddenSupersededCount > 1 ? "s" : ""} version{hiddenSupersededCount > 1 ? "s" : ""} masquée{hiddenSupersededCount > 1 ? "s" : ""}</span> : null}
          </div>
          <TableShell>
          <table className="tbl">
            <thead><tr><th>Type</th><th>Période</th><th>Statut</th><th>Fraîcheur</th><th>Net</th><th></th></tr></thead>
            <tbody>
              {visibleDeclarations.map((declaration) => (
                <tr key={declaration.id}>
                  <td>{declaration.type}</td>
                  <td>{declaration.periodStart} → {declaration.periodEnd}</td>
                  <td>{declaration.status}</td>
                  <td>{declaration.freshness?.statusLabel ?? (declaration.active ? "Active" : "Superseded")}</td>
                  <td>{formatEuro(Number((declaration.amounts as { net?: number }).net ?? 0))}</td>
                  <td><Link className="btn btn-sm" to={`/tva/${declaration.id}`}>Ouvrir</Link></td>
                </tr>
              ))}
              {visibleDeclarations.length === 0 ? <tr><td colSpan={6} className="sub">Aucune déclaration TVA générée.</td></tr> : null}
            </tbody>
          </table>
          </TableShell>
        </section>
      </Main>
    </AppShell>
  );
}

function VatReadinessAlert({ readiness }: { readiness: { status: string; title: string; message: string; actions: Array<{ label: string; href: string; primary?: boolean }> } }) {
  return (
    <div className={`alert ${readiness.status === "action_required" ? "orange" : "blue"}`}>
      <strong>{readiness.title}</strong>
      <span>{readiness.message}</span>
      <div className="row-actions">
        {readiness.actions.map((action) => <Link key={action.href} className={`btn btn-sm ${action.primary ? "btn-p" : ""}`} to={action.href}>{action.label}</Link>)}
      </div>
    </div>
  );
}

function VatBucketTable({ rows }: { rows: Array<{ key: string; baseHt: number; deductible: number; collected: number; reverseChargeDue: number; net: number }> }) {
  return (
    <TableShell>
    <table className="tbl">
      <thead><tr><th>Clé</th><th className="r">Base HT</th><th className="r">Déductible</th><th className="r">Collectée</th><th className="r">Net</th></tr></thead>
      <tbody>
        {rows.map((row) => <tr key={row.key}><td>{row.key}</td><td className="r mono">{formatEuro(row.baseHt)}</td><td className="r mono">{formatEuro(row.deductible)}</td><td className="r mono">{formatEuro(row.collected + row.reverseChargeDue)}</td><td className="r mono">{formatEuro(row.net)}</td></tr>)}
        {rows.length === 0 ? <tr><td colSpan={5} className="sub">Aucune ligne TVA sur la période.</td></tr> : null}
      </tbody>
    </table>
    </TableShell>
  );
}

function statusLabel(status: string) {
  if (status === "not_applicable") return "Non applicable";
  if (status === "blocked") return "Bloquée";
  if (status === "ready_with_warnings") return "Générable avec alertes";
  return "Prête";
}

function vatRegimeLabel(regime: string) {
  if (regime === "FRANCHISE") return "Franchise en base";
  if (regime === "REEL_SIMPLIFIE") return "Régime réel simplifié";
  if (regime === "REEL_NORMAL") return "Régime réel normal";
  return regime;
}

function vatExigibilityLabel(exigibility: string) {
  if (exigibility === "ENCAISSEMENTS") return "Sur encaissements";
  if (exigibility === "DEBITS") return "Sur les débits";
  if (exigibility === "MIXED") return "Mixte";
  return exigibility;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
