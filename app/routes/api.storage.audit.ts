import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { StorageAuditCenter } from "~/modules/storage/storage-audit-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json({ storageAudit: await new StorageAuditCenter().getStorageAudit(workspace) });
}
