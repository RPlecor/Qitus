import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import type { ClosingAdjustmentReview } from "~/modules/closing-adjustments/closing-adjustment-review-workflow.server";
import { ClosingAdjustmentReviewWorkflow } from "~/modules/closing-adjustments/closing-adjustment-review-workflow.server";
import { ClosingWorkpaperCenter } from "~/modules/closing-workpapers/closing-workpaper-center.server";
import { ClosingWorkpaperWorkflow } from "~/modules/closing-workpapers/closing-workpaper-workflow.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AppShell, KpiCard, Main, StatusPill, TableShell, type StatusTone } from "~/components/ui";
import { closingAdjustmentKindLabel, closingAdjustmentStatusLabel, workpaperStatusLabel } from "~/modules/ui-labels";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const tab = url.searchParams.get("tab") || "workpapers";
  const workpaperWorkflow = new ClosingWorkpaperWorkflow();
  const adjustmentWorkflow = new ClosingAdjustmentReviewWorkflow();
  const [workpaperSummary, adjustmentSummary, workpaperReviews, adjustmentReviews, kinds] = await Promise.all([
    workpaperWorkflow.summarizeWorkpaperReadiness(workspace),
    adjustmentWorkflow.summarizeAdjustmentReadiness(workspace),
    workpaperWorkflow.getReviewQueue(workspace),
    adjustmentWorkflow.getReviewQueue(workspace),
    new ClosingWorkpaperCenter().getAvailableKinds(),
  ]);
  return json({ tab, workpaperSummary, adjustmentSummary, workpaperReviews, adjustmentReviews, kinds });
}

