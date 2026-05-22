import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AttachmentMatchingCenter } from "~/modules/evidence/attachment-matching-center.server";
import { AttachmentCenter } from "~/modules/evidence/attachment-center.server";
import { EvidenceReviewWorkflow } from "~/modules/evidence/evidence-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const id = String(args.params.id);
  const [attachment, suggestions, queue] = await Promise.all([
    new AttachmentCenter().getAttachmentDetail(workspace, id),
    new AttachmentMatchingCenter().suggestLinksForAttachment(workspace, id),
    new EvidenceReviewWorkflow().getReviewQueue(workspace),
  ]);
  const query = Object.fromEntries(new URL(args.request.url).searchParams);
  return json({ attachment, suggestions, queue, query });
}

export default function PieceDetail() {
  const { attachment, suggestions, queue, query } = useLoaderData<typeof loader>();

  return (
    <AppShell active="pieces">
      <Main title="Pièce" subtitle={attachment.originalFilename}>
        <div className="row-actions">
          <Link className="btn btn-ghost" to="/pieces">← Pièces</Link>
          <a className="btn" href={`/api/attachments/${attachment.id}/download`}>Télécharger</a>
        </div>
        {query.success ? <div className="alert blue"><strong>{query.success}</strong></div> : null}
        {query.error ? <div className="alert red"><strong>{query.error}</strong></div> : null}

        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Statut</div><span className={`kpi-val ${statusClass(attachment.status)}`}>{statusLabel(attachment.status)}</span></div>
          <div className="kpi"><div className="kpi-label">Fournisseur</div><span className="kpi-val">{attachment.supplierName ?? "—"}</span></div>
          <div className="kpi"><div className="kpi-label">Date</div><span className="kpi-val">{attachment.invoiceDate ?? "—"}</span></div>
          <div className="kpi"><div className="kpi-label">TTC</div><span className="kpi-val">{attachment.amountTtc ? formatEuro(attachment.amountTtc) : "—"}</span></div>
        </div>

        <div className="grid two">
          <Form method="post" action={`/api/attachments/${attachment.id}/extraction`} className="card">
            <input type="hidden" name="returnTo" value={`/pieces/${attachment.id}`} />
            <h2>Métadonnées</h2>
            <div className="field"><label>Fournisseur</label><input name="supplierName" defaultValue={attachment.supplierName ?? ""} /></div>
            <div className="form-row">
              <div className="field"><label>Date facture</label><input type="date" name="invoiceDate" defaultValue={attachment.invoiceDate ?? ""} /></div>
              <div className="field"><label>N° facture</label><input name="invoiceNumber" defaultValue={attachment.invoiceNumber ?? ""} /></div>
            </div>
            <div className="form-row">
              <div className="field"><label>HT</label><input name="amountHt" defaultValue={attachment.amountHt ?? ""} /></div>
              <div className="field"><label>TVA</label><input name="amountVat" defaultValue={attachment.amountVat ?? ""} /></div>
              <div className="field"><label>TTC</label><input name="amountTtc" defaultValue={attachment.amountTtc ?? ""} /></div>
            </div>
            <div className="field"><label>Devise</label><input name="currency" defaultValue={attachment.currency ?? "EUR"} /></div>
            <div className="field"><label>Texte extrait</label><textarea name="extractedText" rows={8} defaultValue={attachment.extractedText ?? ""} /></div>
            <button className="btn btn-p" type="submit">Enregistrer</button>
          </Form>

          <section className="panel">
            <h2>Rattachements</h2>
            <ul className="evidence-list">
              {attachment.links.map((link) => (
                <li key={link.id}>
                  <span>{relationLabel(link.relationType)} · {entityLabel(link.entityType)} {link.entityId.slice(0, 8)}</span>
                  <Form method="post" action={`/api/attachment-links/${link.id}`}>
                    <input type="hidden" name="returnTo" value={`/pieces/${attachment.id}`} />
                    <button className="btn btn-sm" type="submit">Détacher</button>
                  </Form>
                </li>
              ))}
              {attachment.links.length === 0 ? <li>Aucun rattachement.</li> : null}
            </ul>

            <h2>Suggestions</h2>
            <ul className="evidence-list">
              {suggestions.map((suggestion) => (
                <li key={suggestion.requirementId}>
                  <span>
                    {suggestion.label} · score {suggestion.score}
                    <div className="sub">{suggestion.reasons.join(", ") || "Compatibilité faible"}</div>
                  </span>
                  <Form method="post" action={`/api/evidence-review/requirements/${encodeURIComponent(suggestion.requirementId)}/link`}>
                    <input type="hidden" name="returnTo" value={`/pieces/${attachment.id}`} />
                    <input type="hidden" name="attachmentId" value={attachment.id} />
                    <button className="btn btn-sm" type="submit">Rattacher</button>
                  </Form>
                </li>
              ))}
              {suggestions.length === 0 ? <li>Aucune suggestion automatique.</li> : null}
            </ul>
          </section>
        </div>

        <section className="panel">
          <div className="row between">
            <h2>Exigences actives</h2>
            <Link className="btn btn-sm" to="/pieces/revue">Ouvrir la revue</Link>
          </div>
          <table className="tbl">
            <thead><tr><th>Preuve attendue</th><th>Élément</th><th>Niveau</th><th></th></tr></thead>
            <tbody>
              {queue.active.slice(0, 25).map((item) => (
                <tr key={item.id}>
                  <td>{kindLabel(item.kind)}</td>
                  <td>{item.label}<div className="sub"><Link to={item.href}>Voir l'élément</Link></div></td>
                  <td>{item.level === "required" ? "Requise" : "Recommandée"}</td>
                  <td>
                    <Form method="post" action={`/api/evidence-review/requirements/${encodeURIComponent(item.id)}/link`}>
                      <input type="hidden" name="returnTo" value={`/pieces/${attachment.id}`} />
                      <input type="hidden" name="attachmentId" value={attachment.id} />
                      <button className="btn btn-sm" type="submit">Rattacher ici</button>
                    </Form>
                  </td>
                </tr>
              ))}
              {queue.active.length === 0 ? <tr><td colSpan={4} className="sub">Aucune exigence active à rattacher.</td></tr> : null}
            </tbody>
          </table>
          <p className="sub">Le rattachement passe par une exigence réelle : cela évite les liens ambigus et met à jour la couverture EC.</p>
        </section>

        <Form method="post" action={`/api/attachments/${attachment.id}/archive`} className="form-actions">
          <input type="hidden" name="returnTo" value="/pieces" />
          <button className="btn" type="submit">Archiver la pièce</button>
        </Form>
      </Main>
    </AppShell>
  );
}

function relationLabel(value: string) {
  const labels: Record<string, string> = {
    INVOICE: "Facture",
    RECEIPT: "Reçu",
    BANK_STATEMENT: "Relevé",
    CONTRACT: "Contrat",
    USER_DECISION: "Décision",
    EXPERT_VALIDATION: "Validation EC",
    OTHER: "Autre",
  };
  return labels[value] ?? value;
}

function entityLabel(value: string) {
  if (value === "TRANSACTION") return "transaction";
  if (value === "JOURNAL_ENTRY") return "écriture";
  if (value === "CLOSING_ADJUSTMENT") return "OD";
  return "exercice";
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

function formatEuro(value: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}

function statusLabel(status: string) {
  if (status === "EXTRACTED") return "OCR OK";
  if (status === "EXTRACTION_FAILED") return "OCR à revoir";
  if (status === "ARCHIVED") return "Archivée";
  return "Uploadée";
}

function statusClass(status: string) {
  if (status === "EXTRACTED") return "st-done";
  if (status === "EXTRACTION_FAILED") return "st-warn";
  if (status === "ARCHIVED") return "sub";
  return "st-ok";
}
