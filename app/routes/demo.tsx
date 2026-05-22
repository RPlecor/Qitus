import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import { AppShell, Main } from "~/components/ui";
import { assertDemoLocalAccess, parseDemoResetForm } from "~/modules/demo/demo-local-access.server";
import { DemoDatasetSeeder, DEMO_DATASETS } from "~/modules/demo/demo-workspace-reset.server";
import { routeErrorMessage } from "~/modules/route-errors.server";

export async function loader(_args: LoaderFunctionArgs) {
  assertDemoLocalAccess();
  return json({ datasets: DEMO_DATASETS });
}

export async function action(args: ActionFunctionArgs) {
  try {
    assertDemoLocalAccess();
    const input = parseDemoResetForm(await args.request.formData());
    const result = await new DemoDatasetSeeder().resetDemoWorkspace(input);
    return redirect(`/dashboard?demoDataset=${encodeURIComponent(result.dataset.id)}`, { status: 303 });
  } catch (error) {
    return redirect(`/demo?error=${encodeURIComponent(routeErrorMessage(error))}`, { status: 303 });
  }
}

export default function Demo() {
  const { datasets } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const navigation = useNavigation();
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const error = params.get("error");
  const loadingDataset = navigation.state !== "idle" ? String(navigation.formData?.get("datasetId") ?? "") : null;

  return (
    <AppShell active="demo">
      <Main title="Démo locale" subtitle="Changer de dataset sans terminal">
        {error ? <div className="alert red">{error}</div> : null}
        {loadingDataset ? <div className="alert blue">Chargement du dataset en cours, quelques secondes...</div> : null}

        <section className="panel">
          <h2>Reset destructif</h2>
          <p className="sub">
            Cette page supprime et recrée les données locales du `dev-user`. Elle est réservée au mode développement.
          </p>
        </section>

        <div className="grid two">
          {datasets.map((dataset) => (
            <section className="panel" key={dataset.id}>
              <div className="row between">
                <h2>{dataset.label}</h2>
                {dataset.id === "qonto_mvp" ? <span className="st-done">Recommandé</span> : null}
              </div>
              <p className="sub">{dataset.description}</p>
              <dl className="meta">
                <dt>Dataset</dt>
                <dd>{dataset.id}</dd>
                <dt>Imports</dt>
                <dd>{dataset.bankImports.map((fixture) => fixture.split("/").pop()).join(", ")}</dd>
                {dataset.seedClosingContext ? (
                  <>
                    <dt>Clôture</dt>
                    <dd>Immobilisations et rapprochement bancaire</dd>
                  </>
                ) : null}
                {dataset.expectedState ? (
                  <>
                    <dt>État strict</dt>
                    <dd>{dataset.expectedState.transactions} transactions · {dataset.expectedState.journalEntries} écritures · {dataset.expectedState.documents} document</dd>
                  </>
                ) : null}
              </dl>
              <Form method="post" className="form-stack">
                <input type="hidden" name="datasetId" value={dataset.id} />
                <label className="checkline">
                  <input
                    type="checkbox"
                    name="confirmReset"
                    checked={Boolean(confirmed[dataset.id])}
                    onChange={(event) => setConfirmed((current) => ({ ...current, [dataset.id]: event.target.checked }))}
                  />
                  <span>Je comprends que les données locales seront réinitialisées.</span>
                </label>
                <button className="btn btn-p" type="submit" disabled={!confirmed[dataset.id] || Boolean(loadingDataset)}>
                  {loadingDataset === dataset.id ? "Chargement..." : "Charger ce dataset"}
                </button>
              </Form>
            </section>
          ))}
        </div>
      </Main>
    </AppShell>
  );
}

export function ErrorBoundary() {
  return (
    <div className="shell center">
      <div className="ob-card">
        <h1>Démo locale indisponible</h1>
        <p className="sub">Cette page est réservée au mode développement local.</p>
      </div>
    </div>
  );
}
