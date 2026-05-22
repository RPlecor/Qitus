import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { AccountingIssueTracker } from "~/modules/accounting-issues/accounting-issue-tracker.server";
import { AccountingReviewCenter, type AccountingControl } from "~/modules/accounting-review/accounting-review-center.server";
import { ClosingAdjustmentCenter, type ClosingAdjustmentSummary } from "~/modules/closing-adjustments/closing-adjustment-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DocumentFreshnessCenter } from "~/modules/documents/document-freshness-center.server";
import { EvidenceControlCenter } from "~/modules/evidence/evidence-control-center.server";
import { AppShell, ButtonLink, KpiCard, Main, StatusPill, TableShell } from "~/components/ui";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const review = await new AccountingReviewCenter().getReview(workspace);
  const tracker = new AccountingIssueTracker();
  const closingAdjustments = new ClosingAdjustmentCenter();
  const issueState = await tracker.summarizeIssueState(workspace);
  const issues = await tracker.listIssues(workspace);
  const proposals = await closingAdjustments.listProposals(workspace);
  const adjustmentState = await closingAdjustments.summarizeClosingAdjustments(workspace);
  const documentFreshness = await new DocumentFreshnessCenter().getFreshness(workspace);
  const evidenceReview = await new EvidenceControlCenter().getEvidenceReview(workspace);
  await new ActivityLogCenter().recordActivity(workspace, {
    action: "accounting_review.viewed",
    entityType: "accounting_review",
    entityId: workspace.fiscalYear.id,
    metadata: { status: review.status, blockingCount: review.blockingCount, warningCount: review.warningCount, openIssues: issueState.open, draftAdjustments: adjustmentState.draft },
  });
  return json({ review, issueState, handledIssues: issues.filter((issue) => issue.status !== "OPEN").slice(0, 8), proposals, adjustmentState, documentFreshness, evidenceReview });
}

export default function Controle() {
  const { review, issueState, handledIssues, proposals, adjustmentState, documentFreshness, evidenceReview } = useLoaderData<typeof loader>();
  const blocking = review.controls.filter((control) => control.severity === "blocking");
  const warnings = review.controls.filter((control) => control.severity === "warning");

  return (
    <AppShell active="controle">
      <Main
        title="Contrôle"
        subtitle="Pré-clôture MVP"
        action={<ButtonLink to="/documents" primary={review.blockingCount === 0}>Documents</ButtonLink>}
      >
        <div className={`alert ${review.blockingCount > 0 ? "red" : review.warningCount > 0 ? "orange" : "blue"}`}>
          {statusLabel(review.status)}
        </div>

        <div className="kpi-grid">
          <KpiCard label="Statut" value={shortStatusLabel(review.status)} hint="Pré-clôture" />
          <KpiCard label="Blocages" value={String(review.blockingCount)} hint="À résoudre avant génération" />
          <KpiCard label="Ouverts" value={String(issueState.open)} hint="Issues suivables" />
          <KpiCard label="OD proposées" value={String(adjustmentState.draft)} hint={`${adjustmentState.approved} validée${adjustmentState.approved > 1 ? "s" : ""}`} />
          <KpiCard label="Documents" value={documentFreshness.staleCount > 0 ? "À régénérer" : "À jour"} hint={`${documentFreshness.staleCount} obsolète${documentFreshness.staleCount > 1 ? "s" : ""}`} />
          <KpiCard label="Pièces" value={evidenceReview.requiredMissing > 0 ? "Manquantes" : "OK"} hint={`${evidenceReview.requiredMissing} requise(s), ${evidenceReview.orphanAttachments} orpheline(s)`} />
        </div>

        <ControlSection title="Blocages" empty="Aucun blocage comptable." controls={blocking} />
        <EvidenceSection review={evidenceReview} />
        <ProposalSection proposals={proposals} />
        <DocumentFreshnessSection freshness={documentFreshness} />
        <ControlSection title="Points à revoir" empty="Aucun avertissement de pré-clôture." controls={warnings} />
        <HandledIssues issues={handledIssues} />
      </Main>
    </AppShell>
  );
}

function EvidenceSection({ review }: { review: { requiredMissing: number; recommendedMissing: number; orphanAttachments: number; extractionFailures: number } }) {
  return (
    <>
      <div className="sec-head"><h2>Justificatifs</h2></div>
      <div className={`alert ${review.requiredMissing > 0 ? "orange" : "blue"}`}>
        <strong>{review.requiredMissing > 0 ? "Écritures sans pièce" : "Pièces requises couvertes"}</strong>
        <span>{review.requiredMissing} requise(s) manquante(s) · {review.orphanAttachments} pièce(s) sans écriture · {review.extractionFailures} OCR à revoir</span>
        <Link className="btn btn-sm" to="/pieces">Pièces</Link>
      </div>
    </>
  );
}

