import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { AnnualClosingCenter } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const step = await new AnnualClosingCenter().completeStep(workspace, String(args.params.step));
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ step });
    return redirect(`/cloture/${step.code}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, `/cloture/${String(args.params.step)}`);
  }
}
