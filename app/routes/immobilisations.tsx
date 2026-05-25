import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { FixedAssetRegister } from "~/modules/fixed-assets/fixed-asset-register.server";
import { FixedAssetReferenceCenter } from "~/modules/official-references/fixed-asset-reference-center.server";
import { AppShell, Main, StatusPill, TableShell } from "~/components/ui";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const assets = await new FixedAssetRegister().listAssets(workspace);
  const defaultFamily = await new FixedAssetReferenceCenter().getDefaultFamily();
  return json({ assets, defaultFamily });
}

export default function Immobilisations() {
  const { assets, defaultFamily } = useLoaderData<typeof loader>();
  return (
    <AppShell active="immobilisations">
      <Main title="Immobilisations" subtitle="Registre de clôture">
        <Form method="post" action="/api/fixed-assets" className="card">
          <h2>Ajouter une immobilisation</h2>
          <div className="form-row">
            <div className="field"><label>Libellé</label><input name="label" defaultValue="MacBook Pro 14 pouces M3" /></div>
            <div className="field"><label>Compte</label><input name="account" defaultValue={defaultFamily.assetAccount} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Date acquisition</label><input name="acquisitionDate" type="date" defaultValue="2025-02-10" /></div>
            <div className="field"><label>Montant</label><input name="amount" defaultValue="1899.00" /></div>
            <div className="field"><label>Durée (années)</label><input name="usefulLifeYears" defaultValue={defaultFamily.usefulLifeYears} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Compte amortissement</label><input name="depreciationAccount" defaultValue={defaultFamily.amortizationAccount} /></div>
            <div className="field"><label>Compte dotation</label><input name="expenseAccount" defaultValue={defaultFamily.expenseAccount} /></div>
          </div>
          <button className="btn btn-p" type="submit">Ajouter</button>
        </Form>

        <div className="sec-head"><h2>Immobilisations suivies</h2></div>
        <TableShell>
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
                  <td><StatusPill label={asset.archivedAt ? "Archivée" : "Active"} tone={asset.archivedAt ? "neutral" : "ok"} /></td>
                  <td>
                    {!asset.archivedAt ? (
                      <Form method="post" action={`/api/fixed-assets/${asset.id}`}>
                        <input type="hidden" name="intent" value="archive" />
                        <button className="btn btn-sm" type="submit">Archiver</button>
                      </Form>
                    ) : null}
                  </td>
                </tr>
              ))}
              {assets.length === 0 ? <tr><td colSpan={7} className="sub">Aucune immobilisation suivie.</td></tr> : null}
            </tbody>
          </table>
        </TableShell>
      </Main>
    </AppShell>
  );
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
