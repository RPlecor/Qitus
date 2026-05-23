import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, ButtonLink, KpiCard, Main, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EvidenceControlCenter } from "~/modules/evidence/evidence-control-center.server";
import { entriesWithoutEvidenceLabel, orphanAttachmentsLabel } from "~/modules/evidence/evidence-wording";
import { JournalAuditCenter } from "~/modules/journal/journal-audit-center.server";
import { JournalExplorer, type JournalExplorerQuery } from "~/modules/journal/journal-explorer.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const query = queryFromUrl(new URL(args.request.url));
  const [result, audit, evidence] = await Promise.all([
    new JournalExplorer().listEntries(workspace, query),
    new JournalAuditCenter().getAuditSummary(workspace),
    new EvidenceControlCenter().getEvidenceReview(workspace),
  ]);
  return json({ ...result, audit, evidence, query });
}

export default function Ecritures() {
  const { entries, page, totalPages, summary, facets, audit, evidence, query } = useLoaderData<typeof loader>();

  return (
    <AppShell active="ecritures">
      <Main
        title="Écritures"
        subtitle={`${summary.entriesCount} écriture${summary.entriesCount > 1 ? "s" : ""} · ${summary.linesCount} ligne${summary.linesCount > 1 ? "s" : ""}`}
        action={<a className="btn" href={`/api/journal-entries/export?${exportParams(query)}`}>Exporter CSV</a>}
      >
        <div className="dash-notices">
          <div className={`notice-item ${audit.status === "exportable" ? "notice-ok" : "notice-warn"}`}>
            <span className={`notice-dot ${audit.status === "exportable" ? "ok" : "orange"}`} />
            <span>{audit.label} — {audit.issueCount === 0 ? "aucune anomalie" : <strong>{audit.issueCount} anomalie{audit.issueCount > 1 ? "s" : ""}</strong>}</span>
          </div>
          <div className={`notice-item ${evidence.requiredMissing === 0 ? "notice-ok" : "notice-warn"}`}>
            <span className={`notice-dot ${evidence.requiredMissing === 0 ? "ok" : "orange"}`} />
            <span>{evidence.requiredMissing === 0 ? `Justificatifs couverts — ${orphanAttachmentsLabel(evidence.orphanAttachments)}` : <strong>{entriesWithoutEvidenceLabel(evidence.requiredMissing)}</strong>}</span>
          </div>
          {audit.issues.slice(0, 3).map((issue) => (
            <div key={`${issue.code}-${issue.entryId}`} className="notice-item notice-warn">
              <span className="notice-dot orange" />
              <span>Écriture {issue.entryNum} — {issue.detail}</span>
            </div>
          ))}
        </div>
        <Form method="get" className="card">
          <div className="form-row">
            <div className="field">
              <label htmlFor="journal-filter">Journal</label>
              <select id="journal-filter" name="journal" defaultValue={query.journal ?? ""}>
                <option value="">Tous</option>
                {facets.journals.map((journal) => <option key={journal} value={journal}>{journal}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="source-filter">Source</label>
              <select id="source-filter" name="source" defaultValue={query.source ?? "all"}>
                <option value="all">Toutes</option>
                {facets.sources.map((source) => <option key={source} value={source}>{sourceLabel(source)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="account-filter">Compte</label><input id="account-filter" name="account" defaultValue={query.account ?? ""} placeholder="5121, 471..." /></div>
            <div className="field"><label htmlFor="search-filter">Recherche</label><input id="search-filter" name="search" defaultValue={query.search ?? ""} placeholder="Libellé écriture" /></div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="date-from-filter">Du</label><input id="date-from-filter" type="date" name="dateFrom" defaultValue={query.dateFrom ?? ""} /></div>
            <div className="field"><label htmlFor="date-to-filter">Au</label><input id="date-to-filter" type="date" name="dateTo" defaultValue={query.dateTo ?? ""} /></div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="page-size-filter">Par page</label>
              <select id="page-size-filter" name="pageSize" defaultValue={query.pageSize ?? 50}>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="field">
              <label>&nbsp;</label>
              <div className="row-actions">
                <button className="btn btn-p" type="submit">Filtrer</button>
                <Link className="btn" to="/ecritures">Réinitialiser les filtres</Link>
              </div>
            </div>
          </div>
        </Form>

        <div className="kpi-grid">
          <KpiCard label="Débit" value={formatEuro(summary.debitTotal)} />
          <KpiCard label="Crédit" value={formatEuro(summary.creditTotal)} />
          <KpiCard label="Équilibre" value={summary.balanced ? "Équilibré" : "À vérifier"} />
          <KpiCard label="Page" value={`${page}/${totalPages}`} />
        </div>

        <TableShell>
          <table className="tbl">
            <thead><tr><th>N°</th><th>Date</th><th>Journal</th><th>Source</th><th>Libellé</th><th>Compte</th><th className="r">Débit</th><th className="r">Crédit</th></tr></thead>
            <tbody>
              {entries.flatMap((entry) =>
                entry.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="mono">{entry.num}</td>
                    <td className="mono">{formatShortDate(entry.date)}</td>
                    <td>{entry.journal}</td>
                    <td>{sourceLabel(entry.source)}</td>
                    <td>{entry.label}</td>
                    <td><span className="cpt">{line.account}</span></td>
                    <td className="r mono">{formatLedgerAmount(line.debit)}</td>
                    <td className="r mono">{formatLedgerAmount(line.credit)}</td>
                  </tr>
                ))
              )}
              {summary.linesCount === 0 ? (
                <tr><td colSpan={8} className="sub">Aucune écriture générée.</td></tr>
              ) : null}
            </tbody>
          </table>
        </TableShell>
        <div className="form-actions">
          <ButtonLink to={`/ecritures?${pageParams(query, page - 1)}`}>← Précédent</ButtonLink>
          <span className="sub">Page {page} / {totalPages}</span>
          <ButtonLink to={`/ecritures?${pageParams(query, page + 1)}`}>Suivant →</ButtonLink>
        </div>
      </Main>
    </AppShell>
  );
}

function queryFromUrl(url: URL): JournalExplorerQuery {
  return {
    page: Number(url.searchParams.get("page") || 1),
    pageSize: Number(url.searchParams.get("pageSize") || 50),
    journal: url.searchParams.get("journal"),
    source: url.searchParams.get("source") as never,
    account: url.searchParams.get("account"),
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
    search: url.searchParams.get("search"),
  };
}

function pageParams(query: JournalExplorerQuery, page: number) {
  const params = new URLSearchParams(exportParams({ ...query, page: Math.max(1, page) }));
  return params.toString();
}

function exportParams(query: JournalExplorerQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value && value !== "all") params.set(key, String(value));
  }
  params.set("format", "csv");
  return params.toString();
}

function sourceLabel(source: string) {
  if (source === "CLOSING_ADJUSTMENT") return "Clôture";
  if (source === "MANUAL") return "Manuel";
  if (source === "E_INVOICE") return "Facture électronique";
  return "Import";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(value));
}

function formatLedgerAmount(value: string) {
  const amount = Number(value);
  if (amount === 0) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
