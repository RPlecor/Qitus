import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { AppShell, KpiCard, Main } from "~/components/ui";
import { BillingStatusCenter } from "~/modules/billing/billing-status-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json(await new BillingStatusCenter().getBillingStatus(workspace));
}

export default function Abonnement() {
  const { usage, mode } = useLoaderData<typeof loader>();
  const subscription = usage.subscription;

  return (
    <AppShell active="abonnement">
      <Main title="Abonnement" subtitle="Gérer votre plan et votre consommation" backLink={{ label: "Paramètres", href: "/parametres" }}>
        <div className={`alert ${mode === "stripe" ? "blue" : "orange"}`}>
          <strong>{mode === "stripe" ? "Stripe activé" : "Abonnement stub actif"}</strong>
          <span>{mode === "stripe" ? "Checkout et portail utilisent les clés Stripe configurées." : "Aucun paiement réel n'est déclenché en mode démo."}</span>
        </div>
        <div className="kpi-grid">
          <KpiCard label="Plan" value={subscription.tier} hint={tierLabel(subscription.tier)} />
          <KpiCard label="Appels IA" value={`${usage.usage.aiCalls}/${subscription.limits.aiCallsPerMonth}`} hint="Utilisés ce mois" />
          <KpiCard label="Imports" value={`${usage.usage.imports}/${subscription.limits.importsPerMonth}`} hint="Utilisés ce mois" />
        </div>
        <section className="card">
          <h2>Changer de plan</h2>
          <div className="plan-grid">
            {(["SOLO", "ENTREPRISE", "ENTREPRISE_PLUS"] as const).map((tier) => (
              <div key={tier} className={`plan-card ${subscription.tier === tier ? "current" : ""}`}>
                <h3>{tierLabel(tier)}</h3>
                <p className="sub mono">{tier}</p>
                <Form method="post" action="/api/subscription/checkout">
                  <input type="hidden" name="tier" value={tier} />
                  <button className={`btn ${subscription.tier === tier ? "" : "btn-p"}`} type="submit">{subscription.tier === tier ? "Plan actuel" : "Choisir"}</button>
                </Form>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <Form method="post" action="/api/subscription/portal">
              <button className="btn" type="submit">Gérer mon abonnement</button>
            </Form>
          </div>
        </section>
      </Main>
    </AppShell>
  );
}

function tierLabel(tier: string) {
  if (tier === "SOLO") return "Solo";
  if (tier === "ENTREPRISE") return "Entreprise";
  if (tier === "ENTREPRISE_PLUS") return "Entreprise+";
  return tier;
}
