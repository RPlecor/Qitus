import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AnnualClosingCenter } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DocumentCatalog } from "~/modules/documents/document-catalog.server";
import { AppShell, Main } from "~/components/ui";
import { documentTypeLabel, freshnessLabel } from "~/modules/ui-labels";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const [step, documents] = await Promise.all([
    new AnnualClosingCenter().getStep(workspace, "EXPORT_ARCHIVE"),
    new DocumentCatalog().listDocuments(workspace),
  ]);
  return json({ step, documents });
}

export default function ClosingArchive() {
  const { step, documents } = useLoaderData<typeof loader>();
  return (
    <AppShell active="cloture">
      <Main title="Archive de clôture" subtitle="Preuves finales" action={<Link className="btn" to="/cloture">Retour clôture</Link>}>
        <div className={`alert ${step.blockingCount > 0 ? "orange" : "blue"}`}>
          <strong>{step.blockingCount > 0 ? "Archive incomplète" : "Archive prête"}</strong>
          <span>{step.evidence.map((item) => `${item.label}: ${item.value}`).join(" · ")}</span>
        </div>
        <div className="actions-row">
          <Form method="post" action="/api/cloture/steps/EXPORT_ARCHIVE/run"><button className="btn btn-p">Générer archive finale</button></Form>
          <a className="btn" href="/api/documents/evidence-bundle">Télécharger l’inventaire du dossier</a>
        </div>
        <table className="tbl">
          <thead><tr><th>Type</th><th>Fichier</th><th>Version</th><th>État</th><th></th></tr></thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td>{documentTypeLabel(document.type)}</td>
                <td>{document.filename}</td>
                <td>{document.scriptVersion ?? "—"}</td>
                <td>{freshnessLabel(document.freshness?.statusLabel ?? "À jour")}</td>
                <td><a className="btn btn-sm" href={`/api/documents/${document.id}/download`}>Télécharger</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Main>
    </AppShell>
  );
}
