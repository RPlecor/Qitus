import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OfficialReferenceCenter } from "~/modules/official-references/official-reference-center.server";
import { isOfficialReferenceKind } from "~/modules/official-references/official-reference-data.server";
import { ExpectedRouteError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  await requireCompanyWorkspace(args);
  const kind = args.params.kind;
  if (!isOfficialReferenceKind(kind)) throw new ExpectedRouteError("Référentiel Qitus introuvable.", 404);
  const center = new OfficialReferenceCenter();
  const packs = await center.listReferencePacks(kind);
  return json({
    reference: await center.getActiveReferenceAsync(kind),
    validation: await center.validateReferencePackAsync(kind),
    packs,
  });
}
