import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link } from "@remix-run/react";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  if (workspace.authMode === "clerk" && workspace.company.onboardingComplete) throw redirect("/dashboard");
  return json({ authMode: workspace.authMode });
}

export default function Onboarding() {
  return (
    <div className="shell center">
      <Form method="post" action="/api/companies" className="ob-card">
        <h1>Configurons votre entreprise.</h1>
        <p className="sub">Ces informations alimentent les écritures et le `company.json` utilisé par les scripts Paperasse.</p>
        <div className="field">
          <label>Nom de l'entreprise</label>
          <input name="name" defaultValue="ACME Digital" required />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Forme juridique</label>
            <select name="legalForm" defaultValue="SASU">
              <option>SASU</option>
              <option>SARL</option>
              <option>EI</option>
            </select>
          </div>
          <div className="field">
            <label>SIREN</label>
            <input name="siren" defaultValue="912345678" />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label>Régime TVA</label>
            <select name="vatRegime" defaultValue="FRANCHISE">
              <option value="FRANCHISE">Franchise en base</option>
              <option value="REEL_SIMPLIFIE">Réel simplifié</option>
              <option value="REEL_NORMAL">Réel normal</option>
            </select>
          </div>
          <div className="field">
            <label>Exigibilité TVA</label>
            <select name="vatExigibility" defaultValue="ENCAISSEMENTS">
              <option value="ENCAISSEMENTS">Encaissements</option>
              <option value="DEBITS">Débits</option>
              <option value="MIXED">Mixte</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label>Impôt</label>
            <select name="corporateTax" defaultValue="IS">
              <option>IS</option>
              <option>IR</option>
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-p" type="submit">Créer l'entreprise</button>
          <Link className="btn btn-ghost" to="/dashboard">Passer</Link>
        </div>
      </Form>
    </div>
  );
}
