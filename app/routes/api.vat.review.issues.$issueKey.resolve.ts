import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";
import { VatReviewWorkflow } from "~/modules/vat/vat-review-workflow.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const returnTo = "/tva/revue";
  try {
    await assertFiscalYearMutable(workspace);
    const form = await args.request.formData();
    const result = await new VatReviewWorkflow().resolveIssue(workspace, {
      issueKey: String(args.params.issueKey || ""),
      vatRate: stringOrNull(form.get("vatRate")),
      vatOperationNature: stringOrNull(form.get("vatOperationNature")),
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json(result);
    return redirect(`/tva/revue?success=${encodeURIComponent("Point TVA résolu")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, returnTo);
  }
}

function stringOrNull(value: FormDataEntryValue | null) {
  const text = String(value || "");
  return text || null;
}
