import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { StorageConfigurationCenter } from "~/modules/deployment/storage-configuration-center.server";
import { StorageAuditCenter } from "~/modules/storage/storage-audit-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const [storage, audit] = await Promise.all([
    Promise.resolve(new StorageConfigurationCenter().getStatus()),
    new StorageAuditCenter().getStorageAudit(workspace),
  ]);
  return json({ storage: { ...storage, audit } });
}
