import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, KpiCard, Main, StatusPill, TableShell } from "~/components/ui";
import { AccountingRulePackCenter } from "~/modules/accounting-rules/accounting-rule-pack-center.server";
import { RegulatorySourceCenter } from "~/modules/accounting-rules/regulatory-source-center.server";
import { RuleApplicationWorkflow } from "~/modules/accounting-rules/rule-application-workflow.server";
import { ChartOfAccountsCenter } from "~/modules/accounting-reference/chart-of-accounts-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OfficialReferenceCenter } from "~/modules/official-references/official-reference-center.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const [packs, snapshots, status, references, referencePacks] = await Promise.all([
    new AccountingRulePackCenter().listRulePacks(),
    new RegulatorySourceCenter().listSourceSnapshots(),
    new RuleApplicationWorkflow().getRuleUpdateStatus(workspace),
    new OfficialReferenceCenter().getReferenceReadinessAsync(),
    new OfficialReferenceCenter().listReferencePacks(),
  ]);
  const chart = new ChartOfAccountsCenter().validateChartIntegrity();
  const config = getRuntimeConfig();
  return json({ packs, snapshots, status, chart, references, referencePacks, canSync: config.authMode === "dev" && process.env.NODE_ENV !== "production" });
}

export default function AccountingRulesPage() {
  const { packs, snapshots, status, chart, references, referencePacks, canSync } = useLoaderData<typeof loader>();
  const activePack = status.activePack;
  const impact = status.impact as null | { affectedTransactionCount?: number; conflictCount?: number; protectedTransactionCount?: number; existingDataRequiresExplicitAction?: boolean };

  return (
    <AppShell active="regles-comptables">
      <Main title="Référentiels Qitus" subtitle="Qitus prépare les sorties comptables avec des référentiels explicites, versionnés et vérifiés." backLink={{ label: "Paramètres", href: "/parametres" }}>
        <div className="kpi-grid">
          <KpiCard label="Référentiels" value={`${references.summary.ready}/${references.summary.total}`} hint="Validés avant beta ouverte" />
          <KpiCard label="État" value={references.status === "ready" ? "Prêt" : references.status === "warning" ? "À surveiller" : "Bloqué"} hint="TVA, FEC, pré-liasse, OD, justificatifs et facture électronique" />
          <KpiCard label="Référentiel PCG" value={chart.ok ? "Validé" : "À vérifier"} hint={`${chart.accountCount} comptes · ${chart.version}`} />
          <KpiCard label="Transactions à surveiller" value={String(impact?.affectedTransactionCount ?? 0)} hint="Uniquement si vous relancez leur classement" />
        </div>

        <div className={chart.ok ? "alert blue" : "alert orange"}>
          <strong>{chart.ok ? "Référentiel comptable validé" : "Référentiel comptable à vérifier"}</strong>
          <span>
            Qitus valide les comptes des prochaines écritures avec le plan de comptes ANC chargé dans le référentiel Qitus.
            Source : <a href={chart.sourceUrl} target="_blank" rel="noreferrer">ANC / Plan comptable général</a>.
          </span>
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
                <h2>Vérification manuelle des référentiels</h2>
                <p className="sub">Action réservée à l'équipe Qitus. Elle trace les sources officielles, vérifie les packs actifs et conserve le dernier référentiel validé.</p>
              </div>
              <Form method="post" action="/api/references/sync">
                <button className="btn btn-p" type="submit">Vérifier maintenant</button>
              </Form>
            </div>
          </section>
        ) : null}

        <section className="panel">
          <h2>Référentiels de préparation vérifiable</h2>
          <TableShell>
            <table className="tbl">
              <thead><tr><th>Référentiel</th><th>État</th><th>Version</th><th>Source</th><th>Depuis</th><th>Action</th></tr></thead>
              <tbody>
                {references.items.map((reference) => (
                  <tr key={reference.kind}>
                    <td>{reference.label}</td>
                    <td><StatusPill label={referenceStatusLabel(reference.status)} tone={reference.status === "ready" ? "ok" : reference.status === "warning" ? "warn" : "error"} /></td>
                    <td>{reference.version}</td>
                    <td><a href={reference.sourceUrl} target="_blank" rel="noreferrer">{referenceSourceLabel(reference.source)}</a></td>
                    <td>{formatDateOnly(reference.effectiveFrom)}</td>
                    <td className="row gap">
                      <Form method="post" action={`/api/references/${reference.kind}/validate`}>
                        <button className="btn btn-sm" type="submit">Vérifier</button>
                      </Form>
                      {canSync ? pendingPackFor(reference.kind, referencePacks) ? (
                        <Form method="post" action={`/api/references/${reference.kind}/activate`}>
                          <input type="hidden" name="version" value={pendingPackFor(reference.kind, referencePacks)?.version} />
                          <button className="btn btn-sm" type="submit">Activer la version validée</button>
                        </Form>
                      ) : null : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </section>

        <section className="panel">
          <h2>Versions de référentiels</h2>
          <TableShell>
            <table className="tbl">
              <thead><tr><th>Référentiel</th><th>Version</th><th>État</th><th>Source</th><th>Vérifié le</th></tr></thead>
              <tbody>
                {referencePacks.map((pack) => (
                  <tr key={`${pack.kind}-${pack.version}`}>
                    <td>{references.items.find((item) => item.kind === pack.kind)?.label ?? "Référentiel Qitus"}</td>
                    <td>{pack.version}</td>
                    <td><StatusPill label={officialPackStatusLabel(pack.status)} tone={pack.status === "ACTIVE" ? "ok" : pack.status === "NEEDS_REVIEW" ? "warn" : pack.status === "BLOCKED" ? "error" : "neutral"} /></td>
                    <td>{referenceSourceLabel(pack.source)}</td>
                    <td>{formatDateTime(pack.retrievedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </section>

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

function referenceSourceLabel(source: string | undefined) {
  if (source === "ANC") return "ANC";
  if (source === "BOFIP") return "BOFiP";
  if (source === "IMPOTS_GOUV") return "impots.gouv";
  if (source === "CGI") return "CGI";
  return "Qitus";
}

function referenceStatusLabel(status: string) {
  if (status === "ready") return "Validé";
  if (status === "warning") return "À surveiller";
  return "Bloqué";
}

function officialPackStatusLabel(status: string) {
  if (status === "ACTIVE") return "Actif";
  if (status === "ARCHIVED") return "Archivé";
  if (status === "NEEDS_REVIEW") return "À valider";
  if (status === "BLOCKED") return "Bloqué";
  return "Brouillon";
}

function pendingPackFor(kind: string, packs: Array<{ kind: string; status: string; version: string }>) {
  return packs.find((pack) => pack.kind === kind && pack.status === "NEEDS_REVIEW") ?? null;
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
