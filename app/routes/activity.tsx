import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main, TableShell } from "~/components/ui";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { activityEntityTypeLabel } from "~/modules/ui-labels";

export async function loader(args: LoaderFunctionArgs) {
  const { request } = args;
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(request.url);
  const filters = {
    type: url.searchParams.get("type"),
    action: url.searchParams.get("action"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    pageSize: Number(url.searchParams.get("limit") || 100),
  };
  const activity = await new ActivityLogCenter().getTimeline(workspace, filters);
  return json({ activity, filters });
}

export default function Activity() {
  const { activity, filters } = useLoaderData<typeof loader>();
  const exportParams = new URLSearchParams();
  if (filters.type) exportParams.set("type", filters.type);
  if (filters.action) exportParams.set("action", filters.action);
  if (filters.from) exportParams.set("from", filters.from);
  if (filters.to) exportParams.set("to", filters.to);
  const exportUrl = `/api/activity-log/export${exportParams.size ? `?${exportParams.toString()}` : ""}`;

  return (
    <AppShell active="activity">
      <Main title="Activité" subtitle="Historique des actions Qitus" backLink={{ label: "Paramètres", href: "/parametres" }} action={<Link className="btn" to={exportUrl}>Exporter CSV</Link>}>
        <div className="sec-head">
          <h2>Historique</h2>
          <div>
            <Link className="btn btn-sm" to="/activity">Tout</Link>{" "}
            <Link className="btn btn-sm" to="/activity?type=document">Documents</Link>{" "}
            <Link className="btn btn-sm" to="/activity?type=import">Imports</Link>{" "}
            <Link className="btn btn-sm" to="/api/activity-log/audit">Exporter l'audit</Link>
          </div>
        </div>
        <Form className="card filter-bar" method="get">
          <div className="field"><label>Type</label><input name="type" defaultValue={filters.type ?? ""} placeholder="document, import..." /></div>
          <div className="field"><label>Action</label><input name="action" defaultValue={filters.action ?? ""} placeholder="document généré" /></div>
          <div className="field"><label>Depuis</label><input type="date" name="from" defaultValue={filters.from ?? ""} /></div>
          <div className="field"><label>Jusqu'à</label><input type="date" name="to" defaultValue={filters.to ?? ""} /></div>
          <button className="btn" type="submit">Filtrer</button>
        </Form>
        <TableShell>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Action</th><th>Type</th><th>Exercice</th><th>Détail</th><th>Complément</th></tr></thead>
            <tbody>
              {activity.map((item) => (
                <tr key={item.id}>
                  <td className="mono">{formatDateTime(item.createdAt)}</td>
                  <td>{item.label}</td>
                  <td>{activityEntityTypeLabel(item.entityType)}</td>
                  <td className="mono">{item.fiscalYearId ? item.fiscalYearId.slice(-6) : "—"}</td>
                  <td>{item.detail || "—"}</td>
                  <td className="mono metadata-cell wrap-anywhere">{item.metadataText || "—"}</td>
                </tr>
              ))}
              {activity.length === 0 ? (
                <tr><td colSpan={6} className="sub">Aucun événement enregistré.</td></tr>
              ) : null}
            </tbody>
          </table>
        </TableShell>
      </Main>
    </AppShell>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}
