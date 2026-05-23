import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { CorrectionRuleImpactCenter } from "~/modules/correction-rules/correction-rule-impact-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const impact = await new CorrectionRuleImpactCenter().previewRuleImpact(workspace, String(args.params.id));
  return json({ impact });
}

export default function CorrectionRuleDetail() {
  const { impact } = useLoaderData<typeof loader>();
  const rule = impact.rule;

  return (
    <AppShell active="corrections">
      <Main title="Règle" subtitle={rule ? rule.counterparty : "Impact"} backLink={{ label: "Règles", href: "/corrections" }}>

        {rule ? (
          <>
            <div className="kpi-grid">
              <div className="kpi"><div className="kpi-label">Statut</div><span className="kpi-val">{rule.active ? "Active" : "Inactive"}</span></div>
              <div className="kpi"><div className="kpi-label">Compte</div><span className="kpi-val">{rule.preferredAccount}</span></div>
              <div className="kpi"><div className="kpi-label">Impact</div><span className="kpi-val">{impact.count}</span></div>
              <div className="kpi"><div className="kpi-label">Santé</div><span className="kpi-val">{healthLabel(impact.health)}</span></div>
            </div>

            {impact.warnings.map((warning) => <div key={warning} className="alert orange">{warning}</div>)}

            <div className="card">
              <h2>{rule.counterparty}</h2>
              <p className="sub">{rule.condition ?? "Aucune condition complémentaire"} · {rule.note ?? "Sans note"}</p>
              <div className="row-actions">
                <Form method="post" action={`/api/correction-rules/${rule.id}`}>
                  <input type="hidden" name="intent" value={rule.active ? "disable" : "enable"} />
                  <input type="hidden" name="redirectTo" value={`/corrections/${rule.id}`} />
                  <button className="btn btn-sm" type="submit">{rule.active ? "Désactiver" : "Réactiver"}</button>
                </Form>
              </div>
            </div>
          </>
        ) : null}

        {impact.conflicts.length > 0 ? (
          <>
            <div className="sec-head"><h2>Conflits potentiels</h2></div>
            <table className="tbl">
              <thead><tr><th>Contrepartie</th><th>Compte</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {impact.conflicts.map((conflict) => (
                  <tr key={conflict.id}>
                    <td>{conflict.counterparty}</td>
                    <td><span className="cpt">{conflict.preferredAccount}</span></td>
                    <td>{conflict.active ? "Active" : "Inactive"}</td>
                    <td><Link className="btn btn-sm" to={`/corrections/${conflict.id}`}>Voir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        <div className="sec-head"><h2>Transactions exemples</h2></div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Libellé</th><th className="r">Montant</th><th></th></tr></thead>
          <tbody>
            {impact.transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td className="mono">{formatShortDate(transaction.date)}</td>
                <td>{transaction.label}</td>
                <td className="r mono">{formatEuro(transaction.amount)}</td>
                <td><Link className="btn btn-sm" to={`/transactions/${transaction.id}`}>Transaction</Link></td>
              </tr>
            ))}
            {impact.transactions.length === 0 ? <tr><td colSpan={4} className="sub">Aucune transaction ne matche cette règle.</td></tr> : null}
          </tbody>
        </table>
      </Main>
    </AppShell>
  );
}

function healthLabel(health: string) {
  if (health === "conflict") return "Conflit";
  if (health === "broad") return "À surveiller";
  return "OK";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function formatEuro(value: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}
