import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EvidenceReviewWorkflow } from "~/modules/evidence/evidence-review-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const requirementId = String(args.params.requirementId || "");
  const form = await args.request.formData();
  const returnTo = String(form.get("returnTo") || "/pieces/revue");
  const file = form.get("file");
  try {
    await assertFiscalYearMutable(workspace);
    if (!(file instanceof File)) return json({ error: "Pièce manquante." }, { status: 400 });
    const result = await new EvidenceReviewWorkflow().uploadAndResolveRequirement(workspace, {
      requirementId,
      filename: file.name,
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
      note: String(form.get("note") || "") || null,
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json(result);
    return redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}success=${encodeURIComponent("Pièce fournie et rattachée")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, returnTo);
  }
}
