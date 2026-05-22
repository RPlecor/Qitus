import { type LoaderFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DocumentCatalog } from "~/modules/documents/document-catalog.server";

export async function loader(args: LoaderFunctionArgs) {
  const { params } = args;
  const workspace = await requireCompanyWorkspace(args);
  const document = await new DocumentCatalog().getDownload(workspace, String(params.id));
  await new ActivityLogCenter().recordActivity(workspace, {
    action: "document.downloaded",
    entityType: "document",
    entityId: String(params.id),
    metadata: { filename: document.filename },
  });
  return new Response(new Uint8Array(document.body), {
    headers: {
      "Content-Type": document.contentType,
      "Content-Length": String(document.body.byteLength),
      "Content-Disposition": contentDisposition(document.filename),
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
