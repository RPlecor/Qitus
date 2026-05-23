import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { AppShell, Main, StatusPill, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { FiscalYearCenter } from "~/modules/fiscal-years/fiscal-year-center.server";
import { fiscalYearStatusLabel } from "~/modules/ui-labels";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json({ fiscalYears: await new FiscalYearCenter().listFiscalYears(workspace) });
}

export default function Exercices() {
  const { fiscalYears } = useLoaderData<typeof loader>();
  return (
    <AppShell active="exercices">
      <Main title="Exercices" subtitle="Multi-exercice mono-company">
        <section className="card">
          <h2>Créer un exercice</h2>
          <Form method="post" action="/api/fiscal-years" className="filter-bar">
            <div className="field"><label>Début</label><input type="date" name="startDate" required /></div>
            <div className="field"><label>Fin</label><input type="date" name="endDate" required /></div>
            <button className="btn btn-p" type="submit">Créer</button>
          </Form>
        </section>
        <div className="sec-head"><h2>Exercices disponibles</h2></div>
        <TableShell>
          <table className="tbl">
            <thead><tr><th>Période</th><th>Statut</th><th>Imports</th><th>Transactions</th><th>Écritures</th><th>Documents</th><th></th></tr></thead>
            <tbody>
              {fiscalYears.map((fiscalYear) => (
                <tr key={fiscalYear.id}>
                  <td>{formatDate(fiscalYear.startDate)} → {formatDate(fiscalYear.endDate)}</td>
                  <td><StatusPill label={fiscalYear.active ? "Actif" : fiscalYearStatusLabel(fiscalYear.status)} tone={fiscalYear.active ? "ok" : "neutral"} /></td>
                  <td className="mono">{fiscalYear.counters.imports}</td>
                  <td className="mono">{fiscalYear.counters.transactions}</td>
                  <td className="mono">{fiscalYear.counters.journalEntries}</td>
                  <td className="mono">{fiscalYear.counters.documents}</td>
                  <td>
                    {!fiscalYear.active ? (
                      <Form method="post" action={`/api/fiscal-years/${fiscalYear.id}/activate?redirectTo=/exercices`}>
                        <button className="btn btn-sm" type="submit">Activer</button>
                      </Form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </Main>
    </AppShell>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}
