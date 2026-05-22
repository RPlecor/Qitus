import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { AccountingCoverageCenter } from "~/modules/accounting-coverage/accounting-coverage-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EvidenceReviewWorkflow } from "~/modules/evidence/evidence-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const area = await new AccountingCoverageCenter().getCoverageAreaDetail(workspace, String(args.params.areaCode));
  const evidenceQueue = area.code === "evidence"
    ? await new EvidenceReviewWorkflow().getReviewQueue(workspace)
    : null;
  return json({ area, evidenceQueue });
}

export default function CouvertureDetail() {
  const { area, evidenceQueue } = useLoaderData<typeof loader>();

  return (
    <AppShell active="couverture">
      <Main title={area.title} subtitle="Détail couverture expert-comptable">
        <div className="row-actions">
          <Link className="btn btn-ghost" to="/couverture">← Couverture EC</Link>
          <Link className="btn" to={area.href}>Action recommandée</Link>
        </div>

        <section className="panel">
          <div className="row between">
            <h2>{area.summary}</h2>
            <span className={statusClass(area.status)}>{statusLabel(area.status)}</span>
          </div>
          <p className="sub">Risque {riskLabel(area.risk)} · prochaine étape roadmap : {area.nextPhase}</p>
        </section>

        <div className="grid two">
          <section className="panel">
            <h2>Preuves disponibles</h2>
            <ul className="evidence-list">
              {area.evidence.map((item) => <li key={item}>{item}</li>)}
              {area.evidence.length === 0 ? <li>Aucune preuve disponible pour ce domaine.</li> : null}
            </ul>
          </section>
          <section className="panel">
            <h2>Manques identifiés</h2>
            <ul className="evidence-list">
              {area.gaps.map((item) => <li key={item}>{item}</li>)}
              {area.gaps.length === 0 ? <li>Aucun manque actif.</li> : null}
            </ul>
          </section>
        </div>

        {evidenceQueue ? (
          <>
            <div className="sec-head">
              <h2>Justificatifs</h2>
              <Link className="btn btn-sm" to="/pieces/revue">Traiter la revue</Link>
            </div>
            <div className="kpi-grid">
              <div className="kpi"><div className="kpi-label">À fournir</div><span className="kpi-val">{evidenceQueue.summary.requiredMissing}</span><div className="sub">Requises</div></div>
              <div className="kpi"><div className="kpi-label">Recommandées</div><span className="kpi-val">{evidenceQueue.summary.recommendedMissing}</span><div className="sub">Non bloquantes</div></div>
              <div className="kpi"><div className="kpi-label">Satisfaites</div><span className="kpi-val">{evidenceQueue.summary.satisfied}</span><div className="sub">Pièces reliées</div></div>
            </div>

            <EvidenceSection title="À fournir" items={evidenceQueue.required} />
            <EvidenceSection title="Recommandées" items={evidenceQueue.recommended} />
            <EvidenceSection title="Satisfaites" items={evidenceQueue.satisfied.slice(0, 25)} satisfied />
          </>
        ) : null}
      </Main>
    </AppShell>
  );
}

function EvidenceSection({ title, items, satisfied = false }: { title: string; items: Array<{ id: string; kind: string; label: string; level: string; href: string }>; satisfied?: boolean }) {
  return (
    <section className="panel">
      <div className="row between">
        <h2>{title}</h2>
        <span className="sub">{items.length}</span>
      </div>
      <table className="tbl">
        <thead><tr><th>Type</th><th>Élément</th><th>Niveau</th><th></th></tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{kindLabel(item.kind)}</td>
              <td>{item.label}</td>
              <td>{item.level === "required" ? "Requis" : "Recommandé"}</td>
              <td>{satisfied ? <span className="st-done">Satisfaite</span> : <Link className="btn btn-sm" to={`/pieces/revue?requirement=${encodeURIComponent(item.id)}`}>Fournir</Link>}</td>
            </tr>
          ))}
          {items.length === 0 ? <tr><td colSpan={4} className="sub">Aucun élément.</td></tr> : null}
        </tbody>
      </table>
    </section>
  );
}

function kindLabel(kind: string) {
  const labels: Record<string, string> = {
    invoice: "Facture",
    receipt: "Reçu",
    bank_statement: "Relevé",
    contract: "Contrat",
    user_decision: "Décision",
    expert_validation: "Validation EC",
  };
  return labels[kind] ?? kind;
}

function statusLabel(status: string) {
  if (status === "covered") return "Couvert";
  if (status === "partial") return "Partiel";
  if (status === "missing") return "Manquant";
  return "Non applicable";
}

function statusClass(status: string) {
  if (status === "covered") return "st-done";
  if (status === "missing") return "st-error";
  if (status === "partial") return "st-warn";
  return "sub";
}

function riskLabel(risk: string) {
  if (risk === "high") return "Élevé";
  if (risk === "medium") return "Moyen";
  return "Faible";
}
