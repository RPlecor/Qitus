import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AttachmentLinkCenter } from "~/modules/evidence/attachment-link-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const returnTo = String(form.get("returnTo") || "/pieces");
  try {
    await assertFiscalYearMutable(workspace);
    const link = await new AttachmentLinkCenter().linkAttachment(workspace, {
      attachmentId: String(form.get("attachmentId") || ""),
      entityType: String(form.get("entityType") || "") as never,
      entityId: String(form.get("entityId") || ""),
      relationType: String(form.get("relationType") || "") as never,
      note: String(form.get("note") || "") || null,
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ link });
    return redirect(`${returnTo}?success=${encodeURIComponent("Pièce rattachée")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, returnTo);
  }
}
