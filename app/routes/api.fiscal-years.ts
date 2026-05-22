import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { FiscalYearCenter } from "~/modules/fiscal-years/fiscal-year-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json({ fiscalYears: await new FiscalYearCenter().listFiscalYears(workspace) });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const form = await args.request.formData();
    const fiscalYear = await new FiscalYearCenter().createFiscalYear(workspace, {
      startDate: String(form.get("startDate") || ""),
      endDate: String(form.get("endDate") || ""),
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ fiscalYear });
    return redirect("/exercices");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/exercices");
  }
}
