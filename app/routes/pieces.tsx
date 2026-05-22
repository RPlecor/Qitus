import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AttachmentCenter } from "~/modules/evidence/attachment-center.server";
import { EvidenceControlCenter } from "~/modules/evidence/evidence-control-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const [attachments, review, entriesWithoutEvidence, orphanAttachments] = await Promise.all([
    new AttachmentCenter().listAttachments(workspace, {
      status: url.searchParams.get("status"),
      orphanOnly: url.searchParams.get("orphan") === "1",
      extractionErrorOnly: url.searchParams.get("extractionError") === "1",
    }),
    new EvidenceControlCenter().getEvidenceReview(workspace),
    new EvidenceControlCenter().listEntriesWithoutEvidence(workspace),
    new EvidenceControlCenter().listAttachmentsWithoutAccountingLink(workspace),
  ]);
  return json({ attachments, review, entriesWithoutEvidence, orphanAttachments, query: Object.fromEntries(url.searchParams) });
}

export default function Pieces() {
  const { attachments, review, entriesWithoutEvidence, orphanAttachments, query } = useLoaderData<typeof loader>();

  return (
    <AppShell active="pieces">
      <Main title="Pièces" subtitle="Justificatifs et rattachements comptables">
        <div className="row-actions">
          <Link className="btn btn-p" to="/pieces/revue">Revue guidée</Link>
          <Link className="btn" to="/couverture/evidence">Couverture justificatifs</Link>
        </div>
        {query.success ? <div className="alert blue"><strong>{query.success}</strong></div> : null}
        {query.error ? <div className="alert red"><strong>{query.error}</strong></div> : null}

        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Pièces</div><span className="kpi-val">{attachments.length}</span><div className="sub">Liste courante</div></div>
          <div className="kpi"><div className="kpi-label">Requises manquantes</div><span className="kpi-val">{review.requiredMissing}</span><div className="sub">Écritures sans pièce</div></div>
          <div className="kpi"><div className="kpi-label">Non rattachées</div><span className="kpi-val">{review.orphanAttachments}</span><div className="sub">À relier</div></div>
          <div className="kpi"><div className="kpi-label">OCR à revoir</div><span className="kpi-val">{review.extractionFailures}</span><div className="sub">Non bloquant</div></div>
        </div>

        <Form method="post" action="/api/attachments" encType="multipart/form-data" className="card">
          <input type="hidden" name="returnTo" value="/pieces" />
          <div className="form-row">
            <div className="field">
              <label>Ajouter une pièce</label>
              <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" />
              <span className="help">PDF, PNG, JPG ou TXT · 10 Mo max · OCR local non bloquant.</span>
            </div>
            <div className="field">
              <label>&nbsp;</label>
              <button className="btn btn-p" type="submit">Uploader</button>
            </div>
          </div>
        </Form>

        <Form method="get" className="card">
          <div className="form-row">
            <div className="field">
              <label>Statut</label>
              <select name="status" defaultValue={query.status ?? ""}>
                <option value="">Actives</option>
                <option value="UPLOADED">Uploadées</option>
                <option value="EXTRACTED">Extraites</option>
                <option value="EXTRACTION_FAILED">OCR échoué</option>
                <option value="ARCHIVED">Archivées</option>
              </select>
            </div>
            <div className="field">
              <label>Vue</label>
              <select name="orphan" defaultValue={query.orphan ?? ""}>
                <option value="">Toutes</option>
                <option value="1">Non rattachées</option>
              </select>
            </div>
            <div className="field">
              <label>&nbsp;</label>
              <div className="row-actions">
                <button className="btn" type="submit">Filtrer</button>
                <Link className="btn btn-ghost" to="/pieces">Réinitialiser</Link>
              </div>
            </div>
          </div>
        </Form>

        <div className="grid two">
          <section className="panel">
            <h2>Écritures sans pièce</h2>
            <ul className="evidence-list">
              {entriesWithoutEvidence.slice(0, 5).map((item) => <li key={item.id}><span>{item.label}</span><Link className="btn btn-sm" to={item.href}>Voir</Link></li>)}
              {entriesWithoutEvidence.length === 0 ? <li>Aucune exigence requise manquante.</li> : null}
            </ul>
          </section>
          <section className="panel">
            <h2>Pièces sans écriture</h2>
            <ul className="evidence-list">
              {orphanAttachments.slice(0, 5).map((item) => <li key={item.id}><span>{item.filename}</span><Link className="btn btn-sm" to={`/pieces/${item.id}`}>Rattacher</Link></li>)}
              {orphanAttachments.length === 0 ? <li>Aucune pièce orpheline.</li> : null}
            </ul>
          </section>
        </div>

        <table className="tbl">
          <thead><tr><th>Fichier</th><th>Statut</th><th>Fournisseur</th><th>Date</th><th>TTC</th><th>Liens</th><th></th></tr></thead>
          <tbody>
            {attachments.map((attachment) => (
              <tr key={attachment.id}>
                <td>{attachment.originalFilename}<div className="sub">{formatBytes(attachment.sizeBytes)}</div></td>
                <td><span className={statusClass(attachment.status)}>{statusLabel(attachment.status)}</span></td>
                <td>{attachment.supplierName ?? "—"}</td>
                <td>{attachment.invoiceDate ?? "—"}</td>
                <td>{attachment.amountTtc ? formatEuro(attachment.amountTtc) : "—"}</td>
                <td>{attachment.linksCount}</td>
                <td><Link className="btn btn-sm" to={`/pieces/${attachment.id}`}>Ouvrir</Link></td>
              </tr>
            ))}
            {attachments.length === 0 ? <tr><td colSpan={7} className="sub">Aucune pièce déposée.</td></tr> : null}
          </tbody>
        </table>
      </Main>
    </AppShell>
  );
}

export function statusLabel(status: string) {
  if (status === "EXTRACTED") return "OCR OK";
  if (status === "EXTRACTION_FAILED") return "OCR à revoir";
  if (status === "ARCHIVED") return "Archivée";
  return "Uploadée";
}

export function statusClass(status: string) {
  if (status === "EXTRACTED") return "st-done";
  if (status === "EXTRACTION_FAILED") return "st-warn";
  if (status === "ARCHIVED") return "sub";
  return "st-ok";
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} Ko`;
  return `${(value / 1024 / 1024).toFixed(1)} Mo`;
}

function formatEuro(value: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}
