import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ImportHistory } from "~/modules/import-orchestrator/import-history.server";
import { ImportOrchestrator } from "~/modules/import-orchestrator/import-orchestrator.server";
import { ExpectedRouteError, jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(_args: LoaderFunctionArgs) {
  const { fiscalYear } = await requireCompanyWorkspace(_args);
  const imports = await new ImportHistory().listImports(fiscalYear.id);
  return json({ imports });
}

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const workspace = await requireCompanyWorkspace(args);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Missing CSV file" }, { status: 400 });

  try {
    await assertFiscalYearMutable(workspace);
    const result = await new ImportOrchestrator().startCsvImport(workspace, {
      filename: file.name,
      content: await file.text(),
    });

    if (request.headers.get("accept")?.includes("application/json")) return json(result);
    if (result.execution.queued) return redirect("/imports");
    if (result.import.status === "NEEDS_MAPPING") return redirect(`/imports/${result.import.id}/mapping`);
    return redirect("/transactions");
  } catch (error) {
    return jsonOrRedirectError(request, error instanceof Error ? error : new ExpectedRouteError("Import impossible."), "/imports");
  }
}
