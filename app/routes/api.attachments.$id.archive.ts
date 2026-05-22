import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AttachmentCenter } from "~/modules/evidence/attachment-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData().catch(() => new FormData());
  const returnTo = String(form.get("returnTo") || "/pieces");
  try {
    await assertFiscalYearMutable(workspace);
    const attachment = await new AttachmentCenter().archiveAttachment(workspace, String(args.params.id));
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ attachment });
    return redirect(`${returnTo}?success=${encodeURIComponent("Pièce archivée")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, returnTo);
  }
}
