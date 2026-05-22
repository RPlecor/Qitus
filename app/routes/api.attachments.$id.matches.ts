import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AttachmentMatchingCenter } from "~/modules/evidence/attachment-matching-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const matches = await new AttachmentMatchingCenter().suggestLinksForAttachment(workspace, String(args.params.id || ""));
  return json({ matches });
}
