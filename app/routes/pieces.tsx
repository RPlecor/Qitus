import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { useRef, useState } from "react";
import { AppShell, KpiCard, Main, StatusPill, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AttachmentCenter } from "~/modules/evidence/attachment-center.server";
import { EvidenceControlCenter } from "~/modules/evidence/evidence-control-center.server";
import { entriesWithoutEvidenceLabel } from "~/modules/evidence/evidence-wording";
import { attachmentStatusLabelForUser, eInvoiceStatusLabel } from "~/modules/ui-labels";

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
          <KpiCard label="Pièces" value={String(attachments.length)} hint="Liste courante" />
          <KpiCard label="Sans justificatif" value={String(review.requiredMissing)} hint="Écritures à compléter" />
          <KpiCard label="Non rattachées" value={String(review.orphanAttachments)} hint="À relier" />
          <KpiCard label="Pièces à relire" value={String(review.extractionFailures)} hint="Lecture à vérifier" />
        </div>

        <UploadZone />

        <Form method="get" className="card filter-bar">
          <div className="field">
            <label>Statut</label>
            <select name="status" defaultValue={query.status ?? ""}>
              <option value="">Actives</option>
              <option value="UPLOADED">Déposées</option>
              <option value="EXTRACTED">Lues</option>
              <option value="EXTRACTION_FAILED">Lecture à vérifier</option>
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
          <button className="btn" type="submit">Filtrer</button>
          <Link className="btn btn-ghost" to="/pieces">Réinitialiser</Link>
        </Form>

        <div className="grid two">
          <section className="panel">
            <h2>Écritures sans justificatif</h2>
            <ul className="evidence-list">
              {entriesWithoutEvidence.slice(0, 5).map((item) => <li key={item.id}><span>{item.label}</span><Link className="btn btn-sm" to={item.href}>Voir</Link></li>)}
              {entriesWithoutEvidence.length === 0 ? <li>Aucune écriture sans justificatif rattaché.</li> : null}
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

        <div className="sec-head"><h2>Pièces déposées</h2></div>
        <TableShell>
          <table className="tbl">
            <thead><tr><th>Fichier</th><th>Statut</th><th>Facture électronique</th><th>Fournisseur</th><th>Date</th><th>TTC</th><th>Liens</th><th></th></tr></thead>
            <tbody>
              {attachments.map((attachment) => (
                <tr key={attachment.id}>
                  <td>{attachment.originalFilename}<div className="sub">{formatBytes(attachment.sizeBytes)}</div></td>
                  <td><StatusPill label={statusLabel(attachment.status)} tone={statusTone(attachment.status)} /></td>
                <td>{attachment.eInvoiceStatus ? <StatusPill label={eInvoiceStatusLabel(attachment.eInvoiceStatus)} tone={attachment.eInvoiceStatus === "ERROR" ? "error" : "info"} /> : "—"}</td>
                <td>{attachment.supplierName ?? "—"}</td>
                <td>{attachment.invoiceDate ?? "—"}</td>
                <td>{attachment.amountTtc ? formatEuro(attachment.amountTtc) : "—"}</td>
                <td>{attachment.linksCount}</td>
                <td><Link className="btn btn-sm" to={`/pieces/${attachment.id}`}>Voir la pièce</Link></td>
              </tr>
            ))}
            {attachments.length === 0 ? <tr><td colSpan={8} className="sub">Aucune pièce déposée.</td></tr> : null}
          </tbody>
        </table>
        </TableShell>
      </Main>
    </AppShell>
  );
}

function UploadZone() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Form ref={formRef} method="post" action="/api/attachments" encType="multipart/form-data">
      <input type="hidden" name="returnTo" value="/pieces" />
      <div
        className={`upload-zone${dragOver ? " drag-over" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={() => setDragOver(false)}
      >
        <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <div className="upload-label">Glissez un fichier ici ou <span>parcourir</span></div>
        <div className="upload-hint">PDF, PNG, JPG, TXT ou XML · 10 Mo max · fichiers stockés de manière sécurisée · <Link to="/privacy">confidentialité</Link></div>
        {fileName ? <div className="upload-selected">📎 {fileName}</div> : null}
        <input
          type="file"
          name="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.xml,application/pdf,image/png,image/jpeg,text/plain,application/xml,text/xml"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
        />
      </div>
      {fileName ? (
        <div className="upload-actions">
          <button className="btn btn-p" type="submit">Déposer</button>
        </div>
      ) : null}
    </Form>
  );
}

export function statusLabel(status: string) {
  return attachmentStatusLabelForUser(status);
}

export function statusTone(status: string): "ok" | "done" | "warn" | "neutral" {
  if (status === "EXTRACTED") return "done";
  if (status === "EXTRACTION_FAILED") return "warn";
  if (status === "ARCHIVED") return "neutral";
  return "ok";
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} Ko`;
  return `${(value / 1024 / 1024).toFixed(1)} Mo`;
}

function formatEuro(value: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}
