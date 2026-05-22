import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ImportOrchestrator } from "~/modules/import-orchestrator/import-orchestrator.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    const result = await new ImportOrchestrator().retryImport(workspace, String(params.id));
    if (request.headers.get("accept")?.includes("application/json")) return json(result);
    return redirect("/imports");
  } catch (error) {
    return jsonOrRedirectError(request, error, "/imports");
  }
}
