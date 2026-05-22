import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { BillingStatusCenter } from "~/modules/billing/billing-status-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json(await new BillingStatusCenter().getBillingStatus(workspace));
}

export default function Abonnement() {
  const { usage, mode, stripeReadiness, latestWebhookEvents, entitlements } = useLoaderData<typeof loader>();
  const subscription = usage.subscription;

  return (
    <AppShell active="abonnement">
      <Main title="Abonnement" subtitle={mode === "stripe" ? "Stripe test-mode" : "Mode démo local"}>
        <div className={`alert ${mode === "stripe" ? "blue" : "orange"}`}>
          <strong>{mode === "stripe" ? "Stripe activé" : "Abonnement stub actif"}</strong>
          <span>{mode === "stripe" ? "Checkout et portail utilisent les clés Stripe configurées." : "Aucun paiement réel n'est déclenché en mode démo."}</span>
        </div>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Plan</div><span className="kpi-val">{subscription.tier}</span></div>
          <div className="kpi"><div className="kpi-label">Statut</div><span className="kpi-val">{subscription.status}</span></div>
          <div className="kpi"><div className="kpi-label">Appels IA</div><span className="kpi-val">{usage.usage.aiCalls}/{subscription.limits.aiCallsPerMonth}</span></div>
          <div className="kpi"><div className="kpi-label">Imports</div><span className="kpi-val">{usage.usage.imports}/{subscription.limits.importsPerMonth}</span></div>
        </div>
        <section className="card">
          <h2>État des droits</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr><th>Chat IA</th><td>{entitlements.chat.allowed ? "Autorisé" : `Bloqué (${entitlements.chat.blockedReason})`}</td></tr>
                <tr><th>Imports</th><td>{entitlements.import.allowed ? "Autorisés" : `Bloqués (${entitlements.import.blockedReason})`}</td></tr>
                <tr><th>Limite minute</th><td>{usage.rateLimit.requestsLastMinute}/{usage.rateLimit.limit}</td></tr>
                <tr><th>Stripe</th><td>{stripeReadiness.enabled ? "Activé" : "Désactivé"} · clés {stripeReadiness.hasSecretKey && stripeReadiness.hasWebhookSecret && stripeReadiness.hasPrices ? "complètes" : "incomplètes"}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <h2>Changer de plan</h2>
          <p className="sub">Les boutons ouvrent Stripe seulement si `BILLING_MODE=stripe` est configuré.</p>
          <div className="form-actions">
            {(["SOLO", "ENTREPRISE", "ENTREPRISE_PLUS"] as const).map((tier) => (
              <Form key={tier} method="post" action="/api/subscription/checkout">
                <input type="hidden" name="tier" value={tier} />
                <button className="btn btn-p" type="submit">{tier}</button>
              </Form>
            ))}
            <Form method="post" action="/api/subscription/portal">
              <button className="btn" type="submit">Portail client</button>
            </Form>
          </div>
        </section>
        <section className="card">
          <h2>Derniers webhooks billing</h2>
          {latestWebhookEvents.length === 0 ? <p className="sub">Aucun webhook reçu.</p> : null}
          {latestWebhookEvents.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Type</th><th>Statut</th><th>Erreur</th></tr></thead>
                <tbody>
                  {latestWebhookEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{new Date(event.receivedAt).toLocaleString("fr-FR")}</td>
                      <td>{event.eventType}</td>
                      <td>{event.status}</td>
                      <td>{event.errorMessage ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </Main>
    </AppShell>
  );
}
