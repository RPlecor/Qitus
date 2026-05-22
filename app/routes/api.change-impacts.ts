import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { ChangeImpactCenter, type ChangeImpactSurface } from "~/modules/change-impacts/change-impact-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

const SURFACES = new Set<ChangeImpactSurface>(["dashboard", "imports", "documents", "tva", "cloture", "couverture", "dossier_ec", "connecteurs"]);

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const surfaceParam = url.searchParams.get("surface");
  const surface = surfaceParam && SURFACES.has(surfaceParam as ChangeImpactSurface) ? surfaceParam as ChangeImpactSurface : undefined;
  const includeDetails = url.searchParams.get("includeDetails") === "true";
  const center = new ChangeImpactCenter();
  return json({ changeImpacts: await center.getImpactOverview(workspace, { surface, includeDetails }) });
}
