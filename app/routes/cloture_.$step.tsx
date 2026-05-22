import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AnnualClosingCenter } from "~/modules/annual-closing/annual-closing-center.server";
import { BankReconciliationCenter } from "~/modules/reconciliations/bank-reconciliation-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AppShell, Main } from "~/components/ui";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const step = await new AnnualClosingCenter().getStep(workspace, String(args.params.step));
  const reconciliation = step.code === "BANK_RECONCILIATION" ? await new BankReconciliationCenter().getReconciliation(workspace) : null;
  return json({ step, reconciliation });
}

export default function ClosingStepDetail() {
  const { step, reconciliation } = useLoaderData<typeof loader>();
  return (
    <AppShell active="cloture">
      <Main title={step.title} subtitle={`Étape ${step.index}/12`} action={<Link className="btn" to="/cloture">Retour clôture</Link>}>
        <div className={`alert ${step.blockingCount > 0 ? "orange" : "blue"}`}>
          <strong>{stepStatusLabel(step.status)}</strong>
          <span>{step.blockingCount} blocage · {step.warningCount} avertissement</span>
        </div>

        {step.code === "BANK_RECONCILIATION" && reconciliation ? (
          <Form method="post" action={`/api/cloture/steps/${step.code}/run`} className="card form-card">
            <label>Solde du relevé au 31/12
              <input name="statementBalance" defaultValue={String(reconciliation.statementBalance ?? reconciliation.ledgerBalance)} />
            </label>
            <input type="hidden" name="statementDate" value={reconciliation.statementDate} />
            <button className="btn btn-p">Enregistrer et confirmer</button>
          </Form>
        ) : null}

        {step.blockers.length > 0 ? <IssueList title="Blocages" issues={step.blockers} /> : null}
        {step.warnings.length > 0 ? <IssueList title="Avertissements" issues={step.warnings} /> : null}

        <div className="sec-head"><h2>Preuves</h2></div>
        <table className="tbl">
          <tbody>
            {step.evidence.map((item) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                <td>{item.value}</td>
                <td>{item.href ? <Link className="btn btn-sm" to={item.href}>Voir</Link> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="actions-row">
          <Form method="post" action={`/api/cloture/steps/${step.code}/run`}><button className="btn btn-p">Exécuter l'étape</button></Form>
          <Form method="post" action={`/api/cloture/steps/${step.code}/complete`}><button className="btn">Marquer terminé</button></Form>
          <Link className="btn" to={step.action.href}>{step.action.label}</Link>
        </div>
      </Main>
    </AppShell>
  );
}

function IssueList({ title, issues }: { title: string; issues: Array<{ code: string; label: string; detail: string; href: string }> }) {
  return (
    <>
      <div className="sec-head"><h2>{title}</h2></div>
      <div className="control-list">
        {issues.map((issue) => (
          <div key={`${issue.code}-${issue.label}`} className="card control-card warning">
            <div><strong>{issue.label}</strong><p className="sub">{issue.detail}</p></div>
            <Link className="btn btn-sm" to={issue.href}>Traiter</Link>
          </div>
        ))}
      </div>
    </>
  );
}

function stepStatusLabel(status: string) {
  if (status === "DONE") return "Étape terminée";
  if (status === "BLOCKED") return "Étape bloquée";
  if (status === "READY") return "Étape prête";
  return "Étape à traiter";
}
