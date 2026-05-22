import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, KpiCard, Main, StatusPill, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { NotificationCenter } from "~/modules/notifications/notification-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const center = new NotificationCenter();
  const [notifications, summary] = await Promise.all([
    center.listNotifications(workspace, {
      type: url.searchParams.get("type"),
      severity: url.searchParams.get("severity"),
      unreadOnly: url.searchParams.get("unread") === "1",
      includeDismissed: url.searchParams.get("includeDismissed") === "1",
    }),
    center.getNotificationSummary(workspace),
  ]);
  return json({ notifications, summary });
}

export default function Notifications() {
  const { notifications, summary } = useLoaderData<typeof loader>();
  return (
    <AppShell active="notifications">
      <Main title="Notifications" subtitle={`${summary.unread} non lue${summary.unread > 1 ? "s" : ""}`}>
        <div className="kpi-grid">
          <KpiCard label="Total" value={String(summary.total)} />
          <KpiCard label="Non lues" value={String(summary.unread)} />
          <KpiCard label="Blocages" value={String(summary.blocking)} />
          <KpiCard label="Avertissements" value={String(summary.warning)} />
        </div>
        <div className="sec-head">
          <div className="row-actions">
            <Link className="btn btn-sm" to="/notifications">Tout</Link>
            <Link className="btn btn-sm" to="/notifications?unread=1">Non lues</Link>
            <Link className="btn btn-sm" to="/notifications?severity=BLOCKING">Blocages</Link>
          </div>
          <Form method="post" action="/api/notifications/read-all">
            <button className="btn btn-sm" type="submit">Tout marquer lu</button>
          </Form>
        </div>
        <TableShell>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Sévérité</th><th>Notification</th><th>Actions</th><th>État</th></tr></thead>
            <tbody>
              {notifications.map((notification) => (
                <tr key={notification.id}>
                  <td className="mono">{new Date(notification.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td><StatusPill label={severityLabel(notification.severity)} tone={severityTone(notification.severity)} /></td>
                  <td>
                    <strong>{notification.title}</strong>
                    <div className="sub">{notification.body}</div>
                  </td>
                  <td className="actions-cell">
                    <div className="row-actions row-actions-nowrap">
                      {notification.href ? <Link className="btn btn-sm" to={notification.href}>Ouvrir</Link> : null}
                      {!notification.read ? (
                        <Form method="post" action={`/api/notifications/${notification.id}/read`}>
                          <button className="btn btn-sm" type="submit">Lu</button>
                        </Form>
                      ) : null}
                      <Form method="post" action={`/api/notifications/${notification.id}/dismiss`}>
                        <button className="btn btn-sm" type="submit">Masquer</button>
                      </Form>
                    </div>
                  </td>
                  <td><StatusPill label={notification.dismissed ? "Masquée" : notification.read ? "Lue" : "Non lue"} tone={notification.dismissed ? "neutral" : notification.read ? "ok" : "warn"} /></td>
                </tr>
              ))}
              {notifications.length === 0 ? <tr><td colSpan={5} className="sub">Aucune notification active.</td></tr> : null}
            </tbody>
          </table>
        </TableShell>
      </Main>
    </AppShell>
  );
}

function severityLabel(severity: string) {
  if (severity === "BLOCKING") return "Bloquant";
  if (severity === "WARNING") return "Avertissement";
  return "Info";
}

function severityTone(severity: string): "error" | "warn" | "info" {
  if (severity === "BLOCKING") return "error";
  if (severity === "WARNING") return "warn";
  return "info";
}
