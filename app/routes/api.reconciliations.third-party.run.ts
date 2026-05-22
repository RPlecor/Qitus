import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ThirdPartyMatchingCenter } from "~/modules/reconciliations/third-party-matching-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    const summary = await new ThirdPartyMatchingCenter().runThirdPartyMatching(workspace);
    await new ActivityLogCenter().recordActivity(workspace, { action: "reconciliation.third_party_run", entityType: "reconciliation", metadata: { status: summary.status } });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ summary });
    return redirect("/rapprochements/tiers");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/rapprochements/tiers");
  }
}
