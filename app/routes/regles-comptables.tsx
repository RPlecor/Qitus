import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, KpiCard, Main, StatusPill, TableShell } from "~/components/ui";
import { AccountingRulePackCenter } from "~/modules/accounting-rules/accounting-rule-pack-center.server";
import { RegulatorySourceCenter } from "~/modules/accounting-rules/regulatory-source-center.server";
import { RuleApplicationWorkflow } from "~/modules/accounting-rules/rule-application-workflow.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const [packs, snapshots, status] = await Promise.all([
    new AccountingRulePackCenter().listRulePacks(),
    new RegulatorySourceCenter().listSourceSnapshots(),
    new RuleApplicationWorkflow().getRuleUpdateStatus(workspace),
  ]);
  const config = getRuntimeConfig();
  return json({ packs, snapshots, status, canSync: config.authMode === "dev" && process.env.NODE_ENV !== "production" });
}

export default function AccountingRulesPage() {
  const { packs, snapshots, status, canSync } = useLoaderData<typeof loader>();
  const activePack = status.activePack;
  const impact = status.impact as null | { affectedTransactionCount?: number; conflictCount?: number; protectedTransactionCount?: number; existingDataRequiresExplicitAction?: boolean };

  return (
    <AppShell active="regles-comptables">
      <Main title="Règles comptables" subtitle="Sources officielles et packs Qitus automatiquement appliqués aux futurs imports">
        <div className="kpi-grid">
          <KpiCard label="Pack actif" value={activePack?.version ?? "Aucun"} hint={activePack?.summary ?? "Seed initial à synchroniser"} />
          <KpiCard label="Statut" value={statusLabel(status.status)} hint="Application aux futurs imports" />
          <KpiCard label="Sources" value={String(new Set(snapshots.map((snapshot) => snapshot.source)).size)} hint={`${snapshots.length} relevé(s) de source`} />
          <KpiCard label="Transactions concernées" value={String(impact?.affectedTransactionCount ?? 0)} hint="Données existantes non modifiées" />
        </div>

        {impact?.existingDataRequiresExplicitAction ? (
          <div className="alert orange">
            <strong>Règles à jour pour les futurs imports</strong>
            <span>Des transactions existantes pourraient changer de compte si tu relances leur catégorisation. Qitus ne modifie pas les écritures déjà générées automatiquement.</span>
            <Link className="btn btn-sm" to="/imports">Ouvrir les imports</Link>
          </div>
        ) : (
          <div className="alert blue">
            <strong>Mise à jour transparente</strong>
            <span>Les règles actives sont utilisées automatiquement pour les prochains imports. Les écritures existantes restent auditées et inchangées.</span>
          </div>
        )}

        {canSync ? (
          <section className="panel">
            <div className="row between">
              <div>
                <h2>Synchronisation dev/admin</h2>
                <p className="sub">Récupère les sources officielles, construit le pack Qitus et applique la version active au workspace courant.</p>
              </div>
              <Form method="post" action="/api/accounting-rules/sync">
                <button className="btn btn-p" type="submit">Synchroniser maintenant</button>
              </Form>
            </div>
          </section>
        ) : null}

        <section className="panel">
          <h2>Packs de règles</h2>
          <TableShell>
            <table className="tbl">
              <thead><tr><th>Version</th><th>Statut</th><th>Source</th><th>Mappings</th><th>Activé le</th></tr></thead>
              <tbody>
                {packs.map((pack) => (
                  <tr key={pack.id}>
                    <td className="mono">{pack.version}</td>
                    <td><StatusPill label={packStatusLabel(pack.status)} tone={pack.status === "ACTIVE" ? "ok" : pack.status === "NEEDS_REVIEW" ? "warn" : "neutral"} /></td>
                    <td>{sourceLabel(pack.source)}</td>
                    <td>{pack.vendorMappings.length}</td>
                    <td className="mono">{pack.activatedAt ? new Date(pack.activatedAt).toLocaleString("fr-FR") : "—"}</td>
                  </tr>
                ))}
                {packs.length === 0 ? <tr><td colSpan={5} className="sub">Aucun pack de règles.</td></tr> : null}
              </tbody>
            </table>
          </TableShell>
        </section>

        <section className="panel">
          <h2>Sources officielles consultées</h2>
          <TableShell>
            <table className="tbl">
              <thead><tr><th>Source</th><th>Titre</th><th>Récupéré le</th><th>Changements</th><th>Lien</th></tr></thead>
              <tbody>
                {snapshots.slice(0, 20).map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>{sourceLabel(snapshot.source)}</td>
                    <td>{snapshot.title}</td>
                    <td className="mono">{new Date(snapshot.retrievedAt).toLocaleString("fr-FR")}</td>
                    <td>{snapshot.changes.length}</td>
                    <td><a className="btn btn-sm" href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Ouvrir</a></td>
                  </tr>
                ))}
                {snapshots.length === 0 ? <tr><td colSpan={5} className="sub">Aucune source synchronisée.</td></tr> : null}
              </tbody>
            </table>
          </TableShell>
        </section>
      </Main>
    </AppShell>
  );
}

function statusLabel(status: string) {
  if (status === "auto_applied") return "Automatique";
  if (status === "available") return "Disponible";
  if (status === "missing_pack") return "À initialiser";
  return status;
}

function packStatusLabel(status: string) {
  if (status === "ACTIVE") return "Actif";
  if (status === "ARCHIVED") return "Archivé";
  if (status === "NEEDS_REVIEW") return "Revue interne";
  return "Brouillon";
}

function sourceLabel(source: string) {
  if (source === "bofip") return "BOFiP";
  if (source === "anc_pcg") return "ANC / PCG";
  if (source === "impots_gouv") return "impots.gouv";
  return source;
}
