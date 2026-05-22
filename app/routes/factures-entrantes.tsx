import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, KpiCard, Main, StatusPill, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceCenter } from "~/modules/e-invoices/e-invoice-center.server";
import { EInvoiceProviderCenter } from "~/modules/e-invoices/e-invoice-provider-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const [invoices, provider] = await Promise.all([
    new EInvoiceCenter().listEInvoices(workspace, { status: url.searchParams.get("status") }),
    new EInvoiceProviderCenter().getStatus(workspace),
  ]);
  return json({ invoices, provider, query: Object.fromEntries(url.searchParams) });
}

export default function FacturesEntrantes() {
  const { invoices, provider, query } = useLoaderData<typeof loader>();
  const pending = invoices.filter((invoice) => !["ACCOUNTED", "ARCHIVED"].includes(invoice.status)).length;
  return (
    <AppShell active="factures-entrantes">
      <Main title="Factures entrantes" subtitle="Factures électroniques fournisseurs et brouillons comptables">
        {query.success ? <div className="alert blue"><strong>{query.success}</strong></div> : null}
        {query.error ? <div className="alert red"><strong>{query.error}</strong></div> : null}
        <div className="kpi-grid">
          <KpiCard label="Factures" value={String(invoices.length)} hint="Exercice actif" />
          <KpiCard label="À traiter" value={String(pending)} hint="Parsing, matching ou brouillon" />
          <KpiCard label="Comptabilisées" value={String(invoices.filter((invoice) => invoice.status === "ACCOUNTED").length)} />
          <KpiCard label="Provider" value={provider.provider} hint={provider.configured ? "Configuré" : "Désactivé"} />
        </div>

        <section className="panel">
          <div className="sec-head">
            <div>
              <h2>Réception automatique</h2>
              <p className="sub">{provider.readiness.message} · {provider.safeMessage}</p>
            </div>
            <div className="row-actions">
              <Form method="post" action="/api/e-invoice-providers/connect">
                <button className="btn" type="submit" disabled={provider.mode === "disabled"}>Connecter / rattacher PA</button>
              </Form>
              <Form method="post" action="/api/e-invoice-providers/sync">
                <button className="btn btn-p" type="submit" disabled={provider.mode === "disabled"}>Synchroniser</button>
              </Form>
            </div>
          </div>
          <div className="grid two">
            <div className="kv"><span>Provider</span><strong>{provider.providerLabel ?? provider.provider}</strong></div>
            <div className="kv"><span>Réception conforme PA</span><strong>{provider.readiness.receptionCompliant ? "Oui" : "Non"}</strong></div>
          </div>
        </section>

        <Form method="get" className="card filter-bar">
          <div className="field">
            <label>Statut</label>
            <select name="status" defaultValue={query.status ?? ""}>
              <option value="">Toutes actives</option>
              <option value="PARSED">Parsées</option>
              <option value="MATCHED">Rapprochées</option>
              <option value="ACCOUNTING_DRAFT">Brouillon prêt</option>
              <option value="ACCOUNTED">Comptabilisées</option>
              <option value="ERROR">Erreur</option>
            </select>
          </div>
          <button className="btn" type="submit">Filtrer</button>
          <Link className="btn btn-ghost" to="/factures-entrantes">Réinitialiser</Link>
        </Form>

        <TableShell>
          <table className="tbl">
            <thead><tr><th>Fournisseur</th><th>Provenance</th><th>N°</th><th>Date</th><th>Format</th><th>Statut</th><th className="r">HT</th><th className="r">TVA</th><th className="r">TTC</th><th></th></tr></thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.supplierName ?? "—"}<div className="sub">{invoice.attachmentFilename ?? invoice.source}</div></td>
                  <td>{sourceLabel(invoice)}<div className="sub">{invoice.providerStatus ? `Statut PA ${invoice.providerStatus}` : "—"}</div></td>
                  <td className="mono">{invoice.invoiceNumber ?? "—"}</td>
                  <td className="mono">{invoice.issueDate ?? "—"}</td>
                  <td>{formatLabel(invoice.format)}</td>
                  <td><StatusPill label={statusLabel(invoice.status)} tone={statusTone(invoice.status)} /></td>
                  <td className="r mono">{invoice.amountHt ? formatEuro(invoice.amountHt) : "—"}</td>
                  <td className="r mono">{invoice.amountVat ? formatEuro(invoice.amountVat) : "—"}</td>
                  <td className="r mono">{invoice.amountTtc ? formatEuro(invoice.amountTtc) : "—"}</td>
                  <td><Link className="btn btn-sm" to={`/factures-entrantes/${invoice.id}`}>Ouvrir</Link></td>
                </tr>
              ))}
              {invoices.length === 0 ? <tr><td colSpan={10} className="sub">Aucune facture électronique entrante. Déposez un XML/Factur-X dans Pièces ou synchronisez le provider mock.</td></tr> : null}
            </tbody>
          </table>
        </TableShell>
      </Main>
    </AppShell>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    RECEIVED: "Reçue",
    PARSED: "Parsée",
    MATCHED: "Rapprochée",
    ACCOUNTING_DRAFT: "Brouillon",
    ACCOUNTED: "Comptabilisée",
    NEEDS_REVIEW: "À revoir",
    ERROR: "Erreur",
  };
  return labels[status] ?? status;
}

function statusTone(status: string): "ok" | "done" | "warn" | "error" | "neutral" {
  if (status === "ACCOUNTED") return "done";
  if (status === "ERROR") return "error";
  if (status === "NEEDS_REVIEW") return "warn";
  if (status === "ACCOUNTING_DRAFT") return "ok";
  return "neutral";
}

function formatLabel(value: string) {
  if (value === "FACTUR_X") return "Factur-X";
  return value;
}

function sourceLabel(invoice: { source: string; providerLabel?: string | null }) {
  if (invoice.source === "UPLOAD") return "Upload manuel";
  return invoice.providerLabel ? `PA ${invoice.providerLabel}` : "Provider PA";
}

function formatEuro(value: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}
