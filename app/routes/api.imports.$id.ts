import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ImportCleanupCenter } from "~/modules/import-orchestrator/import-cleanup-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    const result = await new ImportCleanupCenter().deleteImport(workspace, {
      importId: String(params.id),
      confirmation: await readConfirmation(request),
    });
    if (request.headers.get("accept")?.includes("application/json")) return json({ result });
    return redirect(`/imports?deleted=${encodeURIComponent(`${result.importCount} import supprimé`)}`);
  } catch (error) {
    return jsonOrRedirectError(request, error, "/imports");
  }
}

async function readConfirmation(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return String(body.confirmation ?? "");
  }
  const form = await request.formData();
  return String(form.get("confirmation") ?? "");
}
