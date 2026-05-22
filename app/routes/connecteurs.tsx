import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { AppShell, KpiCard, Main, StatusPill, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { BetaReadinessCenter } from "~/modules/deployment/beta-readiness-center.server";
import { HealthCheckCenter } from "~/modules/deployment/health-check-center.server";
import { StorageConfigurationCenter } from "~/modules/deployment/storage-configuration-center.server";
import { OpenBankingCenter } from "~/modules/open-banking/open-banking-center.server";
import { OpenBankingFreshnessCenter } from "~/modules/open-banking/open-banking-freshness-center.server";
import { OpenBankingSyncWorkflow } from "~/modules/open-banking/open-banking-sync-workflow.server";
import { ConnectorSyncCenter } from "~/modules/reconciliations/connector-sync-center.server";
import { StorageAuditCenter } from "~/modules/storage/storage-audit-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const [openBanking, openBankingFreshness, syncHistory, betaReadiness, connectors, readiness, storage, storageAudit, institutions] = await Promise.all([
    new OpenBankingCenter().getStatus(workspace),
    new OpenBankingFreshnessCenter().getFreshness(workspace),
    new OpenBankingSyncWorkflow().getSyncHistory(workspace),
    new BetaReadinessCenter().getReadiness(workspace),
    Promise.resolve(new ConnectorSyncCenter().getConnectorStatus(workspace)),
    new HealthCheckCenter().getReadiness(),
    Promise.resolve(new StorageConfigurationCenter().getStatus()),
    new StorageAuditCenter().getStorageAudit(workspace),
    new OpenBankingCenter().listInstitutions({ country: "FR" }).catch(() => []),
  ]);
  return json({ openBanking, openBankingFreshness, syncHistory, betaReadiness, connectors, readiness, storage, storageAudit, institutions });
}

