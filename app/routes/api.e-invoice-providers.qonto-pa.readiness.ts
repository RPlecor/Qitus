import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { QontoPaReadinessCenter } from "~/modules/e-invoices/qonto-pa-readiness-center.server";

export async function loader(args: LoaderFunctionArgs) {
  await requireCompanyWorkspace(args);
  return json(await new QontoPaReadinessCenter().getReadiness());
}
