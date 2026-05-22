import { type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { VatDeclarationCenter } from "~/modules/vat/vat-declaration-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const download = await new VatDeclarationCenter().downloadDeclaration(workspace, String(args.params.id || ""));
  return new Response(new Uint8Array(download.body), {
    headers: {
      "content-type": download.contentType,
      "content-disposition": `attachment; filename="${download.filename}"`,
    },
  });
}
