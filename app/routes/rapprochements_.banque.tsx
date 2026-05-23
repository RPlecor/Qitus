import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { BankLineReconciliationCenter } from "~/modules/reconciliations/bank-line-reconciliation-center.server";
import { ReconciliationFreshnessCenter } from "~/modules/reconciliations/reconciliation-freshness-center.server";
import { reconciliationEntityTypeLabel, reconciliationMatchStatusLabel, reconciliationRunStatusLabel } from "~/modules/reconciliations/reconciliation-labels";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const [reconciliation, freshness] = await Promise.all([
    new BankLineReconciliationCenter().getBankReconciliation(workspace),
    new ReconciliationFreshnessCenter().getRunFreshness(workspace, "BANK"),
  ]);
  return json({ reconciliation, freshness });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const center = new BankLineReconciliationCenter();
  try {
    await assertFiscalYearMutable(workspace);
    if (form.get("intent") === "run") {
      await center.runBankMatching(workspace);
      await new ActivityLogCenter().recordActivity(workspace, { action: "reconciliation.bank_run", entityType: "reconciliation", metadata: { kind: "BANK" } });
    }
    if (form.get("intent") === "balance") {
      await center.saveStatementBalances(workspace, {
        statementBalance: String(form.get("statementBalance") ?? "0"),
        statementDate: String(form.get("statementDate") || workspace.fiscalYear.endDate.toISOString().slice(0, 10)),
        confirm: form.get("confirm") === "on",
      });
      await new ActivityLogCenter().recordActivity(workspace, { action: "reconciliation.bank_balance_saved", entityType: "reconciliation", metadata: { confirm: form.get("confirm") === "on" } });
    }
    return redirect("/rapprochements/banque");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/rapprochements/banque");
  }
}

export default function RapprochementBanque() {
  const { reconciliation, freshness } = useLoaderData<typeof loader>();
  return (
    <AppShell active="rapprochements">
      <Main title="Rapprochement bancaire" subtitle={`${reconciliation.summary.progress}% traité`}>
        <div className={`alert ${freshness.status === "stale" ? "orange" : "blue"}`}><strong>{freshness.label}</strong><span>{freshness.staleReasons[0] ?? "Rapprochement bancaire exploitable."}</span></div>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Statut ligne à ligne</div><span className="kpi-val">{reconciliationRunStatusLabel(reconciliation.summary.status)}</span></div>
          <div className="kpi"><div className="kpi-label">Matchés</div><span className="kpi-val">{reconciliation.summary.matched}</span></div>
          <div className="kpi"><div className="kpi-label">Issues ouvertes</div><span className="kpi-val">{reconciliation.summary.openIssues}</span></div>
          <div className="kpi"><div className="kpi-label">Solde relevé</div><span className="kpi-val">{formatEuro(reconciliation.balance.statementBalance)}</span></div>
        </div>
        <div className="card">
          <Form method="post" className="form-row">
            <input type="hidden" name="intent" value="run" />
            <button className="btn btn-p" type="submit">Lancer le rapprochement bancaire</button>
          </Form>
          <Form method="post" className="form-row">
            <input type="hidden" name="intent" value="balance" />
            <div className="field"><label>Solde relevé</label><input name="statementBalance" defaultValue={String(reconciliation.balance.statementBalance ?? reconciliation.balance.ledgerBalance)} /></div>
            <div className="field"><label>Date relevé</label><input type="date" name="statementDate" defaultValue={reconciliation.balance.statementDate} /></div>
            <label className="check"><input type="checkbox" name="confirm" /> Confirmer si aucun écart</label>
            <button className="btn" type="submit">Enregistrer</button>
          </Form>
        </div>
        <table className="tbl">
          <thead><tr><th>Gauche</th><th>Droite</th><th>Statut</th><th>Écart</th><th>Note</th><th>Action</th></tr></thead>
          <tbody>
            {reconciliation.matches.map((match) => (
              <tr key={match.id}>
                <td>{reconciliationEntityTypeLabel(match.leftEntityType)} <span className="mono">{short(match.leftEntityId)}</span></td>
                <td>{match.rightEntityType ? reconciliationEntityTypeLabel(match.rightEntityType) : "—"} {match.rightEntityId ? <span className="mono">{short(match.rightEntityId)}</span> : null}</td>
                <td>{reconciliationMatchStatusLabel(match.status)}</td>
                <td>{formatEuro(Number(match.amountDifference))}</td>
                <td>{match.note}</td>
                <td><MatchActions matchId={match.id} /></td>
              </tr>
            ))}
            {reconciliation.matches.length === 0 ? <tr><td colSpan={6} className="sub">Aucun rapprochement lancé.</td></tr> : null}
          </tbody>
        </table>
      </Main>
    </AppShell>
  );
}

function MatchActions({ matchId }: { matchId: string }) {
  return (
    <div className="row-actions">
      <Form method="post" action={`/api/reconciliations/bank/matches/${matchId}/confirm`}>
        <button className="btn" type="submit">Confirmer</button>
      </Form>
      <Form method="post" action={`/api/reconciliations/bank/matches/${matchId}/ignore`}>
        <input type="hidden" name="note" value="Ignoré depuis l'écran banque" />
        <button className="btn" type="submit">Ignorer</button>
      </Form>
    </div>
  );
}

function short(value: string) {
  return value.slice(0, 8);
}

function formatEuro(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
