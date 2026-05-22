import { type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AttachmentCenter } from "~/modules/evidence/attachment-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const download = await new AttachmentCenter().downloadAttachment(workspace, String(args.params.id));
  return new Response(new Uint8Array(download.body), {
    headers: {
      "Content-Type": download.contentType,
      "Content-Disposition": `attachment; filename="${download.filename.replace(/"/g, "")}"`,
    },
  });
}
