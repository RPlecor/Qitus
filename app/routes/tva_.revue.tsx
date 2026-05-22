import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { VAT_NATURE_OPTIONS, VAT_RATE_OPTIONS, vatNatureLabel, vatRateLabel, vatRateToOptionValue } from "~/modules/vat/vat-rate-policy";
import { VatReviewWorkflow } from "~/modules/vat/vat-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const queue = await new VatReviewWorkflow().getReviewQueue(workspace);
  return json({
    queue,
    selectedIssueKey: url.searchParams.get("issue"),
    success: url.searchParams.get("success"),
    error: url.searchParams.get("error"),
  });
}

export default function VatReviewPage() {
  const { queue, selectedIssueKey, success, error } = useLoaderData<typeof loader>();
  const selected = queue.issues.find((issue) => issue.issueKey === selectedIssueKey) ?? queue.issues[0] ?? null;

  return (
    <AppShell active="tva">
      <Main title="Revue TVA" subtitle="Points déclaratifs à traiter avant génération CA3/CA12">
        <div className="row-actions">
          <Link className="btn btn-ghost" to="/tva">← TVA</Link>
        </div>
        {success ? <div className="alert blue"><strong>{success}</strong></div> : null}
        {error ? <div className="alert red"><strong>{error}</strong></div> : null}

        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Points</div><span className="kpi-val">{queue.issues.length}</span></div>
          <div className="kpi"><div className="kpi-label">Bloquants</div><span className="kpi-val">{queue.blockingCount}</span></div>
          <div className="kpi"><div className="kpi-label">Alertes</div><span className="kpi-val">{queue.warningCount}</span></div>
        </div>

        {queue.empty ? <div className="alert blue"><strong>Aucun point TVA à traiter.</strong></div> : null}

        <div className="grid two">
          <section className="panel">
            <h2>File de revue</h2>
            <table className="tbl">
              <thead><tr><th>Point</th><th>Sévérité</th><th>Détail</th><th></th></tr></thead>
              <tbody>
                {queue.issues.map((issue) => (
                  <tr key={issue.issueKey}>
                    <td>{issue.title}</td>
                    <td>{issue.severity === "blocking" ? "Bloquant" : "Alerte"}</td>
                    <td className="sub">{issue.detail}</td>
                    <td><Link className="btn btn-sm" to={`/tva/revue?issue=${encodeURIComponent(issue.issueKey)}`}>Traiter</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h2>Détail</h2>
            {selected ? (
              <>
                <h3>{selected.title}</h3>
                <p className="sub">{selected.detail}</p>
                {selected.transaction ? (
                  <Form method="post" action={`/api/vat/review/issues/${encodeURIComponent(selected.issueKey)}/resolve`} className="card">
                    <p><strong>{selected.transaction.label}</strong></p>
                    <p className="sub">{selected.transaction.date} · {formatEuro(selected.transaction.amount)} · {selected.transaction.ecritureLabel}</p>
                    <div className="form-row">
                      <div className="field">
                        <label>Taux TVA</label>
                        <select name="vatRate" defaultValue={vatRateToOptionValue(selected.transaction.vatRate)}>
                          {VAT_RATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label>Nature TVA</label>
                        <select name="vatOperationNature" defaultValue={selected.transaction.vatOperationNature ?? "auto"}>
                          <option value="auto">Automatique</option>
                          {VAT_NATURE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <p className="sub">Actuel : {vatRateLabel(selected.transaction.vatRate)} · {vatNatureLabel(selected.transaction.vatOperationNature)}</p>
                    <button className="btn btn-p" type="submit">{selected.actionLabel}</button>
                  </Form>
                ) : null}
                {selected.declaration ? (
                  <Form method="post" action={`/api/vat/review/issues/${encodeURIComponent(selected.issueKey)}/resolve`} className="card">
                    <p><strong>{selected.declaration.type}</strong> · {selected.declaration.periodStart} → {selected.declaration.periodEnd}</p>
                    <ul className="evidence-list">
                      {selected.declaration.staleReasons.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                    <button className="btn btn-p" type="submit">Régénérer</button>
                  </Form>
                ) : null}
              </>
            ) : (
              <p className="sub">Sélectionne un point de revue TVA.</p>
            )}
          </section>
        </div>
      </Main>
    </AppShell>
  );
}

function formatEuro(value: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}
