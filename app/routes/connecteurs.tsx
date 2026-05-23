import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { AppShell, KpiCard, Main, StatusPill, TableShell } from "~/components/ui";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ConnectorProductSurfaceCenter } from "~/modules/connectors/connector-product-surface-center.server";
import { HealthCheckCenter } from "~/modules/deployment/health-check-center.server";
import { StorageConfigurationCenter } from "~/modules/deployment/storage-configuration-center.server";
import { OpenBankingSyncWorkflow } from "~/modules/open-banking/open-banking-sync-workflow.server";
import { StorageAuditCenter } from "~/modules/storage/storage-audit-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const [surface, readiness, storage, storageAudit, syncHistory] = await Promise.all([
    new ConnectorProductSurfaceCenter().getConnectorOverview(workspace),
    new HealthCheckCenter().getReadiness(),
    Promise.resolve(new StorageConfigurationCenter().getStatus()),
    new StorageAuditCenter().getStorageAudit(workspace),
    new OpenBankingSyncWorkflow().getSyncHistory(workspace),
  ]);
  return json({ surface, readiness, storage, storageAudit, syncHistory });
}

export default function Connecteurs() {
  const { surface, readiness, storage, storageAudit, syncHistory } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const notice = params.get("openBanking");
  const eInvoiceNotice = params.get("eInvoiceProvider");
  const error = params.get("error");

  return (
    <AppShell active="connecteurs">
      <Main title="Connecteurs" subtitle="Qonto, Stripe, Open Banking et facturation électronique">
        {notice ? <div className="alert blue">Open Banking : {noticeLabel(notice)}</div> : null}
        {eInvoiceNotice ? <div className="alert blue">Facturation électronique : {noticeLabel(eInvoiceNotice)}</div> : null}
        {error ? <div className="alert orange">{error}</div> : null}

        <div className="kpi-grid">
          <KpiCard label="Connecteurs" value={`${surface.summary.configured}/${surface.summary.total}`} hint="Configurés" />
          <KpiCard label="Connexions" value={String(surface.summary.connected)} hint="Connexions actives" />
          <KpiCard label="Readiness" value={readiness.status === "ready" ? "Prêt" : "À revoir"} hint={`${readiness.dependencies.filter((item) => item.status === "error").length} erreur(s)`} />
          <KpiCard label="Stockage" value={storage.mode.toUpperCase()} hint={storage.configured ? "Configuré" : "Incomplet"} />
        </div>

        <section className="card">
          <div className="sec-head">
            <h2>Connecteurs produit</h2>
            <StatusPill label={surface.summary.blocked === 0 ? "Lisible" : "À configurer"} tone={surface.summary.blocked === 0 ? "ok" : "warn"} />
          </div>
          <div className="grid two">
            {surface.cards.map((connector) => (
              <article className="panel" key={connector.key}>
                <div className="sec-head">
                  <div>
                    <h3>{connector.label}</h3>
                    <p className="sub">{connector.description}</p>
                  </div>
                  <StatusPill label={connector.state} tone={stateTone(connector.state)} />
                </div>
                <p>{connector.message}</p>
                <div className="grid two">
                  {connector.details.map((detail) => <div className="kv" key={detail.label}><span>{detail.label}</span><strong>{detail.value}</strong></div>)}
                </div>
                <div className="row-actions">
                  {connector.primaryAction ? <ConnectorAction action={connector.primaryAction} /> : null}
                  {connector.secondaryAction ? <ConnectorAction action={connector.secondaryAction} /> : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        {surface.internalTest.enabled ? (
          <section className="card">
            <div className="sec-head">
              <h2>Banc de test interne</h2>
              <StatusPill label="Interne" tone="warn" />
            </div>
            <div className="alert orange">{surface.internalTest.banner}</div>
            <div className="row-actions">
              {surface.internalTest.actions.map((action) => (
                action.key === "qonto_pa"
                  ? <Link className="btn" to={action.href} key={action.key} title={action.description}>{action.label}</Link>
                  : <Form method="post" action={action.href} key={action.key}>
                    <button className="btn" type="submit" title={action.description}>{action.label}</button>
                  </Form>
              ))}
            </div>
          </section>
        ) : null}

        <section className="card">
          <div className="sec-head">
            <h2>Readiness beta</h2>
            <StatusPill label={surface.betaReadiness.status === "ready" ? "Prêt" : surface.betaReadiness.status === "warning" ? "À surveiller" : "Bloqué"} tone={surface.betaReadiness.status === "ready" ? "ok" : surface.betaReadiness.status === "warning" ? "warn" : "error"} />
          </div>
          <p className="sub">
            {surface.betaReadiness.summary.ready}/{surface.betaReadiness.summary.total} checks prêts · {surface.betaReadiness.summary.warnings} warning(s) · {surface.betaReadiness.summary.blocked} blocage(s)
          </p>
          <TableShell>
            <table className="tbl">
              <thead><tr><th>Check</th><th>Statut</th><th>Message</th><th>Action</th></tr></thead>
              <tbody>
                {surface.betaReadiness.checks.map((check) => (
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

function ConnectorAction({ action }: { action: { label: string; href: string; method?: "post" } }) {
  if (action.method === "post") {
    return <Form method="post" action={action.href}><button className="btn" type="submit">{action.label}</button></Form>;
  }
  return <Link className="btn" to={action.href}>{action.label}</Link>;
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

function stateTone(value: string) {
  if (value === "Connecté" || value === "Synchronisé" || value === "Réception PA conforme") return "ok";
  if (value === "Erreur configuration" || value === "PA en attente partenaire") return "error";
  return "warn";
}