export default function ClosingAdjustmentsCockpit() {
  const { tab, workpaperSummary, adjustmentSummary, workpaperReviews, adjustmentReviews, kinds } = useLoaderData<typeof loader>();
  const groupedWorkpapers = kinds.map((kind) => ({
    ...kind,
    workpapers: workpaperReviews.filter((review) => review.workpaper.kind === kind.kind),
    proposals: adjustmentReviews.filter((review) => review.proposal.kind === kind.kind),
  }));
  const activeAdjustments = adjustmentReviews.filter((review) => review.proposal.status === "DRAFT");
  const approved = adjustmentReviews.filter((review) => review.proposal.status === "APPROVED");
  const rejected = adjustmentReviews.filter((review) => review.proposal.status === "REJECTED");
  const missingEvidence = adjustmentReviews.filter((review) => review.evidence.missing);
  return (
    <AppShell active="cloture">
      <Main
        title="OD de clôture"
        subtitle="Feuilles de travail et propositions validables"
        action={
          <div className="form-actions">
            <Form method="post" action="/api/closing-adjustments/generate"><button className="btn btn-p" type="submit">Générer / mettre à jour</button></Form>
            <Form method="post" action="/api/closing-adjustments/recalculate-stale"><button className="btn" type="submit">Recalculer les OD à mettre à jour</button></Form>
          </div>
        }
      >
        <div className="kpi-grid">
          <KpiCard label="Feuilles de travail" value={String(workpaperSummary.total)} hint={`${workpaperSummary.ready} prêtes · ${workpaperSummary.draft} brouillons`} />
          <KpiCard label="OD à relire" value={String(adjustmentSummary.draft)} hint={`${adjustmentSummary.ready} validables · ${adjustmentSummary.stale} à recalculer`} />
          <KpiCard label="OD validées" value={String(adjustmentSummary.approved)} hint="Écritures créées" />
          <KpiCard label="Pièces manquantes" value={String(adjustmentSummary.evidenceMissing)} hint="Validation bloquée" />
        </div>

        <div className="alert blue">
          <strong>Aucune OD automatique.</strong>
          <span>Les feuilles de travail portent les hypothèses ; les propositions portent les lignes ; seule la validation utilisateur crée une écriture OD.</span>
        </div>

        <div className="segmented" role="tablist" aria-label="Vues des OD de clôture">
          <Link role="tab" aria-selected={tab === "workpapers"} className={`seg ${tab === "workpapers" ? "active" : ""}`} to="/cloture/od?tab=workpapers">Feuilles de travail</Link>
          <Link role="tab" aria-selected={tab === "review"} className={`seg ${tab === "review" ? "active" : ""}`} to="/cloture/od?tab=review">OD à relire</Link>
          <Link role="tab" aria-selected={tab === "approved"} className={`seg ${tab === "approved" ? "active" : ""}`} to="/cloture/od?tab=approved">Validées</Link>
          <Link role="tab" aria-selected={tab === "rejected"} className={`seg ${tab === "rejected" ? "active" : ""}`} to="/cloture/od?tab=rejected">Rejetées</Link>
          <Link role="tab" aria-selected={tab === "evidence"} className={`seg ${tab === "evidence" ? "active" : ""}`} to="/cloture/od?tab=evidence">Pièces manquantes</Link>
        </div>

        {tab === "workpapers" ? (
          <>
            <div className="sec-head"><h2>Domaines de clôture</h2></div>
            <div className="grid cards-grid">
              {groupedWorkpapers.map((kind) => (
                <div className="card" key={kind.kind}>
                  <div className="card-head">
                    <div><strong>{kind.title}</strong><div className="sub">{kind.description}</div></div>
                    <Link className="btn btn-sm" to={`/cloture/workpapers/${kind.kind}`}>Feuilles de travail</Link>
                  </div>
                  <div className="sub">{kind.workpapers.length} feuille(s) de travail · {kind.proposals.length} OD</div>
                  {kind.workpapers.length > 0 ? (
                    <TableShell>
                      <table className="tbl compact">
                        <tbody>
                          {kind.workpapers.slice(0, 3).map((review) => (
                            <tr key={review.workpaper.workpaperKey}>
                              <td>{review.workpaper.title}</td>
                              <td><StatusPill label={workpaperStatusLabel(review.workpaper.status)} tone={statusTone(review.workpaper.status)} /></td>
                              <td>{review.hasProposal ? "OD générée" : "Sans OD"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableShell>
                  ) : <p className="sub">Aucune feuille de travail pour ce domaine.</p>}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {tab === "review" ? <AdjustmentTable reviews={activeAdjustments} empty="Aucune OD à relire." /> : null}
        {tab === "approved" ? <AdjustmentTable reviews={approved} empty="Aucune OD validée." /> : null}
        {tab === "rejected" ? <AdjustmentTable reviews={rejected} empty="Aucune OD rejetée." /> : null}
        {tab === "evidence" ? <AdjustmentTable reviews={missingEvidence} empty="Aucune pièce requise manquante." /> : null}
      </Main>
    </AppShell>
  );
}

function AdjustmentTable({ reviews, empty }: { reviews: ClosingAdjustmentReview[]; empty: string }) {
  return (
    <>
      <div className="sec-head"><h2>Propositions OD</h2></div>
      <TableShell>
        <table className="tbl">
          <thead><tr><th>Libellé</th><th>Type</th><th>Statut</th><th>Fraîcheur</th><th>Preuve</th><th>Action</th></tr></thead>
          <tbody>
            {reviews.map((review) => (
              <tr key={review.proposal.proposalKey}>
                <td><strong>{review.proposal.label}</strong><div className="sub mono wrap-anywhere">{review.proposal.proposalKey}</div></td>
                <td>{closingAdjustmentKindLabel(review.proposal.kind)}</td>
                <td><StatusPill label={closingAdjustmentStatusLabel(review.proposal.status)} tone={statusTone(review.proposal.status)} /></td>
                <td>{review.freshness.statusLabel}</td>
                <td>{review.evidence.missing ? "Pièce requise" : review.evidence.required ? "OK" : "Recommandée"}</td>
                <td><Link className="btn btn-sm" to={`/controle/od/${encodeURIComponent(review.proposal.proposalKey)}`}>Relire</Link></td>
              </tr>
            ))}
            {reviews.length === 0 ? <tr><td colSpan={6} className="sub">{empty}</td></tr> : null}
          </tbody>
        </table>
      </TableShell>
    </>
  );
}

function statusTone(value: string): StatusTone {
  if (["APPROVED", "READY", "DONE"].includes(value)) return "ok";
  if (["REJECTED", "ARCHIVED"].includes(value)) return "neutral";
  if (["BLOCKED", "ERROR"].includes(value)) return "error";
  return "warn";
}
