import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { ClosingWorkpaperCenter } from "~/modules/closing-workpapers/closing-workpaper-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const center = new ClosingWorkpaperCenter();
  const [workpapers, summary, kinds] = await Promise.all([
    center.listWorkpapers(workspace, { kind: url.searchParams.get("kind"), includeArchived: url.searchParams.get("includeArchived") === "1" }),
    center.summarizeWorkpapers(workspace),
    center.getAvailableKinds(),
  ]);
  return json({ workpapers, summary, kinds });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    const form = await args.request.formData();
    const workpaper = await new ClosingWorkpaperCenter().saveWorkpaper(workspace, {
      workpaperKey: stringField(form, "workpaperKey"),
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
