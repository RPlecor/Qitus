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
      <Main title="Règles comptables" subtitle="Qitus classe les prochains imports avec les règles actives, sans modifier les écritures déjà créées." backLink={{ label: "Paramètres", href: "/parametres" }}>
        <div className="kpi-grid">
          <KpiCard label="Règles utilisées" value={ruleSetName(activePack)} hint={activePack?.summary ?? "Aucune règle active pour le moment"} />
          <KpiCard label="État" value={statusLabel(status.status)} hint="Utilisées pour les prochains imports" />
          <KpiCard label="Sources officielles" value={snapshots.length > 0 ? "Vérifiées" : "Non vérifiées"} hint={sourceSnapshotHint(snapshots)} />
          <KpiCard label="Transactions à surveiller" value={String(impact?.affectedTransactionCount ?? 0)} hint="Uniquement si vous relancez leur classement" />
        </div>

        {impact?.existingDataRequiresExplicitAction ? (
          <div className="alert orange">
            <strong>Les prochains imports utiliseront les règles à jour</strong>
            <span>Certaines transactions déjà importées pourraient être classées différemment si vous relancez leur classement. Qitus ne change jamais les écritures déjà créées sans action de votre part.</span>
            <Link className="btn btn-sm" to="/imports">Ouvrir les imports</Link>
          </div>
        ) : (
          <div className="alert blue">
            <strong>Classement automatique prêt</strong>
            <span>Les règles actives seront utilisées pour les prochains imports. Les écritures existantes restent inchangées et auditées.</span>
          </div>
        )}

        {canSync ? (
          <section className="panel">
            <div className="row between">
              <div>
                <h2>Vérification manuelle des règles</h2>
                <p className="sub">Action réservée à l'équipe Qitus. Elle vérifie les sources officielles, prépare les règles Qitus et les applique aux prochains imports.</p>
              </div>
              <Form method="post" action="/api/accounting-rules/sync">
                <button className="btn btn-p" type="submit">Vérifier maintenant</button>
              </Form>
            </div>
          </section>
        ) : null}

        <section className="panel">
          <h2>Versions des règles</h2>
          <TableShell>
            <table className="tbl">
              <thead><tr><th>Nom</th><th>État</th><th>Origine</th><th>Règles de classement</th><th>Utilisée depuis</th></tr></thead>
              <tbody>
                {packs.map((pack) => (
                  <tr key={pack.id}>
                    <td>{ruleSetName(pack)}</td>
                    <td><StatusPill label={packStatusLabel(pack.status)} tone={pack.status === "ACTIVE" ? "ok" : pack.status === "NEEDS_REVIEW" ? "warn" : "neutral"} /></td>
                    <td>{sourceLabel(pack.source)}</td>
                    <td>{pack.vendorMappings.length}</td>
                    <td>{pack.activatedAt ? formatDateTime(pack.activatedAt) : "—"}</td>
                  </tr>
                ))}
                {packs.length === 0 ? <tr><td colSpan={5} className="sub">Aucune version de règles disponible.</td></tr> : null}
              </tbody>
            </table>
          </TableShell>
        </section>

        <section className="panel">
          <h2>Sources officielles vérifiées</h2>
          <TableShell>
            <table className="tbl">
              <thead><tr><th>Source</th><th>Document consulté</th><th>Vérifié le</th><th>Évolutions détectées</th><th>Lien</th></tr></thead>
              <tbody>
                {snapshots.slice(0, 20).map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>{sourceLabel(snapshot.source)}</td>
                    <td>{snapshot.title}</td>
                    <td>{formatDateTime(snapshot.retrievedAt)}</td>
                    <td>{snapshot.changes.length}</td>
                    <td><a className="btn btn-sm" href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Voir la source</a></td>
                  </tr>
                ))}
                {snapshots.length === 0 ? <tr><td colSpan={5} className="sub">Aucune vérification officielle enregistrée pour le moment. Les règles Qitus initiales restent actives.</td></tr> : null}
              </tbody>
            </table>
          </TableShell>
        </section>
      </Main>
    </AppShell>
  );
}

function statusLabel(status: string) {
  if (status === "auto_applied") return "À jour";
  if (status === "available") return "À jour";
  if (status === "missing_pack") return "À initialiser";
  return "À vérifier";
}

function packStatusLabel(status: string) {
  if (status === "ACTIVE") return "Utilisée";
  if (status === "ARCHIVED") return "Archivé";
  if (status === "NEEDS_REVIEW") return "À vérifier par Qitus";
  return "Brouillon";
}

function sourceLabel(source: string) {
  if (source === "bofip") return "BOFiP";
  if (source === "anc_pcg") return "ANC / PCG";
  if (source === "impots_gouv") return "impots.gouv";
  if (source === "qitus-official") return "Qitus";
  if (source === "seed") return "Qitus";
  return "Source Qitus";
}

function ruleSetName(pack: { version?: string | null; activatedAt?: string | Date | null } | null | undefined) {
  if (!pack) return "Aucune";
  if (pack.version?.startsWith("qitus-seed-")) return "Règles Qitus initiales";
  if (pack.version?.startsWith("official-")) return `Règles officielles du ${formatDateOnly(pack.activatedAt)}`;
  return "Règles Qitus";
}

function sourceSnapshotHint(snapshots: Array<{ source: string }>) {
  if (snapshots.length === 0) return "Les règles initiales Qitus sont utilisées";
  const sourceCount = new Set(snapshots.map((snapshot) => snapshot.source)).size;
  return `${sourceCount} source${sourceCount > 1 ? "s" : ""} vérifiée${sourceCount > 1 ? "s" : ""}`;
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDateOnly(value: string | Date | null | undefined) {
  if (!value) return "date inconnue";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
