import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { AnnualClosingCenter } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData().catch(() => new FormData());
  try {
    const overview = await new AnnualClosingCenter().reopenFiscalYear(workspace, String(form.get("reason") || "Réouverture de l'exercice"));
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ overview });
    return redirect("/cloture");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/cloture");
  }
}
