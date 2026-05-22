import { type LoaderFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DocumentEvidenceBundle } from "~/modules/documents/document-evidence-bundle.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const bundle = await new DocumentEvidenceBundle().downloadBundle(workspace);
  await new ActivityLogCenter().recordActivity(workspace, {
    action: "document.evidence_bundle_downloaded",
    entityType: "document",
    metadata: { filename: bundle.filename },
  });
  return new Response(new Uint8Array(bundle.body), {
    headers: {
      "Content-Type": bundle.contentType,
      "Content-Length": String(bundle.body.byteLength),
      "Content-Disposition": `attachment; filename="${bundle.filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
