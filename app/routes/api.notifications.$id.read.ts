import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { NotificationCenter } from "~/modules/notifications/notification-center.server";
import { ExpectedRouteError, jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    if (!args.params.id) throw new ExpectedRouteError("Notification manquante.", 400);
    const notification = await new NotificationCenter().markAsRead(workspace, args.params.id);
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ notification });
    return redirect("/notifications");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/notifications");
  }
}
