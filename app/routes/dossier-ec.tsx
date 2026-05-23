import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, KpiCard, Main, StatusPill, TableShell } from "~/components/ui";
import { ExpertDossierCenter } from "~/modules/expert-dossier/expert-dossier-center.server";
import { ExpertDossierReadinessWorkflow } from "~/modules/expert-dossier/expert-dossier-readiness-workflow.server";
import { ExpertDossierExportVerifier } from "~/modules/expert-dossier/expert-dossier-export-verifier.server";
import { ExpertReviewShareCenter } from "~/modules/expert-review/expert-review-share-center.server";
import { ExpertReviewWorkflow } from "~/modules/expert-dossier/expert-review-workflow.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";
import { expertReviewStatusLabel, readinessStatusLabel } from "~/modules/ui-labels";

export async function loader(args: LoaderFunctionArgs) {
  const url = new URL(args.request.url);
  const workspace = await requireCompanyWorkspace(args);
  const readinessWorkflow = new ExpertDossierReadinessWorkflow();
  const [overview, readiness, shareLinks, review, exportVerification] = await Promise.all([
    new ExpertDossierCenter().getDossierOverview(workspace),
    readinessWorkflow.getReadinessQueue(workspace),
    new ExpertReviewShareCenter().listShareLinks(workspace),
    new ExpertReviewWorkflow().getReview(workspace),
    new ExpertDossierExportVerifier().getExportVerificationReport(workspace),
  ]);
  return json({
    overview,
    readiness,
    shareLinks,
    review,
    exportVerification,
    createdShareUrl: url.searchParams.get("shareUrl"),
    error: url.searchParams.get("error"),
    prepared: url.searchParams.get("prepared") === "1",
  });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const intent = String(form.get("intent") || "");
  try {
    if (intent === "prepare") {
      await new ExpertDossierReadinessWorkflow().prepareForReview(workspace);
      return redirect("/dossier-ec?prepared=1");
    }
    if (intent === "share") {
      const shareLink = await new ExpertReviewShareCenter().createShareLink(workspace, {
        label: String(form.get("label") || "Dossier expert-comptable"),
        expiresInDays: Number(form.get("expiresInDays") || 30),
      });
      await new ExpertReviewWorkflow().startReview(workspace, { shareLinkId: shareLink.id });
      return redirect(`/dossier-ec?shareUrl=${encodeURIComponent(shareLink.url)}`);
    }
    return redirect("/dossier-ec");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/dossier-ec");
  }
}

