import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OfficialReferenceCenter } from "~/modules/official-references/official-reference-center.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";
import { ExpectedRouteError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  await requireCompanyWorkspace(args);
  const config = getRuntimeConfig();
  if (config.authMode !== "dev" || process.env.NODE_ENV === "production") {
    throw new ExpectedRouteError("Initialisation réservée à l'équipe Qitus.", 403);
  }
  return json(await new OfficialReferenceCenter().bootstrapEmbeddedReferences());
}
