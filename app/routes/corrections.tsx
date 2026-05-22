import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { CorrectionRuleCenter } from "~/modules/correction-rules/correction-rule-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const activeParam = url.searchParams.get("active");
  const active = activeParam === "true" ? true : activeParam === "false" ? false : null;
  const rules = await new CorrectionRuleCenter().listRules(workspace, {
    active,
    search: url.searchParams.get("search"),
  });
  return json({ rules, query: { active: activeParam ?? "all", search: url.searchParams.get("search") ?? "" } });
}

export default function Corrections() {
  const { rules, query } = useLoaderData<typeof loader>();

  return (
    <AppShell active="corrections">
      <Main title="Règles" subtitle="Corrections apprises">
        <Form method="get" className="card">
          <div className="form-row">
            <div className="field">
              <label>Recherche</label>
              <input name="search" defaultValue={query.search} />
            </div>
            <div className="field">
              <label>Statut</label>
              <select name="active" defaultValue={query.active}>
                <option value="all">Toutes</option>
                <option value="true">Actives</option>
                <option value="false">Inactives</option>
              </select>
            </div>
          </div>
          <button className="btn btn-p" type="submit">Filtrer</button>
        </Form>

        <div className="sec-head"><h2>Créer une règle</h2></div>
        <Form method="post" action="/api/correction-rules" className="card">
          <div className="form-row">
            <div className="field"><label>Contrepartie</label><input name="counterparty" placeholder="UBER BV" /></div>
            <div className="field"><label>Compte préféré</label><input name="preferredAccount" placeholder="6251" /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Libellé compte</label><input name="preferredAccountLabel" /></div>
            <div className="field"><label>Condition</label><input name="condition" placeholder="Optionnel" /></div>
          </div>
          <div className="field"><label>Note</label><input name="note" /></div>
          <button className="btn btn-p" type="submit">Créer</button>
        </Form>

        <div className="sec-head"><h2>Règles existantes</h2></div>
        <table className="tbl">
          <thead><tr><th>Statut</th><th>Contrepartie</th><th>Compte</th><th>Condition</th><th>Impact</th><th>Note</th><th></th></tr></thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.active ? "Active" : "Inactive"}</td>
                <td>{rule.counterparty}</td>
                <td><span className="cpt">{rule.preferredAccount}</span> {rule.preferredAccountLabel ?? ""}</td>
                <td>{rule.condition ?? "—"}</td>
                <td><Link to={`/corrections/${rule.id}`}>{rule.matchCountSnapshot} match{rule.matchCountSnapshot > 1 ? "s" : ""}</Link></td>
                <td className="sub">{rule.note ?? "—"}</td>
                <td>
                  <Form method="post" action={`/api/correction-rules/${rule.id}`}>
                    <input type="hidden" name="intent" value={rule.active ? "disable" : "enable"} />
                    <button className="btn btn-sm" type="submit">{rule.active ? "Désactiver" : "Réactiver"}</button>
                  </Form>
                </td>
              </tr>
            ))}
            {rules.length === 0 ? <tr><td colSpan={7} className="sub">Aucune règle de correction.</td></tr> : null}
          </tbody>
        </table>
      </Main>
    </AppShell>
  );
}
