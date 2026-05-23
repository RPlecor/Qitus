import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { TableShell } from "~/components/ui";
import { ExpertReviewPortalProjection } from "~/modules/expert-dossier/expert-review-portal-projection.server";
import { documentFormatLabel, documentTypeLabel, dossierSectionStatusLabel, expertReviewItemStatusLabel, expertReviewSectionLabel, expertReviewStatusLabel, riskLabel } from "~/modules/ui-labels";

export async function loader(args: LoaderFunctionArgs) {
  const portal = await new ExpertReviewPortalProjection().getSharedPortal(String(args.params.token));
  const validated = new URL(args.request.url).searchParams.get("validated") === "1";
  return json({ ...portal, token: args.params.token, validated, error: new URL(args.request.url).searchParams.get("error") });
}

export default function SharedReview() {
  const { shareLink, workspace, overview, journalSummary, journalAudit, documents, closing, dossier, activeReview, items, token, validated, error, transmittedSnapshot, isTransmittedDossierStale } = useLoaderData<typeof loader>();
  return (
    <main className="shared-page">
      <section className="shared-hero">
        <p className="eyebrow">Revue expert-comptable</p>
        <h1>{workspace.company.name}</h1>
        <p>Exercice {date(workspace.fiscalYear.startDate)} → {date(workspace.fiscalYear.endDate)} · accès comptable en lecture seule</p>
      </section>
      {error ? <div className="alert red">{error}</div> : null}
      {validated ? <div className="alert blue">Validation enregistrée. Merci.</div> : null}
      {shareLink.reviewedAt ? <div className="alert blue">Dossier validé par {shareLink.reviewerName} le {dateTime(shareLink.reviewedAt)}.</div> : null}
      {isTransmittedDossierStale ? <div className="alert orange">L'état transmis est obsolète. Demande au client de préparer un nouveau dossier avant validation finale.</div> : null}
      {transmittedSnapshot ? <div className="alert blue">État transmis : {transmittedSnapshot.snapshotKey} · {transmittedSnapshot.freshness.statusLabel}</div> : <div className="alert orange">Aucun état transmis n'est associé à ce dossier.</div>}

      <section className="kpi-grid">
        <div className="kpi"><div className="kpi-label">CA</div><span className="kpi-val">{euro(overview.kpis.revenue)}</span></div>
        <div className="kpi"><div className="kpi-label">Charges</div><span className="kpi-val">{euro(overview.kpis.expenses)}</span></div>
        <div className="kpi"><div className="kpi-label">Résultat</div><span className="kpi-val">{euro(overview.kpis.result)}</span></div>
        <div className="kpi"><div className="kpi-label">Dossier EC</div><span className="kpi-val">{dossier.readiness.score}%</span></div>
      </section>

      <section className="card">
        <h2>Résumé dossier</h2>
        <p>{dossier.readiness.label} · {dossier.readiness.blocked} blocage(s) · {dossier.readiness.highRisk} risque(s) élevé(s).</p>
        <TableShell>
          <table className="tbl">
            <tbody>
              {dossier.sections.map((section) => (
                <tr key={section.code}><td>{section.title}</td><td>{dossierSectionStatusLabel(section.status)}</td><td>{riskLabel(section.risk)}</td><td>{section.summary}</td></tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </section>

      <section className="card">
        <h2>Journal</h2>
        <p>{journalSummary.entriesCount} écritures · {journalSummary.linesCount} lignes · {journalAudit.label}</p>
      </section>

      <section className="card">
        <h2>Documents</h2>
        <TableShell>
          <table className="tbl">
            <thead><tr><th>Type</th><th>Fichier</th><th>Format</th><th>État</th></tr></thead>
            <tbody>
              {documents.map((document) => <tr key={document.id}><td>{documentTypeLabel(document.type)}</td><td>{document.filename}</td><td>{documentFormatLabel(document.format)}</td><td>{document.freshness?.statusLabel ?? "À jour"}</td></tr>)}
            </tbody>
          </table>
        </TableShell>
      </section>

      <section className="card">
        <h2>Étapes de clôture</h2>
        <TableShell>
          <table className="tbl">
            <tbody>
              {closing.steps.map((step) => <tr key={step.code}><td>{step.index}. {step.title}</td><td>{stepStatusLabel(step.status)}</td><td>{step.blockingCount} blocage(s)</td><td>{step.warningCount} alerte(s)</td></tr>)}
            </tbody>
          </table>
        </TableShell>
      </section>

      <section className="card">
        <h2>Commentaires et demandes</h2>
        {activeReview ? <p className="sub">Revue {expertReviewStatusLabel(activeReview.status)} · {activeReview.summary.open} demande(s) ouverte(s).</p> : <p className="sub">Aucune revue collaborative active. Demande au client de partager le dossier depuis Qitus.</p>}
        {activeReview ? (
          <>
            <Form method="post" action={`/api/expert-review/shared/${token}/items`} className="form-grid">
              <label>Section<input name="sectionCode" defaultValue="general" /></label>
              <label>Sévérité<select name="severity" defaultValue="WARNING"><option value="INFO">Information</option><option value="WARNING">Avertissement</option><option value="BLOCKING">Bloquant</option></select></label>
              <label>Nom<input name="authorName" defaultValue={shareLink.reviewerName ?? ""} /></label>
              <label>Titre<input name="title" required /></label>
              <label>Détail<textarea name="body" required /></label>
              <button className="btn" type="submit">Créer une demande</button>
            </Form>
            <TableShell>
              <table className="tbl">
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.title}</strong><div className="sub">{item.body}</div></td>
                      <td>{expertReviewSectionLabel(item.sectionCode)}</td>
                      <td>{expertReviewItemStatusLabel(item.status)}</td>
                      <td>
                        <Form method="post" action={`/api/expert-review/shared/${token}/items/${item.id}/comments`} className="inline-form">
                          <input name="authorName" placeholder="Nom" defaultValue={shareLink.reviewerName ?? ""} />
                          <input name="body" placeholder="Commentaire" />
                          <button className="btn btn-sm" type="submit">Commenter</button>
                        </Form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </>
        ) : null}
      </section>

      <section className="card">
        <h2>Validation finale</h2>
        <Form method="post" action={`/api/expert-review/shared/${token}/signoff`} className="form-grid">
          <label>Nom expert-comptable<input name="reviewerName" defaultValue={shareLink.reviewerName ?? ""} required /></label>
          <label>Email<input name="reviewerEmail" type="email" /></label>
          <label>Note<textarea name="reviewNote" defaultValue={shareLink.reviewNote ?? ""} /></label>
          <button className="btn btn-p" type="submit">Valider le dossier</button>
        </Form>
      </section>
    </main>
  );
}

function date(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function stepStatusLabel(status: string) {
  if (status === "DONE") return "Terminé";
  if (status === "SKIPPED") return "Ignoré";
  if (status === "BLOCKED") return "Bloqué";
  if (status === "READY") return "Prêt";
  return "À traiter";
}

function euro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
