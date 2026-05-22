import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AccreditedPlatformSelectionCenter } from "~/modules/e-invoices/accredited-platform-selection-center.server";

export async function loader(args: LoaderFunctionArgs) {
  await requireCompanyWorkspace(args);
  return json(await new AccreditedPlatformSelectionCenter().getSelection());
}
