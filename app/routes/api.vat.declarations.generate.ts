import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";
import { VatDeclarationCenter } from "~/modules/vat/vat-declaration-center.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const returnTo = String(form.get("returnTo") || "/tva");
  try {
    await assertFiscalYearMutable(workspace);
    const result = await new VatDeclarationCenter().generateDraft(workspace, {
      type: parseType(form.get("type")),
      dateFrom: stringOrNull(form.get("dateFrom")),
      dateTo: stringOrNull(form.get("dateTo")),
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json(result);
    return redirect(`/tva/${result.declaration.id}?success=${encodeURIComponent("Déclaration TVA générée")}`);
  } catch (error) {
    await new ActivityLogCenter().recordActivity(workspace, {
      action: "vat.declaration_blocked",
      entityType: "vat_declaration",
      entityId: workspace.fiscalYear.id,
      metadata: { message: error instanceof Error ? error.message : String(error) },
    });
    return jsonOrRedirectError(args.request, error, returnTo);
  }
}

function parseType(value: FormDataEntryValue | null) {
  const text = String(value || "");
  return text === "CA3" || text === "CA12" ? text : null;
}

function stringOrNull(value: FormDataEntryValue | null) {
  const text = String(value || "");
  return text || null;
}
