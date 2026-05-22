import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AnnualClosingCenter } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AppShell, KpiCard, Main, StatusPill, TableShell } from "~/components/ui";
import { ExpertReviewShareCenter } from "~/modules/expert-review/expert-review-share-center.server";
import { ExpertReviewWorkflow } from "~/modules/expert-dossier/expert-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const url = new URL(args.request.url);
  const workspace = await requireCompanyWorkspace(args);
  const overview = await new AnnualClosingCenter().getClosingOverview(workspace);
  const expertReview = new ExpertReviewShareCenter();
  const [shareLinks, latestValidation] = await Promise.all([
    expertReview.listShareLinks(workspace),
    expertReview.getLatestValidation(workspace),
  ]);
  return json({ overview, shareLinks, latestValidation, createdShareUrl: url.searchParams.get("shareUrl") });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const shareLink = await new ExpertReviewShareCenter().createShareLink(workspace, {
    label: String(form.get("label") || "Revue expert-comptable"),
    expiresInDays: Number(form.get("expiresInDays") || 30),
  });
  await new ExpertReviewWorkflow().startReview(workspace, { shareLinkId: shareLink.id });
  return redirect(`/cloture?shareUrl=${encodeURIComponent(shareLink.url)}`);
}

export default function Cloture() {
  const { overview, shareLinks, latestValidation, createdShareUrl } = useLoaderData<typeof loader>();
  return (
    <AppShell active="cloture">
      <Main title="Clôture" subtitle="Workflow annuel" action={<ClosingAction overview={overview} />}>
        <div className={`alert ${overview.run.status === "CLOSED" ? "blue" : overview.blockers.length > 0 ? "orange" : "blue"}`}>
          <strong>{statusLabel(overview.run.status)}</strong>
          <span>{overview.blockers.length} blocage{overview.blockers.length > 1 ? "s" : ""} · {overview.warnings.length} avertissement{overview.warnings.length > 1 ? "s" : ""}</span>
        </div>

        <div className="kpi-grid">
          <KpiCard label="Exercice" value={overview.fiscalYearStatus} hint="Statut comptable" />
          <KpiCard label="Étapes" value={`${overview.steps.filter((step) => step.status === "DONE" || step.status === "SKIPPED").length}/12`} hint="Terminées" />
          <KpiCard label="Blocages" value={String(overview.blockers.length)} hint="À résoudre" />
          <KpiCard label="Clôture" value={overview.canClose ? "Possible" : "À préparer"} hint="Verrouillage final" />
        </div>

        <div className="card card-head">
          <div>
            <strong>OD de clôture généralisées</strong>
            <div className="sub">FNP, FAE, PCA/CCA, stocks, provisions, emprunts, paie, TVA, IS et écarts de rapprochement.</div>
          </div>
          <Link className="btn btn-p" to="/cloture/od">Ouvrir le cockpit OD</Link>
        </div>

        <div className="sec-head"><h2>Revue expert-comptable</h2></div>
        <div className="card">
          {latestValidation ? (
            <p className="sub">Dernière validation : {latestValidation.reviewerName} le {formatDateTime(latestValidation.reviewedAt)}.</p>
          ) : (
            <p className="sub">Aucune validation expert-comptable enregistrée.</p>
          )}
          {createdShareUrl ? <div className="alert blue">Lien créé : <a href={createdShareUrl}>{createdShareUrl}</a></div> : null}
          <Form method="post" action="/cloture" className="filter-bar">
            <div className="field"><label>Libellé</label><input name="label" defaultValue="Revue expert-comptable" /></div>
            <div className="field narrow"><label>Expiration (j.)</label><input name="expiresInDays" defaultValue="30" /></div>
            <button className="btn btn-p" type="submit">Créer un lien</button>
          </Form>
          {shareLinks.length > 0 ? (
            <TableShell>
            <table className="tbl">
              <tbody>
                {shareLinks.map((link) => (
                  <tr key={link.id}>
                    <td>{link.label}</td>
                    <td><StatusPill label={link.reviewedAt ? `Validé par ${link.reviewerName}` : "En attente"} tone={link.reviewedAt ? "ok" : "warn"} /></td>
                    <td>Expire le {formatDateTime(link.expiresAt)}</td>
                    <td><StatusPill label={link.revokedAt ? "Révoqué" : "Actif"} tone={link.revokedAt ? "error" : "ok"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableShell>
          ) : null}
        </div>

        <TableShell>
        <table className="tbl">
          <thead><tr><th>N°</th><th>Étape</th><th>Statut</th><th>Preuve</th><th>Action</th><th></th></tr></thead>
          <tbody>
            {overview.steps.map((step) => (
              <tr key={step.code}>
                <td className="mono">{step.index}</td>
                <td><strong>{step.title}</strong><div className="sub">{step.detail}</div></td>
                <td><StatusPill label={stepStatusLabel(step.status)} tone={stepStatusTone(step.status)} /></td>
                <td className="sub">{step.evidence[0] ? `${step.evidence[0].label} : ${step.evidence[0].value}` : "—"}</td>
                <td><Link className="btn btn-sm" to={step.action.href}>{step.action.label}</Link></td>
                <td><Link className="btn btn-sm" to={`/cloture/${step.code}`}>Détail</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        </TableShell>
      </Main>
    </AppShell>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function ClosingAction({ overview }: { overview: { run: { status: string }; canClose: boolean } }) {
  if (overview.run.status === "NOT_STARTED") {
    return <Form method="post" action="/api/cloture/start"><button className="btn btn-p">Démarrer la clôture</button></Form>;
  }
  if (overview.run.status === "CLOSED") {
    return (
      <Form method="post" action="/api/cloture/reopen">
        <input type="hidden" name="reason" value="Réouverture depuis l'interface locale" />
        <button className="btn">Réouvrir</button>
      </Form>
    );
  }
  return <Form method="post" action="/api/cloture/close"><button className={`btn ${overview.canClose ? "btn-p" : ""}`}>Clôturer l'exercice</button></Form>;
}

function statusLabel(status: string) {
  if (status === "CLOSED") return "Exercice clôturé";
  if (status === "IN_PROGRESS" || status === "REOPENED") return "Clôture en cours";
  if (status === "READY_TO_CLOSE") return "Prêt à clôturer";
  return "Clôture non démarrée";
}

function stepStatusLabel(status: string) {
  if (status === "DONE") return "Terminé";
  if (status === "SKIPPED") return "Ignoré";
  if (status === "BLOCKED") return "Bloqué";
  if (status === "READY") return "Prêt";
  return "À traiter";
}

function stepStatusTone(status: string): "ok" | "done" | "warn" | "error" | "neutral" {
  if (status === "DONE") return "done";
  if (status === "SKIPPED") return "neutral";
  if (status === "BLOCKED") return "error";
  if (status === "READY") return "ok";
  return "warn";
}
