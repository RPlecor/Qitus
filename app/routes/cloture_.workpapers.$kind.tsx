import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { ClosingWorkpaperCenter } from "~/modules/closing-workpapers/closing-workpaper-center.server";
import { ClosingWorkpaperWorkflow } from "~/modules/closing-workpapers/closing-workpaper-workflow.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AppShell, Main } from "~/components/ui";
import { workpaperStatusLabel } from "~/modules/ui-labels";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const kind = String(args.params.kind);
  const center = new ClosingWorkpaperCenter();
  const [reviews, kinds] = await Promise.all([
    new ClosingWorkpaperWorkflow().getReviewQueue(workspace, { kind }),
    center.getAvailableKinds(),
  ]);
  const definition = kinds.find((item) => item.kind === kind) ?? { kind, title: kind, description: "Feuilles de travail de clôture.", defaultAmount: 0, defaultDebitAccount: "658", defaultCreditAccount: "471", requiredEvidence: true };
  return json({ kind, definition, reviews });
}

export default function ClosingWorkpapersByKind() {
  const { kind, definition, reviews } = useLoaderData<typeof loader>();
  return (
    <AppShell active="cloture">
      <Main title={`Feuilles de travail — ${definition.title}`} subtitle={definition.description}>
        <Link className="btn btn-ghost" to="/cloture/od">← Retour OD de clôture</Link>

        <div className="card form-card">
          <h2>Nouvelle feuille de travail</h2>
          <Form method="post" action="/api/closing-workpapers" className="form-grid">
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="status" value="READY" />
            <Field name="title" label="Titre" value={definition.title} />
            <Field name="amount" label="Montant" value={definition.defaultAmount} type="number" step="0.01" />
            <Field name="debitAccount" label="Compte débit" value={definition.defaultDebitAccount} />
            <Field name="creditAccount" label="Compte crédit" value={definition.defaultCreditAccount} />
            {kind === "STOCK_VARIATION" ? (
              <>
                <Field name="initialStock" label="Stock initial" value="0" type="number" step="0.01" />
                <Field name="finalStock" label="Stock final" value={definition.defaultAmount} type="number" step="0.01" />
              </>
            ) : null}
            {kind === "LOAN_INTEREST_ACCRUAL" ? (
              <>
                <Field name="capital" label="Capital restant dû" value="25000" type="number" step="0.01" />
                <Field name="annualRate" label="Taux annuel" value="0.045" type="number" step="0.001" />
                <Field name="days" label="Jours courus" value="92" type="number" step="1" />
              </>
            ) : null}
            <div className="field span-2">
              <label>Base de calcul / justification</label>
              <textarea name="basis" defaultValue={definition.description} />
            </div>
            <div className="field">
              <label><input type="checkbox" name="requiredEvidence" defaultChecked={definition.requiredEvidence} /> Pièce requise</label>
            </div>
            <div className="form-actions span-2">
              <button className="btn btn-p" type="submit">Enregistrer</button>
            </div>
          </Form>
        </div>

        <div className="sec-head"><h2>Feuilles de travail existantes</h2></div>
        {reviews.map((review) => (
          <div className="card form-card" key={review.workpaper.workpaperKey}>
            <div className="card-head">
              <div>
                <strong>{review.workpaper.title}</strong>
                <div className="sub mono">{review.workpaper.workpaperKey}</div>
              </div>
              <div className="sub">{workpaperStatusLabel(review.workpaper.status)} · {review.hasProposal ? "OD générée" : "Sans OD"}</div>
            </div>
            <Form method="post" action={`/api/closing-workpapers/${encodeURIComponent(review.workpaper.workpaperKey)}`} className="form-grid">
              <input type="hidden" name="kind" value={review.workpaper.kind} />
              <input type="hidden" name="status" value={review.workpaper.status} />
              <Field name="title" label="Titre" value={review.workpaper.title} />
              <Field name="amount" label="Montant" value={review.workpaper.assumptions.amount ?? review.workpaper.calculation.amount ?? 0} type="number" step="0.01" />
              <Field name="debitAccount" label="Compte débit" value={review.workpaper.assumptions.debitAccount ?? definition.defaultDebitAccount} />
              <Field name="creditAccount" label="Compte crédit" value={review.workpaper.assumptions.creditAccount ?? definition.defaultCreditAccount} />
              {kind === "STOCK_VARIATION" ? (
                <>
                  <Field name="initialStock" label="Stock initial" value={review.workpaper.assumptions.initialStock ?? "0"} type="number" step="0.01" />
                  <Field name="finalStock" label="Stock final" value={review.workpaper.assumptions.finalStock ?? review.workpaper.assumptions.amount ?? "0"} type="number" step="0.01" />
                </>
              ) : null}
              {kind === "LOAN_INTEREST_ACCRUAL" ? (
                <>
                  <Field name="capital" label="Capital restant dû" value={review.workpaper.assumptions.capital ?? "25000"} type="number" step="0.01" />
                  <Field name="annualRate" label="Taux annuel" value={review.workpaper.assumptions.annualRate ?? "0.045"} type="number" step="0.001" />
                  <Field name="days" label="Jours courus" value={review.workpaper.assumptions.days ?? "92"} type="number" step="1" />
                </>
              ) : null}
              <div className="field span-2">
                <label>Base de calcul / justification</label>
                <textarea name="basis" defaultValue={String(review.workpaper.assumptions.basis ?? definition.description)} />
              </div>
              <div className="field">
                <label><input type="checkbox" name="requiredEvidence" defaultChecked={Boolean(review.workpaper.assumptions.requiredEvidence ?? definition.requiredEvidence)} /> Pièce requise</label>
              </div>
              <div className="form-actions span-2">
                <button className="btn" type="submit">Enregistrer</button>
                {review.workpaper.status === "DRAFT" ? (
                  <button className="btn btn-p" type="submit" formAction={`/api/closing-workpapers/${encodeURIComponent(review.workpaper.workpaperKey)}/mark-ready`}>Marquer prêt</button>
                ) : (
                  <span className="inline-form">
                    <input type="hidden" name="reason" value="Retour en brouillon depuis la revue" />
                    <button className="btn" type="submit" formAction={`/api/closing-workpapers/${encodeURIComponent(review.workpaper.workpaperKey)}/mark-draft`}>Remettre brouillon</button>
                  </span>
                )}
                {review.proposal ? <Link className="btn" to={`/controle/od/${encodeURIComponent(review.proposal.proposal.proposalKey)}`}>Relire l'OD</Link> : null}
                <button className="btn" type="submit" formAction={`/api/closing-workpapers/${encodeURIComponent(review.workpaper.workpaperKey)}/archive`}>Archiver</button>
              </div>
            </Form>
            {review.predictedDraft ? (
              <div className="sub">
                Aperçu : {review.predictedDraft.lines.map((line) => `${line.account} ${line.debit ? "D" : "C"} ${formatEuro(line.debit || line.credit)}`).join(" · ")}
              </div>
            ) : null}
          </div>
        ))}
        {reviews.length === 0 ? <div className="card sub">Aucune feuille de travail pour ce domaine.</div> : null}
      </Main>
    </AppShell>
  );
}

function Field({ name, label, value, type = "text", step }: { name: string; label: string; value: unknown; type?: string; step?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input name={name} type={type} step={step} defaultValue={String(value ?? "")} />
    </div>
  );
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}
