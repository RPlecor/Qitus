import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { AccountingIssueTracker } from "~/modules/accounting-issues/accounting-issue-tracker.server";
import { AccountingReviewCenter, type AccountingControl } from "~/modules/accounting-review/accounting-review-center.server";
import { AccountingCertaintyCenter } from "~/modules/accounting-certainty/accounting-certainty-center.server";
import { ClosingAdjustmentCenter, type ClosingAdjustmentSummary } from "~/modules/closing-adjustments/closing-adjustment-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DocumentFreshnessCenter } from "~/modules/documents/document-freshness-center.server";
import { EvidenceControlCenter } from "~/modules/evidence/evidence-control-center.server";
import { entriesWithoutEvidenceLabel, evidenceCoverageHint, evidenceCoverageSummary } from "~/modules/evidence/evidence-wording";
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
  const certaintyCenter = new AccountingCertaintyCenter();
  const evidenceReview = await new EvidenceControlCenter().getEvidenceReview(workspace);
  const [certaintySummary, certaintyIssues] = await Promise.all([
    certaintyCenter.getFiscalYearCertaintySummary(workspace),
    certaintyCenter.getCertaintyIssues(workspace),
  ]);
  await new ActivityLogCenter().recordActivity(workspace, {
    action: "accounting_review.viewed",
    entityType: "accounting_review",
    entityId: workspace.fiscalYear.id,
    metadata: { status: review.status, blockingCount: review.blockingCount, warningCount: review.warningCount, openIssues: issueState.open, draftAdjustments: adjustmentState.draft },
  });
  return json({ review, issueState, handledIssues: issues.filter((issue) => issue.status !== "OPEN").slice(0, 8), proposals, adjustmentState, documentFreshness, evidenceReview, certaintySummary, certaintyIssues });
}

export default function Controle() {
  const { review, issueState, handledIssues, proposals, adjustmentState, documentFreshness, evidenceReview, certaintySummary, certaintyIssues } = useLoaderData<typeof loader>();
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
          <KpiCard label="Points ouverts" value={String(issueState.open)} hint="Points suivis" />
          <KpiCard label="OD proposées" value={String(adjustmentState.draft)} hint={`${adjustmentState.approved} validée${adjustmentState.approved > 1 ? "s" : ""}`} />
          <KpiCard label="Documents" value={documentFreshness.staleCount > 0 ? "À régénérer" : "À jour"} hint={`${documentFreshness.staleCount} à mettre à jour`} />
          <KpiCard label="Pièces" value={evidenceReview.requiredMissing > 0 ? "À compléter" : "OK"} hint={evidenceCoverageHint({ entriesWithoutEvidence: evidenceReview.requiredMissing, orphanAttachments: evidenceReview.orphanAttachments })} />
        </div>

        <ControlSection title="Blocages" empty="Aucun blocage comptable." controls={blocking} />
        <CertaintySection summary={certaintySummary} issues={certaintyIssues} />
        <EvidenceSection review={evidenceReview} />
        <ProposalSection proposals={proposals} />
        <DocumentFreshnessSection freshness={documentFreshness} />
        <ControlSection title="Points à revoir" empty="Aucun avertissement de pré-clôture." controls={warnings} />
        <HandledIssues issues={handledIssues} />
      </Main>
    </AppShell>
  );
}

function CertaintySection({ summary, issues }: {
  summary: { verified: number; needsReview: number; blocked: number; status: string; primaryAction: { href: string; label: string } };
  issues: Array<{ key: string; title: string; detail: string; status: string; action: { href: string; label: string } }>;
}) {
  return (
    <>
      <div className="sec-head"><h2>Certitude du dossier</h2></div>
      <div className={`alert ${summary.blocked > 0 ? "red" : summary.needsReview > 0 ? "orange" : "green"}`}>
        <strong>{summary.blocked > 0 ? "Dossier bloqué" : summary.needsReview > 0 ? "Dossier à relire" : "Dossier vérifié"}</strong>
        <span>{summary.verified} vérifié{summary.verified > 1 ? "s" : ""} · {summary.needsReview} à relire · {summary.blocked} blocage{summary.blocked > 1 ? "s" : ""}</span>
        <Link className="btn btn-sm" to={summary.primaryAction.href}>{summary.primaryAction.label}</Link>
      </div>
      {issues.length > 0 ? (
        <div className="control-list">
          {issues.slice(0, 8).map((issue) => (
            <div key={issue.key} className={`card control-card ${issue.status === "blocked" ? "blocking" : "warning"}`}>
              <div>
                <div className="control-title">
                  <StatusPill label={issue.status === "blocked" ? "Bloqué" : "À relire"} tone={issue.status === "blocked" ? "error" : "warn"} />
                  <strong>{issue.title}</strong>
                </div>
                <p className="sub">{issue.detail}</p>
              </div>
              <Link className="btn btn-sm" to={issue.action.href}>{issue.action.label}</Link>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function EvidenceSection({ review }: { review: { requiredMissing: number; recommendedMissing: number; orphanAttachments: number; extractionFailures: number } }) {
  return (
    <>
      <div className="sec-head"><h2>Justificatifs</h2></div>
      <div className={`alert ${review.requiredMissing > 0 ? "orange" : "blue"}`}>
        <strong>{review.requiredMissing > 0 ? "Écritures sans justificatif" : "Justificatifs couverts"}</strong>
        <span>{evidenceCoverageSummary({ entriesWithoutEvidence: review.requiredMissing, orphanAttachments: review.orphanAttachments, extractionFailures: review.extractionFailures })}</span>
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
  if (status === "blocked") return "Pré-clôture bloquée : corrigez les éléments bloquants avant de générer les documents.";
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
