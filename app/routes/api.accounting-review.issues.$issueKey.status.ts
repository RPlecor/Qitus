import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { AccountingIssueTracker } from "~/modules/accounting-issues/accounting-issue-tracker.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const workspace = await requireCompanyWorkspace(args);
  const form = await request.formData();
  const status = String(form.get("status") || "OPEN");
  const redirectTo = String(form.get("redirectTo") || "/controle");

  try {
    const issue = await new AccountingIssueTracker().setIssueStatus(workspace, {
      issueKey: String(params.issueKey),
      status: status === "RESOLVED" || status === "IGNORED" ? status : "OPEN",
      note: String(form.get("note") || ""),
    });
    if (request.headers.get("accept")?.includes("application/json")) return json({ issue });
    return redirect(redirectTo);
  } catch (error) {
    return jsonOrRedirectError(request, error, redirectTo);
  }
}
