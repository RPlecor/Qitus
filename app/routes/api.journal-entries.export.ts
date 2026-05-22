import { type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { JournalExportCenter } from "~/modules/journal/journal-export-center.server";
import type { JournalExplorerQuery } from "~/modules/journal/journal-explorer.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const format = url.searchParams.get("format") ?? "csv";
  const query = queryFromUrl(url);
  const exporter = new JournalExportCenter();
  if (format === "json") return Response.json(await exporter.exportJson(workspace, query));
  if (format === "fec-preview") return Response.json({ rows: await exporter.exportFecPreview(workspace, query) });
  const csv = await exporter.exportCsv(workspace, query);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="journal-entries.csv"`,
    },
  });
}

function queryFromUrl(url: URL): JournalExplorerQuery {
  return {
    page: 1,
    pageSize: 100,
    journal: url.searchParams.get("journal"),
    source: url.searchParams.get("source") as never,
    account: url.searchParams.get("account"),
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
    search: url.searchParams.get("search"),
  };
}
