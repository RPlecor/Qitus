import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { isLocalDemoDatabase } from "./demo-dataset-seeder.server";

export type DemoLocalAccess = {
  allowed: boolean;
  reason: string | null;
};

export function getDemoLocalAccess(
  config: RuntimeConfig = getRuntimeConfig(),
  env: Pick<NodeJS.ProcessEnv, "NODE_ENV"> = process.env
): DemoLocalAccess {
  if (config.authMode !== "dev") {
    return { allowed: false, reason: "La page Démo est disponible uniquement avec AUTH_MODE=dev." };
  }
  if (env.NODE_ENV === "production") {
    return { allowed: false, reason: "La page Démo est désactivée avec NODE_ENV=production." };
  }
  if (!config.databaseUrl || !isLocalDemoDatabase(config.databaseUrl)) {
    return { allowed: false, reason: "La page Démo exige une DATABASE_URL locale Qitus." };
  }
  return { allowed: true, reason: null };
}

export function assertDemoLocalAccess(config: RuntimeConfig = getRuntimeConfig()) {
  const access = getDemoLocalAccess(config);
  if (!access.allowed) throw new ExpectedRouteError(access.reason ?? "Page Démo indisponible.", 403);
}

export function parseDemoResetForm(form: FormData) {
  const datasetId = String(form.get("datasetId") ?? "").trim();
  const confirmed = form.get("confirmReset") === "on";
  if (!datasetId) throw new ExpectedRouteError("Dataset manquant.", 400);
  if (!confirmed) throw new ExpectedRouteError("Confirme le reset destructif avant de charger un dataset.", 400);
  return { datasetId };
}
