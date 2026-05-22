import { json, type LoaderFunctionArgs } from "@remix-run/node";
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
      limit: Number(url.searchParams.get("limit") || 100),
    }),
    center.getNotificationSummary(workspace),
  ]);
  return json({ notifications, summary });
}
