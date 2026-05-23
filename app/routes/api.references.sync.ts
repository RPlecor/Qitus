import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OfficialReferenceCenter } from "~/modules/official-references/official-reference-center.server";
import { isOfficialReferenceKind } from "~/modules/official-references/official-reference-data.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";
import { ExpectedRouteError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  await requireCompanyWorkspace(args);
  const config = getRuntimeConfig();
  if (config.authMode !== "dev" || process.env.NODE_ENV === "production") {
    throw new ExpectedRouteError("Synchronisation réservée à l'équipe Qitus.", 403);
  }
  const formData = await args.request.formData();
  const kind = String(formData.get("kind") ?? "");
  const center = new OfficialReferenceCenter();
  if (kind) {
    if (!isOfficialReferenceKind(kind)) throw new ExpectedRouteError("Référentiel Qitus introuvable.", 404);
    return json(await center.syncReference(kind));
  }
  return json(await center.syncAllOfficialReferences());
}
