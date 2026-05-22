import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { NotificationCenter } from "~/modules/notifications/notification-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    await new NotificationCenter().markAllAsRead(workspace);
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ ok: true });
    return redirect("/notifications");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/notifications");
  }
}
