import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ImportOrchestrator } from "~/modules/import-orchestrator/import-orchestrator.server";
import type { ColumnMapping } from "~/modules/import-pipeline/types";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    const mapping = await readMapping(request);
    const result = await new ImportOrchestrator().continueWithColumnMapping(workspace, String(params.id), mapping);
    if (request.headers.get("accept")?.includes("application/json")) return json(result);
    return redirect(result.import.status === "NEEDS_MAPPING" ? `/imports/${params.id}/mapping` : "/transactions");
  } catch (error) {
    return jsonOrRedirectError(request, error, `/imports/${params.id}/mapping`);
  }
}

async function readMapping(request: Request): Promise<ColumnMapping> {
  if (request.headers.get("content-type")?.includes("application/json")) {
    return await request.json();
  }
  const form = await request.formData();
  return {
    date: String(form.get("date") ?? ""),
    label: String(form.get("label") ?? ""),
    amount: String(form.get("amount") ?? ""),
    counterparty: optional(form.get("counterparty")),
    sourceId: optional(form.get("sourceId")),
    sourceRef: optional(form.get("sourceRef")),
    sourceCategory: optional(form.get("sourceCategory")),
  };
}

function optional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}
