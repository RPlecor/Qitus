import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { ClosingAdjustmentCenter } from "~/modules/closing-adjustments/closing-adjustment-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const workspace = await requireCompanyWorkspace(args);
  const form = await request.formData();
  try {
    await assertFiscalYearMutable(workspace);
    const proposal = await new ClosingAdjustmentCenter().saveProposalAssumptions(workspace, {
      proposalKey: String(params.proposalKey),
      assumptions: Object.fromEntries(form.entries()),
    });
    if (request.headers.get("accept")?.includes("application/json")) return json({ proposal });
    return redirect(`/controle/od/${encodeURIComponent(proposal.proposalKey)}`);
  } catch (error) {
    return jsonOrRedirectError(request, error, "/controle");
  }
}
