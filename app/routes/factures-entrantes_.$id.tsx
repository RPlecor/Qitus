import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main, StatusPill, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceCenter } from "~/modules/e-invoices/e-invoice-center.server";
import { EInvoiceMatchingCenter } from "~/modules/e-invoices/e-invoice-matching-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const id = String(args.params.id);
  const [invoice, matches] = await Promise.all([
    new EInvoiceCenter().getEInvoiceDetail(workspace, id),
    new EInvoiceMatchingCenter().suggestMatches(workspace, id),
  ]);
  return json({ invoice, matches, query: Object.fromEntries(new URL(args.request.url).searchParams) });
}

export default function FactureEntranteDetail() {
  const { invoice, matches, query } = useLoaderData<typeof loader>();
  const latestDraft = invoice.accountingDrafts[0] ?? null;
  return (
    <AppShell active="factures-entrantes">
      <Main title={invoice.supplierName ?? "Facture entrante"} subtitle={invoice.invoiceNumber ?? "Facture électronique"}>
        <div className="row-actions">
          <Link className="btn" to="/factures-entrantes">← Retour</Link>
          {invoice.attachment ? <Link className="btn" to={`/pieces/${invoice.attachment.id}`}>Voir la pièce</Link> : null}
        </div>
        {query.success ? <div className="alert blue"><strong>{query.success}</strong></div> : null}
        {query.error ? <div className="alert red"><strong>{query.error}</strong></div> : null}

        <section className="panel">
          <div className="sec-head">
            <div>
              <h2>Données extraites</h2>
              <p className="sub">Source structurée conservée dans le paquet de preuve.</p>
            </div>
            <StatusPill label={statusLabel(invoice.status)} tone={invoice.status === "ERROR" ? "error" : invoice.status === "ACCOUNTED" ? "done" : "neutral"} />
          </div>
          {invoice.errorMessage ? <div className="alert red">{invoice.errorMessage}</div> : null}
          <div className="grid two">
            <div className="kv"><span>Fournisseur</span><strong>{invoice.supplierName ?? "—"}</strong></div>
            <div className="kv"><span>SIRET fournisseur</span><strong>{invoice.supplierSiret ?? "—"}</strong></div>
            <div className="kv"><span>Numéro</span><strong>{invoice.invoiceNumber ?? "—"}</strong></div>
            <div className="kv"><span>Date</span><strong>{invoice.issueDate ?? "—"}</strong></div>
            <div className="kv"><span>HT</span><strong>{invoice.amountHt ? formatEuro(invoice.amountHt) : "—"}</strong></div>
            <div className="kv"><span>TVA</span><strong>{invoice.amountVat ? formatEuro(invoice.amountVat) : "—"}</strong></div>
            <div className="kv"><span>TTC</span><strong>{invoice.amountTtc ? formatEuro(invoice.amountTtc) : "—"}</strong></div>
            <div className="kv"><span>Format</span><strong>{invoice.format}</strong></div>
          </div>
        </section>

        <section className="panel">
          <div className="sec-head">
            <div>
              <h2>Brouillon comptable</h2>
              <p className="sub">Aucune écriture existante n’est modifiée automatiquement.</p>
            </div>
            <Form method="post" action={`/api/e-invoices/${invoice.id}/accounting-draft`}>
              <button className="btn btn-p" type="submit">Créer / mettre à jour le brouillon</button>
            </Form>
          </div>
          {latestDraft ? (
            <>
              <StatusPill label={latestDraft.status} tone={latestDraft.status === "APPROVED" ? "done" : latestDraft.status === "REJECTED" ? "warn" : "ok"} />
              <TableShell>
                <table className="tbl">
                  <thead><tr><th>Compte</th><th>Libellé</th><th className="r">Débit</th><th className="r">Crédit</th></tr></thead>
                  <tbody>
                    {draftLines(latestDraft.proposedJournalEntry).map((line, index) => (
                      <tr key={`${line.account}-${index}`}>
                        <td className="mono">{line.account}</td>
                        <td>{line.accountLabel}</td>
                        <td className="r mono">{line.debit ? formatEuro(String(line.debit)) : "—"}</td>
                        <td className="r mono">{line.credit ? formatEuro(String(line.credit)) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
              <div className="row-actions">
                <Form method="post" action={`/api/e-invoices/${invoice.id}/approve-accounting`}>
                  <input type="hidden" name="draftId" value={latestDraft.id} />
                  <button className="btn btn-p" type="submit" disabled={latestDraft.status === "APPROVED"}>Approuver l’écriture</button>
                </Form>
                <Form method="post" action={`/api/e-invoices/${invoice.id}/reject-accounting`} className="row-actions">
                  <input type="hidden" name="draftId" value={latestDraft.id} />
                  <input name="note" placeholder="Motif du rejet" />
                  <button className="btn" type="submit" disabled={latestDraft.status === "APPROVED"}>Rejeter</button>
                </Form>
                {latestDraft.journalEntryId ? <Link className="btn" to="/ecritures?source=E_INVOICE">Voir l’écriture</Link> : null}
              </div>
            </>
          ) : <p className="sub">Aucun brouillon comptable généré.</p>}
        </section>

        <section className="panel">
          <h2>Suggestions de rapprochement</h2>
          <TableShell>
            <table className="tbl">
              <thead><tr><th>Cible</th><th>Date</th><th>Montant</th><th>Score</th><th>Raisons</th><th></th></tr></thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={`${match.entityType}-${match.entityId}`}>
                    <td><Link to={match.href}>{match.label}</Link><div className="sub">{match.entityType}</div></td>
                    <td>{match.date ?? "—"}</td>
                    <td>{match.amount ? formatEuro(match.amount) : "—"}</td>
                    <td>{match.score}</td>
                    <td>{match.reasons.join(", ")}</td>
                    <td>
                      <Form method="post" action={`/api/e-invoices/${invoice.id}/match`}>
                        <input type="hidden" name="entityType" value={match.entityType} />
                        <input type="hidden" name="entityId" value={match.entityId} />
                        <button className="btn btn-sm" type="submit">Rattacher</button>
                      </Form>
                    </td>
                  </tr>
                ))}
                {matches.length === 0 ? <tr><td colSpan={6} className="sub">Aucun rapprochement probable.</td></tr> : null}
              </tbody>
            </table>
          </TableShell>
        </section>
      </Main>
    </AppShell>
  );
}

function statusLabel(status: string) {
  if (status === "ACCOUNTED") return "Comptabilisée";
  if (status === "ACCOUNTING_DRAFT") return "Brouillon prêt";
  if (status === "MATCHED") return "Rapprochée";
  if (status === "ERROR") return "Erreur";
  return status;
}

function draftLines(value: unknown): Array<{ account: string; accountLabel: string; debit: number; credit: number }> {
  const record = value as { lines?: Array<{ account: string; accountLabel: string; debit: number; credit: number }> };
  return Array.isArray(record?.lines) ? record.lines : [];
}

function formatEuro(value: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}