export default function Connecteurs() {
  const { openBanking, openBankingFreshness, syncHistory, betaReadiness, connectors, readiness, storage, storageAudit, institutions } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const notice = params.get("openBanking");
  const error = params.get("error");
  const activeConnections = openBanking.connections.filter((connection) => connection.status === "ACTIVE").length;

  return (
    <AppShell active="connecteurs">
      <Main title="Connecteurs" subtitle="Open Banking, Qonto, Stripe et runtime beta">
        {notice ? <div className="alert blue">Open Banking : {noticeLabel(notice)}</div> : null}
        {error ? <div className="alert orange">{error}</div> : null}
        <div className="kpi-grid">
          <KpiCard label="Open Banking" value={openBanking.enabled ? openBanking.provider : "Désactivé"} hint={openBanking.message} />
          <KpiCard label="Connexions actives" value={String(activeConnections)} hint="Consentements read-only" />
          <KpiCard label="Readiness" value={readiness.status === "ready" ? "Prêt" : "À revoir"} hint={`${readiness.dependencies.filter((item) => item.status === "error").length} erreur(s)`} />
          <KpiCard label="Stockage" value={storage.mode.toUpperCase()} hint={storage.configured ? "Configuré" : "Incomplet"} />
        </div>

        <section className="card">
          <div className="sec-head">
            <h2>Readiness beta</h2>
            <StatusPill label={betaReadiness.status === "ready" ? "Prêt" : betaReadiness.status === "warning" ? "À surveiller" : "Bloqué"} tone={betaReadiness.status === "ready" ? "ok" : betaReadiness.status === "warning" ? "warn" : "error"} />
          </div>
          <p className="sub">
            {betaReadiness.summary.ready}/{betaReadiness.summary.total} checks prêts · {betaReadiness.summary.warnings} warning(s) · {betaReadiness.summary.blocked} blocage(s)
          </p>
          <TableShell>
            <table className="tbl">
              <thead><tr><th>Check</th><th>Statut</th><th>Message</th><th>Action</th></tr></thead>
              <tbody>
                {betaReadiness.checks.map((check) => (
                  <tr key={check.code}>
                    <td>{check.label}</td>
                    <td><StatusPill label={check.status} tone={check.status === "ready" ? "ok" : check.status === "warning" ? "warn" : "error"} /></td>
                    <td>{check.message}</td>
                    <td>{check.action ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </section>

        <section className="card">
          <div className="sec-head">
            <h2>Open Banking provider</h2>
            <StatusPill label={openBankingFreshness.status === "fresh" ? "À jour" : openBankingFreshness.status === "never_connected" ? "Jamais connecté" : "À revoir"} tone={openBankingFreshness.status === "fresh" ? "ok" : "warn"} />
          </div>
          <p className="sub">{openBanking.message}</p>
          <div className="row-actions">
            <Form method="post" action="/api/open-banking/connect">
              <input type="hidden" name="country" value="FR" />
              {openBanking.selectionMode === "institution_select" && institutions.length > 0 ? (
                <select name="institutionId" aria-label="Établissement bancaire">
                  {institutions.map((institution, index) => institution ? <option key={institution.id} value={institution.id}>{institution.name}</option> : <option key={index} value="">Établissement indisponible</option>)}
                </select>
              ) : null}
              <button className="btn btn-p" type="submit" disabled={!openBanking.enabled}>
                {openBanking.selectionMode === "provider_webview" ? "Ouvrir le parcours bancaire provider" : "Connecter une banque"}
              </button>
            </Form>
            <Form method="post" action="/api/open-banking/sync">
              <button className="btn" type="submit" disabled={!openBanking.enabled}>Synchroniser</button>
            </Form>
            <Form method="post" action="/api/open-banking/disconnect">
              <button className="btn" type="submit" disabled={activeConnections === 0}>Révoquer</button>
            </Form>
          </div>
          <TableShell>
            <table className="tbl">
              <thead><tr><th>Connexion</th><th>Statut</th><th>Fraîcheur</th><th>Expiration</th><th>Dernière sync</th><th>Comptes</th><th>Actions</th></tr></thead>
              <tbody>
                {openBanking.connections.map((connection) => (
                  <tr key={connection.id}>
                    <td>{connection.provider}</td>
                    <td><StatusPill label={connection.status} tone={connection.status === "ACTIVE" ? "ok" : "warn"} /></td>
                    <td>{freshnessLabel(openBankingFreshness.connections.find((item) => item.connectionId === connection.id)?.status)}</td>
                    <td className="mono">{connection.consentExpiresAt ? shortDate(connection.consentExpiresAt) : "—"}</td>
                    <td className="mono">{connection.lastSyncedAt ? shortDate(connection.lastSyncedAt) : "Jamais"}</td>
                    <td>{connection.accounts.map((account) => account.name).join(", ") || "—"}</td>
                    <td>
                      <div className="row-actions">
                        <Form method="post" action={`/api/open-banking/connections/${connection.id}/sync`}>
                          <button className="btn" type="submit">Sync</button>
                        </Form>
                        {connection.status !== "ACTIVE" ? (
                          <Form method="post" action={`/api/open-banking/connections/${connection.id}/reconnect`}>
                            <button className="btn" type="submit">Reconnecter</button>
                          </Form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {openBanking.connections.length === 0 ? <tr><td colSpan={7} className="sub">Aucune connexion bancaire.</td></tr> : null}
              </tbody>
            </table>
          </TableShell>
        </section>

        <section className="card">
          <div className="sec-head"><h2>Connecteurs historiques</h2><Link className="btn" to="/rapprochements">Rapprochements</Link></div>
          <TableShell>
            <table className="tbl">
              <tbody>
                {connectors.connectors.map((connector) => (
                  <tr key={connector.provider}>
                    <td>{connector.provider.toUpperCase()}</td>
                    <td>{connector.source}</td>
                    <td>{connector.configured ? "Configuré" : "Non configuré"}</td>
                    <td>{connector.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </section>

        <section className="card">
          <div className="sec-head"><h2>Dernières synchronisations bancaires</h2><StatusPill label="Secrets masqués" tone="info" /></div>
          <TableShell>
            <table className="tbl">
              <thead><tr><th>Date</th><th>Statut</th><th>Fetch</th><th>Importées</th><th>Erreur</th></tr></thead>
              <tbody>
                {syncHistory.map((sync) => (
                  <tr key={sync.id}>
                    <td className="mono">{shortDate(sync.startedAt)}</td>
                    <td><StatusPill label={sync.status} tone={sync.status === "SUCCESS" ? "ok" : sync.status === "FAILED" ? "error" : "pending"} /></td>
                    <td>{sync.transactionsFetched}</td>
                    <td>{sync.transactionsImported}</td>
                    <td>{sync.errorMessage ?? "—"}</td>
                  </tr>
                ))}
                {syncHistory.length === 0 ? <tr><td colSpan={5} className="sub">Aucune synchronisation lancée.</td></tr> : null}
              </tbody>
            </table>
          </TableShell>
        </section>

        <section className="card">
          <div className="sec-head"><h2>Audit stockage</h2><StatusPill label={storageAudit.summary.missing === 0 ? "Complet" : "Manquants"} tone={storageAudit.summary.missing === 0 ? "ok" : "warn"} /></div>
          <p className="sub">{storageAudit.summary.available}/{storageAudit.summary.total} artefact(s) disponibles en stockage {storageAudit.mode}.</p>
          <TableShell>
            <table className="tbl">
              <thead><tr><th>Type</th><th>Fichier</th><th>Disponibilité</th><th>Taille</th></tr></thead>
              <tbody>
                {storageAudit.items.slice(0, 10).map((item) => (
                  <tr key={`${item.kind}:${item.id}`}>
                    <td>{item.kind}</td>
                    <td>{item.filename}</td>
                    <td><StatusPill label={item.available ? "Présent" : "Manquant"} tone={item.available ? "ok" : "error"} /></td>
                    <td>{item.sizeBytes ?? item.expectedSizeBytes ?? "—"}</td>
                  </tr>
                ))}
                {storageAudit.items.length === 0 ? <tr><td colSpan={4} className="sub">Aucun document ou justificatif à auditer.</td></tr> : null}
              </tbody>
            </table>
          </TableShell>
        </section>
      </Main>
    </AppShell>
  );
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function noticeLabel(value: string) {
  if (value === "connected") return "connexion créée";
  if (value === "synced") return "synchronisation terminée";
  if (value === "disconnected") return "connexion révoquée";
  if (value === "reconnected") return "connexion renouvelée";
  return value;
}

function freshnessLabel(value?: string) {
  if (value === "fresh") return "À jour";
  if (value === "stale") return "À relancer";
  if (value === "expired") return "Expiré";
  if (value === "never_synced") return "Jamais sync";
  if (value === "revoked") return "Révoqué";
  return "—";
}
