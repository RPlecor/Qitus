import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
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
          <div className="kpi"><div className="kpi-label">Total</div><span className="kpi-val">{summary.total}</span></div>
          <div className="kpi"><div className="kpi-label">Non lues</div><span className="kpi-val">{summary.unread}</span></div>
          <div className="kpi"><div className="kpi-label">Blocages</div><span className="kpi-val">{summary.blocking}</span></div>
          <div className="kpi"><div className="kpi-label">Warnings</div><span className="kpi-val">{summary.warning}</span></div>
        </div>
        <div className="sec-head">
          <div>
            <Link className="btn btn-sm" to="/notifications">Tout</Link>{" "}
            <Link className="btn btn-sm" to="/notifications?unread=1">Non lues</Link>{" "}
            <Link className="btn btn-sm" to="/notifications?severity=BLOCKING">Blocages</Link>
          </div>
          <Form method="post" action="/api/notifications/read-all">
            <button className="btn btn-sm" type="submit">Tout marquer lu</button>
          </Form>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Sévérité</th><th>Notification</th><th>Action</th><th>État</th></tr></thead>
            <tbody>
              {notifications.map((notification) => (
                <tr key={notification.id}>
                  <td className="mono">{new Date(notification.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td>{notification.severity}</td>
                  <td>
                    <strong>{notification.title}</strong>
                    <div className="sub">{notification.body}</div>
                  </td>
                  <td>
                    {notification.href ? <Link className="btn btn-sm" to={notification.href}>Ouvrir</Link> : null}{" "}
                    {!notification.read ? (
                      <Form method="post" action={`/api/notifications/${notification.id}/read`} style={{ display: "inline" }}>
                        <button className="btn btn-sm" type="submit">Lu</button>
                      </Form>
                    ) : null}{" "}
                    <Form method="post" action={`/api/notifications/${notification.id}/dismiss`} style={{ display: "inline" }}>
                      <button className="btn btn-sm" type="submit">Masquer</button>
                    </Form>
                  </td>
                  <td>{notification.dismissed ? "Masquée" : notification.read ? "Lue" : "Non lue"}</td>
                </tr>
              ))}
              {notifications.length === 0 ? <tr><td colSpan={5} className="sub">Aucune notification active.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Main>
    </AppShell>
  );
}
