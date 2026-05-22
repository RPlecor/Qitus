import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EvidenceAuditCenter } from "~/modules/evidence/evidence-audit-center.server";
import { EvidenceReviewWorkflow } from "~/modules/evidence/evidence-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const [queue, audit] = await Promise.all([
    new EvidenceReviewWorkflow().getReviewQueue(workspace),
    new EvidenceAuditCenter().getEvidenceAudit(workspace),
  ]);
  return json({ queue, audit, query: Object.fromEntries(url.searchParams) });
}

export default function PiecesRevue() {
  const { queue, audit, query } = useLoaderData<typeof loader>();

  return (
    <AppShell active="pieces">
      <Main title="Revue des pièces" subtitle="Fournir les justificatifs manquants un par un">
        <div className="row-actions">
          <Link className="btn btn-ghost" to="/pieces">← Pièces</Link>
          <Link className="btn" to="/couverture/evidence">Couverture justificatifs</Link>
        </div>
        {query.success ? <div className="alert blue"><strong>{query.success}</strong></div> : null}
        {query.error ? <div className="alert red"><strong>{query.error}</strong></div> : null}

        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">À fournir</div><span className="kpi-val">{queue.summary.requiredMissing}</span><div className="sub">Pièces requises</div></div>
          <div className="kpi"><div className="kpi-label">Recommandées</div><span className="kpi-val">{queue.summary.recommendedMissing}</span><div className="sub">Non bloquantes</div></div>
          <div className="kpi"><div className="kpi-label">Satisfaites</div><span className="kpi-val">{queue.summary.satisfied}</span><div className="sub">Déjà rattachées</div></div>
          <div className="kpi"><div className="kpi-label">Audit stockage</div><span className={`kpi-val ${audit.status === "ready" ? "st-done" : "st-warn"}`}>{audit.status === "ready" ? "OK" : "À revoir"}</span><div className="sub">{audit.summary.missingStoredFiles} fichier manquant</div></div>
        </div>

        <section className="panel">
          <div className="row between">
            <h2>À fournir</h2>
            <span className="sub">{queue.required.length} exigence(s) requise(s)</span>
          </div>
          <EvidenceRequirementTable items={queue.required} upload />
        </section>

        <section className="panel">
          <div className="row between">
            <h2>Recommandées</h2>
            <span className="sub">{queue.recommended.length} point(s) non bloquant(s)</span>
          </div>
          <EvidenceRequirementTable items={queue.recommended} upload />
        </section>

        <section className="panel">
          <div className="row between">
            <h2>Satisfaites</h2>
            <span className="sub">{queue.satisfied.length} preuve(s) déjà reliée(s)</span>
          </div>
          <EvidenceRequirementTable items={queue.satisfied.slice(0, 25)} />
        </section>
      </Main>
    </AppShell>
  );
}

function EvidenceRequirementTable({ items, upload = false }: { items: Array<{ id: string; kind: string; label: string; href: string; level: string }>; upload?: boolean }) {
  return (
    <table className="tbl">
      <thead><tr><th>Preuve</th><th>Élément</th><th>Niveau</th><th>Action</th></tr></thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{kindLabel(item.kind)}</td>
            <td>{item.label}<div className="sub"><Link to={item.href}>Voir l'élément comptable</Link></div></td>
            <td>{item.level === "required" ? "Requise" : "Recommandée"}</td>
            <td>
              {upload ? (
                <Form method="post" action={`/api/evidence-review/requirements/${encodeURIComponent(item.id)}/upload`} encType="multipart/form-data" className="inline-form">
                  <input type="hidden" name="returnTo" value="/pieces/revue" />
                  <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" />
                  <button className="btn btn-sm" type="submit">Fournir une pièce</button>
                </Form>
              ) : <span className="st-done">Satisfaite</span>}
            </td>
          </tr>
        ))}
        {items.length === 0 ? <tr><td colSpan={4} className="sub">Aucun élément dans cette section.</td></tr> : null}
      </tbody>
    </table>
  );
}

function kindLabel(kind: string) {
  const labels: Record<string, string> = {
    invoice: "Facture",
    receipt: "Reçu",
    bank_statement: "Relevé bancaire",
    contract: "Contrat",
    user_decision: "Décision utilisateur",
    expert_validation: "Validation EC",
  };
  return labels[kind] ?? kind;
}
