import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { VatDeclarationCenter } from "~/modules/vat/vat-declaration-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const declarations = await new VatDeclarationCenter().listDeclarations(workspace);
  return json({ declarations });
}
