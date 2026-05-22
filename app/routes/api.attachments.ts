import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AttachmentCenter } from "~/modules/evidence/attachment-center.server";
import { AttachmentLinkCenter } from "~/modules/evidence/attachment-link-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const attachments = await new AttachmentCenter().listAttachments(workspace, {
    status: url.searchParams.get("status"),
    orphanOnly: url.searchParams.get("orphan") === "1",
    extractionErrorOnly: url.searchParams.get("extractionError") === "1",
  });
  return json({ attachments });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const file = form.get("file");
  const returnTo = String(form.get("returnTo") || "/pieces");
  try {
    await assertFiscalYearMutable(workspace);
    if (!(file instanceof File)) return json({ error: "Pièce manquante." }, { status: 400 });
    const attachment = await new AttachmentCenter().uploadAttachment(workspace, {
      filename: file.name,
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    const entityType = form.get("entityType");
    const entityId = form.get("entityId");
    const relationType = form.get("relationType");
    if (typeof entityType === "string" && typeof entityId === "string" && typeof relationType === "string" && entityType && entityId && relationType) {
      await new AttachmentLinkCenter().linkAttachment(workspace, {
        attachmentId: attachment.id,
        entityType: entityType as never,
        entityId,
        relationType: relationType as never,
        note: String(form.get("note") || "") || null,
      });
    }
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ attachment });
    return redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}success=${encodeURIComponent("Pièce ajoutée")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, returnTo);
  }
}