export default function ExpertDossierPage() {
  const { overview, readiness, shareLinks, review, exportVerification, createdShareUrl, prepared, error } = useLoaderData<typeof loader>();
  return (
    <AppShell active="dossier-ec">
      <Main
        title="Dossier EC"
        subtitle="Dossier de révision collaboratif"
        action={<a className="btn" href="/api/expert-dossier/export">Exporter dossier final</a>}
      >
        {error ? <div className="alert red">{error}</div> : null}
        {prepared ? <div className="alert blue">État transmis du dossier préparé.</div> : null}
        {createdShareUrl ? <div className="alert blue">Lien cabinet créé : <a href={createdShareUrl}>{createdShareUrl}</a></div> : null}

        <div className={`alert ${overview.readiness.status === "blocked" ? "red" : overview.readiness.status === "ready_for_final_export" ? "blue" : "orange"}`}>
          <strong>{overview.readiness.label}</strong>
          <span>Score {overview.readiness.score}% · {overview.readiness.blocked} blocage(s) · {overview.readiness.highRisk} risque(s) élevé(s)</span>
        </div>

        <div className="kpi-grid">
          <KpiCard label="Score dossier" value={`${overview.readiness.score}%`} hint={overview.readiness.label} />
          <KpiCard label="Sections prêtes" value={String(overview.readiness.ready)} hint={`${overview.sections.length} sections`} />
          <KpiCard label="Blocages" value={String(readiness.blockingItems.length)} hint="À résoudre avant partage/export" />
          <KpiCard label="Revue EC" value={expertReviewStatusLabel(review?.status)} hint={review ? `${review.summary.open} demande(s) ouvertes` : "Aucune revue active"} />
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <strong>Points à traiter du dossier</strong>
              <div className="sub">{readiness.blockingItems.length} blocage(s) · {readiness.warnings.length} point(s) à surveiller · état transmis {readiness.snapshotState.label}</div>
            </div>
            <Link className="btn btn-sm" to="/dossier-ec/snapshots">États transmis</Link>
          </div>
          {readiness.items.length > 0 ? (
            <TableShell>
              <table className="tbl">
                <tbody>
                  {readiness.items.slice(0, 8).map((item) => (
                    <tr key={item.code}>
                      <td><StatusPill label={item.severity === "blocking" ? "Bloquant" : "À vérifier"} tone={item.severity === "blocking" ? "error" : "warn"} /></td>
                      <td><strong>{item.title}</strong><div className="sub">{item.detail}</div></td>
                      <td><Link className="btn btn-sm" to={item.href}>Traiter</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          ) : <p className="sub">Aucun blocage dossier détecté.</p>}
        </div>

        <div className={`alert ${exportVerification.verification.status === "blocked" ? "red" : exportVerification.verification.status === "warning" ? "orange" : "blue"}`}>
          <strong>Vérification export : {readinessStatusLabel(exportVerification.verification.status)}</strong>
          <span>{exportVerification.verification.blockingCount} blocage(s) · {exportVerification.verification.warningCount} avertissement(s)</span>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <strong>Préparer et partager</strong>
              <div className="sub">L'état transmis fige le dossier envoyé. Toute modification comptable rendra le dossier obsolète.</div>
            </div>
            <Form method="post"><input type="hidden" name="intent" value="prepare" /><button className="btn" type="submit">Préparer le dossier</button></Form>
          </div>
          <Form method="post" className="filter-bar">
            <input type="hidden" name="intent" value="share" />
            <div className="field"><label>Libellé</label><input name="label" defaultValue="Dossier expert-comptable" /></div>
            <div className="field narrow"><label>Expiration (j.)</label><input name="expiresInDays" defaultValue="30" /></div>
            <button className="btn btn-p" type="submit">Partager au cabinet</button>
          </Form>
        </div>

        <div className="sec-head"><h2>Sections du dossier</h2></div>
        <TableShell>
          <table className="tbl">
            <thead><tr><th>Section</th><th>État</th><th>Risque</th><th>Résumé</th><th>Manques</th><th></th></tr></thead>
            <tbody>
              {overview.sections.map((section) => (
                <tr key={section.code}>
                  <td><strong>{section.title}</strong><div className="sub mono">{section.code}</div></td>
                  <td><StatusPill label={statusLabel(section.status)} tone={statusTone(section.status)} /></td>
                  <td><StatusPill label={riskLabel(section.risk)} tone={section.risk === "high" ? "error" : section.risk === "medium" ? "warn" : "ok"} /></td>
                  <td>{section.summary}<div className="sub">{section.evidence.slice(0, 2).join(" · ")}</div></td>
                  <td className="sub">{section.gaps.slice(0, 3).join(" · ") || "—"}</td>
                  <td><Link className="btn btn-sm" to={section.href}>Voir la section</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>

        <div className="sec-head"><h2>Revue cabinet</h2><Link className="btn" to="/dossier-ec/revue">Ouvrir la revue</Link></div>
        <div className="card">
          {shareLinks.length > 0 ? (
            <TableShell>
              <table className="tbl">
                <tbody>
                  {shareLinks.map((link) => (
                    <tr key={link.id}>
                      <td>{link.label}</td>
                      <td>{link.reviewedAt ? `Validé par ${link.reviewerName}` : "En attente"}</td>
                      <td>Expire le {formatDateTime(link.expiresAt)}</td>
                      <td>{link.revokedAt ? "Révoqué" : "Actif"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          ) : <p className="sub">Aucun lien cabinet créé.</p>}
        </div>
      </Main>
    </AppShell>
  );
}

function statusLabel(status: string) {
  if (status === "ready") return "Prêt";
  if (status === "partial") return "Partiel";
  if (status === "blocked") return "Bloqué";
  if (status === "stale") return "Obsolète";
  return "N/A";
}

function statusTone(status: string) {
  if (status === "ready" || status === "not_applicable") return "ok";
  if (status === "blocked" || status === "stale") return "error";
  return "warn";
}

function riskLabel(risk: string) {
  if (risk === "high") return "Élevé";
  if (risk === "medium") return "Moyen";
  return "Faible";
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
