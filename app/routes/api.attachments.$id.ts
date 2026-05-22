import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AttachmentCenter } from "~/modules/evidence/attachment-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const attachment = await new AttachmentCenter().getAttachmentDetail(workspace, String(args.params.id));
  return json({ attachment });
}
