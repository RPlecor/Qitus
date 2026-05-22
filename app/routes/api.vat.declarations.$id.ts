import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { VatDeclarationCenter } from "~/modules/vat/vat-declaration-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const declaration = await new VatDeclarationCenter().getDeclaration(workspace, String(args.params.id || ""));
  return json({ declaration });
}