function ProposalSection({ proposals }: { proposals: ClosingAdjustmentSummary[] }) {
  const visible = proposals;
  return (
    <>
      <div className="sec-head"><h2>OD proposées</h2></div>
      <TableShell>
      <table className="tbl">
        <thead><tr><th>Statut</th><th>Type</th><th>Libellé</th><th>Recalcul</th><th className="r">Montant</th><th></th></tr></thead>
        <tbody>
          {visible.map((proposal) => (
            <tr key={proposal.proposalKey}>
              <td><StatusPill label={proposalStatusLabel(proposal.status)} tone={proposal.status === "APPROVED" ? "ok" : proposal.status === "REJECTED" ? "error" : "warn"} /></td>
              <td>{kindLabel(proposal.kind)}</td>
              <td>{proposal.label}</td>
              <td>{proposal.staleReason ? "À recalculer" : `v${proposal.calculationVersion}`}</td>
              <td className="r mono">{formatEuro(String(proposal.lines.reduce((total, line) => total + line.debit, 0)))}</td>
              <td><Link className="btn btn-sm" to={`/controle/od/${encodeURIComponent(proposal.proposalKey)}`}>Voir</Link></td>
            </tr>
          ))}
          {visible.length === 0 ? <tr><td colSpan={6} className="sub">Aucune OD déterministe proposée pour le moment.</td></tr> : null}
        </tbody>
      </table>
      </TableShell>
    </>
  );
}

function DocumentFreshnessSection({ freshness }: { freshness: { staleCount: number; documents: Array<{ documentId: string; filename: string; statusLabel: string; reasons: Array<{ label: string }> }> } }) {
  if (freshness.documents.length === 0) return null;
  return (
    <>
      <div className="sec-head"><h2>Documents</h2></div>
      <TableShell>
      <table className="tbl">
        <thead><tr><th>Fichier</th><th>État</th><th>Raison</th><th></th></tr></thead>
        <tbody>
          {freshness.documents.map((document) => (
            <tr key={document.documentId}>
              <td>{document.filename}</td>
              <td>{document.statusLabel}</td>
              <td className="sub">{document.reasons[0]?.label ?? "Dernières écritures déjà incluses"}</td>
              <td><Link className="btn btn-sm" to="/documents">Documents</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableShell>
    </>
  );
}

function ControlSection({ title, empty, controls }: { title: string; empty: string; controls: AccountingControl[] }) {
  return (
    <>
      <div className="sec-head"><h2>{title}</h2></div>
      <div className="control-list">
        {controls.map((control) => (
          <div key={control.code} className={`card control-card ${control.severity}`}>
            <div>
              <div className="control-title">
                <StatusPill label={control.severity === "blocking" ? "Bloquant" : "Avertissement"} tone={control.severity === "blocking" ? "error" : "warn"} />
                <strong>{control.title}</strong>
              </div>
              <p className="sub">{control.detail}</p>
              {control.evidence.length > 0 ? (
                <ul className="evidence-list">
                  {control.evidence.map((item, index) => (
                    <li key={`${control.code}-${index}`}>
                      <span>{item.label ?? "Élément à revoir"}</span>
                      {item.account ? <span className="cpt">{item.account}</span> : null}
                      {item.amount ? <span className="mono">{formatEuro(item.amount)}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <Link className="btn btn-sm" to={control.action.href}>
              {control.openIssueCount > 0 ? `${control.action.label} (${control.openIssueCount})` : control.action.label}
            </Link>
          </div>
        ))}
        {controls.length === 0 ? <div className="card"><span className="sub">{empty}</span></div> : null}
      </div>
    </>
  );
}

function HandledIssues({ issues }: { issues: Array<{ issueKey: string; controlCode: string; controlTitle: string; status: string; note: string | null; evidence: { label?: string } }> }) {
  if (issues.length === 0) return null;
  return (
    <>
      <div className="sec-head"><h2>Déjà traités</h2></div>
      <TableShell>
      <table className="tbl">
        <thead><tr><th>Statut</th><th>Contrôle</th><th>Élément</th><th>Note</th><th></th></tr></thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.issueKey}>
              <td><StatusPill label={issue.status === "RESOLVED" ? "Résolu" : "Ignoré"} tone={issue.status === "RESOLVED" ? "ok" : "neutral"} /></td>
              <td>{issue.controlTitle}</td>
              <td>{issue.evidence.label ?? issue.issueKey}</td>
              <td className="sub">{issue.note ?? "—"}</td>
              <td><Link className="btn btn-sm" to={`/controle/${issue.controlCode}`}>Voir</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableShell>
    </>
  );
}

function statusLabel(status: string) {
  if (status === "blocked") return "Pré-clôture bloquée : corrige les éléments bloquants avant de générer les documents.";
  if (status === "ready_with_warnings") return "Documents générables : des points de pré-clôture restent à revoir.";
  return "Exercice prêt : aucun point bloquant ou avertissement détecté.";
}

function shortStatusLabel(status: string) {
  if (status === "blocked") return "Bloqué";
  if (status === "ready_with_warnings") return "À revoir";
  return "Prêt";
}

function kindLabel(kind: string) {
  if (kind === "CCA") return "CCA";
  if (kind === "DEPRECIATION") return "Amortissement";
  if (kind === "CORPORATE_TAX") return "IS";
  return kind;
}

function proposalStatusLabel(status: string) {
  if (status === "APPROVED") return "Validée";
  if (status === "REJECTED") return "Rejetée";
  return "À valider";
}

function formatEuro(value: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}
