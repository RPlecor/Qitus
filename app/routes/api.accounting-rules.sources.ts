import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { RegulatorySourceCenter } from "~/modules/accounting-rules/regulatory-source-center.server";

export async function loader(args: LoaderFunctionArgs) {
  await requireCompanyWorkspace(args);
  const snapshots = await new RegulatorySourceCenter().listSourceSnapshots();
  return json({ snapshots });
}
