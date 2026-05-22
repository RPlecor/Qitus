import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, ButtonLink, KpiCard, Main, StatusBadge, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { TransactionExplorer } from "~/modules/transactions/transaction-explorer.server";
import { TransactionFilterStateCenter, type TransactionFilterState } from "~/modules/transactions/transaction-filter-state";
import { TransactionReviewQueue } from "~/modules/transactions/transaction-review-queue.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const filters = new TransactionFilterStateCenter();
  const filterState = filters.parseFromUrl(url);
  const [result, queueSummary] = await Promise.all([
    new TransactionExplorer().listTransactions(workspace, filters.toExplorerQuery(filterState)),
    new TransactionReviewQueue().summarizeQueue(workspace, filterState),
  ]);
  return json({
    ...result,
    filterState,
    activeFilterLabels: filters.describeActiveFilters(filterState),
    queueSummary,
  });
}

export default function Transactions() {
  const { transactions, page, totalPages, total, facets, filterState, activeFilterLabels, queueSummary } = useLoaderData<typeof loader>();
  const filters = new TransactionFilterStateCenter();
  const detailParams = filters.toUrlParams(filterState).toString();
  const emptyMessage = emptyStateMessage(facets.total, total, filterState);

  return (
    <AppShell active="transactions">
      <Main
        title="Transactions"
        subtitle={`${facets.total} transaction${facets.total > 1 ? "s" : ""} importée${facets.total > 1 ? "s" : ""} · ${total} affichée${total > 1 ? "s" : ""}`}
        action={<ButtonLink to="/corrections">Règles</ButtonLink>}
      >
        <Form method="get" className="card">
          <div className="form-row">
            <div className="field">
              <label htmlFor="transaction-search">Recherche</label>
              <input id="transaction-search" name="search" placeholder="Libellé, contrepartie, référence..." defaultValue={filterState.search} />
            </div>
            <div className="field">
              <label htmlFor="transaction-status">Statut</label>
              <select id="transaction-status" name="status" defaultValue={filterState.status}>
                <option value="all">Toutes</option>
                <option value="review">À vérifier</option>
                <option value="categorized">Catégorisées</option>
                <option value="confirmed">Confirmées</option>
                <option value="corrected">Corrigées</option>
                <option value="has_rule">Avec règle</option>
              </select>
            </div>
            <div className="field"><label htmlFor="transaction-date-from">Du</label><input id="transaction-date-from" type="date" name="dateFrom" defaultValue={filterState.dateFrom} /></div>
            <div className="field"><label htmlFor="transaction-date-to">Au</label><input id="transaction-date-to" type="date" name="dateTo" defaultValue={filterState.dateTo} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="transaction-account">Compte</label><input id="transaction-account" name="account" placeholder="6135, 471..." defaultValue={filterState.account} /></div>
            <div className="field">
              <label htmlFor="transaction-direction">Sens</label>
              <select id="transaction-direction" name="direction" defaultValue={filterState.direction}>
                <option value="all">Tous</option>
                <option value="debit">Décaissements</option>
                <option value="credit">Encaissements</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="transaction-page-size">Par page</label>
              <select id="transaction-page-size" name="pageSize" defaultValue={filterState.pageSize}>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="field">
              <label>&nbsp;</label>
              <div className="row-actions">
                <button className="btn btn-p" type="submit">Filtrer</button>
                <Link className="btn" to="/transactions">Réinitialiser</Link>
              </div>
            </div>
          </div>
        </Form>

        {activeFilterLabels.length > 0 ? (
          <div className="filter-chips">
            {activeFilterLabels.map((filter) => <span key={filter.key} className="chip">{filter.label}</span>)}
          </div>
        ) : null}

        <div className="kpi-grid">
          <KpiCard label="Total" value={String(facets.total)} />
          <KpiCard label="À vérifier" value={String(facets.review)} />
          <KpiCard label="Corrigées" value={String(facets.corrected)} />
          <KpiCard label="Avec règle" value={String(facets.hasRule)} />
        </div>

        {filterState.status === "review" && queueSummary.empty ? (
          <div className="alert blue"><strong>Aucune transaction à corriger</strong><span>La file de revue est vide pour ces filtres.</span></div>
        ) : null}

        <TableShell>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Libellé</th><th>Compte</th><th className="r">Montant</th><th>Statut</th><th>Règle</th><th></th></tr></thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="mono">{formatShortDate(transaction.date)}</td>
                  <td>{transaction.label}</td>
                  <td><span className="cpt">{transaction.account}</span></td>
                  <td className="r mono">{formatEuro(transaction.amount)}</td>
                  <td><StatusBadge status={transaction.needsReview ? "warn" : "ok"} /></td>
                  <td>{transaction.hasRule ? "Oui" : "—"}</td>
                  <td><Link className="btn btn-sm" to={`/transactions/${transaction.id}?${detailParams}`}>{transaction.needsReview ? "Corriger" : "Voir"}</Link></td>
                </tr>
              ))}
              {transactions.length === 0 ? (
                <tr><td colSpan={7} className="sub">{emptyMessage}</td></tr>
              ) : null}
            </tbody>
          </table>
        </TableShell>

        <div className="form-actions">
          <ButtonLink to={`/transactions?${filters.toUrlParams(filterState as TransactionFilterState, { page: page - 1 }).toString()}`}>← Précédent</ButtonLink>
          <span className="sub">Page {page} / {totalPages}</span>
          <ButtonLink to={`/transactions?${filters.toUrlParams(filterState as TransactionFilterState, { page: page + 1 }).toString()}`}>Suivant →</ButtonLink>
        </div>
      </Main>
    </AppShell>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(value));
}

function formatEuro(value: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}

function emptyStateMessage(totalImported: number, filteredTotal: number, filterState: TransactionFilterState) {
  if (totalImported === 0) return "Aucune transaction importée.";
  if (filterState.status === "review" && filteredTotal === 0) return "Aucune transaction à corriger.";
  return "Aucune transaction ne correspond aux filtres.";
}
