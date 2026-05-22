import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { CompanyProfile } from "~/modules/company-workspace/company-profile.server";
import { PrivacyCenter } from "~/modules/privacy/privacy-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const [company, privacy] = await Promise.all([
    new CompanyProfile().getProfile(workspace),
    new PrivacyCenter().getPrivacyStatus(workspace),
  ]);
  return json({ company, privacy });
}

export default function Profil() {
  const { company, privacy } = useLoaderData<typeof loader>();

  return (
    <AppShell active="profil">
      <Main title="Profil" subtitle="Informations entreprise">
        <Form className="card" method="post" action="/api/companies/current" style={{ maxWidth: 760 }}>
          <div className="form-row">
            <div className="field"><label>Nom</label><input name="name" defaultValue={company.name} /></div>
            <div className="field">
              <label>Forme juridique</label>
              <select name="legalForm" defaultValue={company.legalForm}>
                <option value="SASU">SASU</option>
                <option value="SARL">SARL</option>
                <option value="SAS">SAS</option>
                <option value="EI">EI</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label>SIREN</label><input name="siren" defaultValue={company.siren} /></div>
            <div className="field">
              <label>Régime TVA</label>
              <select name="vatRegime" defaultValue={company.vatRegime}>
                <option value="FRANCHISE">Franchise en base</option>
                <option value="REEL_SIMPLIFIE">Réel simplifié</option>
                <option value="REEL_NORMAL">Réel normal</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Exigibilité TVA</label>
              <select name="vatExigibility" defaultValue={company.vatExigibility}>
                <option value="ENCAISSEMENTS">Encaissements</option>
                <option value="DEBITS">Débits</option>
                <option value="MIXED">Mixte</option>
              </select>
            </div>
            <div className="field">
              <label>Impôt</label>
              <select name="corporateTax" defaultValue={company.corporateTax}>
                <option value="IS">IS</option>
                <option value="IR">IR</option>
              </select>
            </div>
          </div>
          <button className="btn btn-p" type="submit">Enregistrer</button>
        </Form>
        <section className="card" style={{ maxWidth: 760 }}>
          <h2>RGPD et portabilité</h2>
          <p className="sub">L'export contient les données métier, l'activité, les documents référencés, le chat et le billing. L'anonymisation conserve les montants et écritures pour l'audit comptable.</p>
          <div className="form-actions">
            <Link className="btn btn-p" to="/api/exports/all">Exporter mes données</Link>
            <Form method="post" action="/api/privacy/anonymize">
              <input type="hidden" name="reason" value="Demande utilisateur locale" />
              <button className="btn" type="submit">Anonymiser localement</button>
            </Form>
            <Form method="post" action="/api/privacy/soft-delete">
              <input type="hidden" name="reason" value="Demande utilisateur locale" />
              <button className="btn" type="submit">Demander suppression</button>
            </Form>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Demande</th><th>Statut</th><th>Date</th></tr></thead>
              <tbody>
                {privacy.requests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.kind}</td>
                    <td>{request.status}</td>
                    <td>{new Date(request.requestedAt).toLocaleString("fr-FR")}</td>
                  </tr>
                ))}
                {privacy.requests.length === 0 ? <tr><td colSpan={3} className="sub">Aucune demande RGPD.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </Main>
    </AppShell>
  );
}
