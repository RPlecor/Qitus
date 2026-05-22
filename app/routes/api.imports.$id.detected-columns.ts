import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { prisma } from "~/modules/db.server";

export async function loader(args: LoaderFunctionArgs) {
  const { params } = args;
  const workspace = await requireCompanyWorkspace(args);
  const importRow = await prisma.import.findFirstOrThrow({ where: { id: params.id, fiscalYearId: workspace.fiscalYear.id } });
  return json({ columns: importRow.detectedColumns ?? [] });
}
