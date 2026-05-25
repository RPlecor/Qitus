import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { isOfficialReferenceKind } from "~/modules/official-references/official-reference-data.server";
import { OfficialReferenceCenter } from "~/modules/official-references/official-reference-center.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";
import { ExpectedRouteError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  await requireCompanyWorkspace(args);
  const config = getRuntimeConfig();
  if (config.authMode !== "dev" || process.env.NODE_ENV === "production") {
    throw new ExpectedRouteError("Activation réservée à l'équipe Qitus.", 403);
  }
  const kind = args.params.kind;
  if (!isOfficialReferenceKind(kind)) throw new ExpectedRouteError("Référentiel Qitus introuvable.", 404);
  const formData = await args.request.formData();
  const version = String(formData.get("version") ?? "");
  if (!version) throw new ExpectedRouteError("Version de référentiel manquante.", 400);
  return json(await new OfficialReferenceCenter().activateReferencePack(kind, version));
}
