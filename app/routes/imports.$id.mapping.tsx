import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main, StatusBadge } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { prisma } from "~/modules/db.server";
import { ImportOrchestrator } from "~/modules/import-orchestrator/import-orchestrator.server";

export async function loader(args: LoaderFunctionArgs) {
  const { params, request } = args;
  const workspace = await requireCompanyWorkspace(args);
  const importRow = await prisma.import.findFirstOrThrow({
    where: { id: params.id, fiscalYearId: workspace.fiscalYear.id },
    select: { id: true, originalFilename: true, detectedColumns: true, columnMapping: true, status: true },
  });
  const status = await new ImportOrchestrator().getImportStatus(workspace, String(params.id));
  const url = new URL(request.url);
  return json({
    importRow: {
      ...importRow,
      columns: Array.isArray(importRow.detectedColumns) ? importRow.detectedColumns.filter((column): column is string => typeof column === "string") : [],
      mapping: importRow.columnMapping && typeof importRow.columnMapping === "object" && !Array.isArray(importRow.columnMapping) ? importRow.columnMapping : {},
    },
    status,
    error: url.searchParams.get("error"),
  });
}

export default function ImportMapping() {
  const { importRow, status, error } = useLoaderData<typeof loader>();
  const mapping = importRow.mapping as Record<string, string | undefined>;

  return (
    <AppShell active="imports">
      <Main title="Mapping CSV" subtitle={importRow.originalFilename ?? "Import CSV"}>
        {error ? <div className="alert red">{error}</div> : null}
        <div className="card" style={{ maxWidth: 820 }}>
          <div className="sec-head" style={{ marginTop: 0 }}>
            <h2>Associer les colonnes</h2>
            <StatusBadge status={status.status === "NEEDS_MAPPING" ? "warn" : "pending"} />
          </div>
          <p className="sub">Choisissez les colonnes qui décrivent chaque transaction bancaire. Les champs contrepartie, identifiant, référence et catégorie peuvent rester vides.</p>
          <Form method="post" action={`/api/imports/${importRow.id}/column-mapping`}>
            <div className="form-row">
              <MappingSelect name="date" label="Date" columns={importRow.columns} value={mapping.date} required />
              <MappingSelect name="label" label="Libellé" columns={importRow.columns} value={mapping.label} required />
              <MappingSelect name="amount" label="Montant" columns={importRow.columns} value={mapping.amount} required />
              <MappingSelect name="counterparty" label="Contrepartie" columns={importRow.columns} value={mapping.counterparty} />
              <MappingSelect name="sourceId" label="Identifiant source" columns={importRow.columns} value={mapping.sourceId} />
              <MappingSelect name="sourceRef" label="Référence" columns={importRow.columns} value={mapping.sourceRef} />
              <MappingSelect name="sourceCategory" label="Catégorie" columns={importRow.columns} value={mapping.sourceCategory} />
            </div>
            <div className="form-actions">
              <button className="btn btn-p" type="submit">Appliquer le mapping</button>
              <Link className="btn" to="/imports">Retour imports</Link>
            </div>
          </Form>
        </div>

        <div className="sec-head"><h2>Colonnes détectées</h2></div>
        <table className="tbl">
          <thead><tr><th>Nom de colonne</th></tr></thead>
          <tbody>
            {importRow.columns.map((column) => <tr key={column}><td>{column}</td></tr>)}
            {importRow.columns.length === 0 ? <tr><td className="sub">Aucune colonne détectée.</td></tr> : null}
          </tbody>
        </table>
      </Main>
    </AppShell>
  );
}

function MappingSelect({ name, label, columns, value, required = false }: { name: string; label: string; columns: string[]; value?: string; required?: boolean }) {
  return (
    <div className="field">
      <label>{label}{required ? " *" : ""}</label>
      <select name={name} defaultValue={value ?? ""} required={required}>
        <option value="">Ignorer</option>
        {columns.map((column) => <option key={column} value={column}>{column}</option>)}
      </select>
    </div>
  );
}
