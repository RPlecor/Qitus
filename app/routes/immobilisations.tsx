import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { FixedAssetRegister } from "~/modules/fixed-assets/fixed-asset-register.server";
import { AppShell, Main } from "~/components/ui";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const assets = await new FixedAssetRegister().listAssets(workspace);
  return json({ assets });
}

export default function Immobilisations() {
  const { assets } = useLoaderData<typeof loader>();
  return (
    <AppShell active="immobilisations">
      <Main title="Immobilisations" subtitle="Registre de clôture">
        <Form method="post" action="/api/fixed-assets" className="card form-card">
          <div className="form-grid">
            <label>Libellé<input name="label" defaultValue="MacBook Pro 14 pouces M3" /></label>
            <label>Compte<input name="account" defaultValue="2183" /></label>
            <label>Date acquisition<input name="acquisitionDate" type="date" defaultValue="2025-02-10" /></label>
            <label>Montant<input name="amount" defaultValue="1899.00" /></label>
            <label>Durée années<input name="usefulLifeYears" defaultValue="3" /></label>
            <label>Compte amortissement<input name="depreciationAccount" defaultValue="28183" /></label>
            <label>Compte dotation<input name="expenseAccount" defaultValue="68112" /></label>
          </div>
          <button className="btn btn-p">Ajouter</button>
        </Form>

        <table className="tbl">
          <thead><tr><th>Libellé</th><th>Compte</th><th>Date</th><th className="r">Montant</th><th className="r">Dotation</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td>{asset.label}</td>
                <td><span className="cpt">{asset.account}</span></td>
                <td className="mono">{asset.acquisitionDate}</td>
                <td className="r mono">{formatEuro(asset.amount)}</td>
                <td className="r mono">{formatEuro(asset.depreciation.exerciseAmount)}</td>
                <td>{asset.archivedAt ? "Archivée" : "Active"}</td>
                <td>
                  {!asset.archivedAt ? (
                    <Form method="post" action={`/api/fixed-assets/${asset.id}`}>
                      <input type="hidden" name="intent" value="archive" />
                      <button className="btn btn-sm">Archiver</button>
                    </Form>
                  ) : null}
                </td>
              </tr>
            ))}
            {assets.length === 0 ? <tr><td colSpan={7} className="sub">Aucune immobilisation suivie.</td></tr> : null}
          </tbody>
        </table>
      </Main>
    </AppShell>
  );
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
