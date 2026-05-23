import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AccountingIssueTracker } from "~/modules/accounting-issues/accounting-issue-tracker.server";
import { AccountingReviewCenter } from "~/modules/accounting-review/accounting-review-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AppShell, Main } from "~/components/ui";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const code = String(args.params.code);
  const [controls, issues] = await Promise.all([
    new AccountingReviewCenter().listDetectedControls(workspace),
    new AccountingIssueTracker().listIssues(workspace),
  ]);
  const control = controls.find((candidate) => candidate.code === code);
  return json({
    code,
    control,
    issues: issues.filter((issue) => issue.controlCode === code),
  });
}

export default function ControleDetail() {
  const { code, control, issues } = useLoaderData<typeof loader>();

  return (
    <AppShell active="controle">
      <Main title="Contrôle" subtitle={control?.title ?? code}>
        <Link className="btn btn-ghost" to="/controle">← Retour au contrôle</Link>
        {control ? (
          <div className={`alert ${control.severity === "blocking" ? "red" : "orange"}`}>{control.detail}</div>
        ) : (
          <div className="alert red">Contrôle introuvable.</div>
        )}
        <div className="control-list">
          {issues.map((issue) => (
            <div key={issue.issueKey} className={`card control-card ${issue.status === "OPEN" ? "warning" : ""}`}>
              <div className="issue-main">
                <div className="control-title">
                  <span className={issue.status === "OPEN" ? "st-warn" : "st-ok"}>{statusLabel(issue.status)}</span>
                  <strong>{issue.evidence.label ?? issue.issueKey}</strong>
                </div>
                <p className="sub">
                  {issue.evidence.date ? `${formatDate(issue.evidence.date)} · ` : null}
                  {issue.evidence.account ? `Compte ${issue.evidence.account} · ` : null}
                  {issue.evidence.amount ? formatEuro(issue.evidence.amount) : null}
                </p>
                <Form method="post" action={`/api/accounting-review/issues/${encodeURIComponent(issue.issueKey)}/status`}>
                  <input type="hidden" name="redirectTo" value={`/controle/${issue.controlCode}`} />
                  <div className="field">
                    <label>Note de suivi</label>
                    <textarea name="note" defaultValue={issue.note ?? ""} rows={3} />
                    <span className="help">Ce suivi ne crée aucune écriture comptable.</span>
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-p" type="submit" name="status" value="RESOLVED">Marquer résolu</button>
                    <button className="btn" type="submit" name="status" value="IGNORED">Ignorer</button>
                    <button className="btn" type="submit" name="status" value="OPEN">Réouvrir</button>
                    {issue.evidence.entityType === "transaction" && issue.evidence.entityId ? (
                      <Link className="btn" to={`/transactions/${issue.evidence.entityId}`}>Voir transaction</Link>
                    ) : null}
                  </div>
                </Form>
              </div>
            </div>
          ))}
          {issues.length === 0 ? (
            <div className="card"><span className="sub">Aucun point de suivi pour ce contrôle.</span></div>
          ) : null}
        </div>
      </Main>
    </AppShell>
  );
}

function statusLabel(status: string) {
  if (status === "RESOLVED") return "Résolu";
  if (status === "IGNORED") return "Ignoré";
  return "À traiter";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function formatEuro(value: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}
