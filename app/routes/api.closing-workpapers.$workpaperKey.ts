import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { ClosingWorkpaperCenter } from "~/modules/closing-workpapers/closing-workpaper-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const workpaper = await new ClosingWorkpaperCenter().getWorkpaper(workspace, String(args.params.workpaperKey));
  return json({ workpaper });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    const form = await args.request.formData();
    const workpaper = await new ClosingWorkpaperCenter().saveWorkpaper(workspace, {
      workpaperKey: String(args.params.workpaperKey),
      kind: String(form.get("kind") || "FNP"),
      title: stringField(form, "title"),
      status: stringField(form, "status") || "READY",
      sourceEntityType: stringField(form, "sourceEntityType"),
      sourceEntityId: stringField(form, "sourceEntityId"),
      note: stringField(form, "note"),
      assumptions: assumptionsFromForm(form),
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ workpaper });
    return redirect(`/cloture/workpapers/${encodeURIComponent(workpaper.kind)}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/cloture/od");
  }
}

function assumptionsFromForm(form: FormData) {
  const names = ["amount", "debitAccount", "creditAccount", "basis", "requiredEvidence", "initialStock", "finalStock", "capital", "annualRate", "days"];
  return Object.fromEntries(names.map((name) => [name, form.get(name)]).filter(([, value]) => value != null && String(value).length > 0));
}

function stringField(form: FormData, name: string) {
  const value = String(form.get(name) || "").trim();
  return value || null;
}
