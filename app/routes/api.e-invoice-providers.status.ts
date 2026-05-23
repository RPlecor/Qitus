import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceProviderCenter } from "~/modules/e-invoices/e-invoice-provider-center.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const config = getRuntimeConfig();
  const status = await new EInvoiceProviderCenter().getStatus(workspace);
  if (config.qitusInternalTestMode) return json(status);
  return json({
    ...status,
    provider: status.provider === "qonto_pa" ? "qonto_pa" : "e_invoice_provider",
    providerLabel: status.provider === "qonto_pa" ? "Qonto PA" : "Facturation électronique",
    mode: status.mode === "disabled" ? "disabled" : "live",
    capabilities: [],
    safeMessage: status.readiness.receptionCompliant ? "Réception PA conforme active." : "Qonto PA est en pré-activation partenaire.",
    readiness: {
      ...status.readiness,
      status: status.readiness.receptionCompliant ? status.readiness.status : "pending_partner",
      message: status.readiness.receptionCompliant ? status.readiness.message : "Réception PA à configurer ou à finaliser.",
      recommendedAction: status.readiness.recommendedAction ? sanitizeProductText(status.readiness.recommendedAction) : status.readiness.recommendedAction,
    },
    connections: status.connections.map((connection) => ({
      ...connection,
      provider: "Facturation électronique",
      safeLabel: connection.safeLabel?.replace(/mock|sandbox|generic_pa|adapter/gi, "test interne") ?? "Facturation électronique",
      safeMetadata: null,
    })),
  });
}

function sanitizeProductText(value: string) {
  return value
    .replace(/mock/gi, "test interne")
    .replace(/sandbox/gi, "pré-activation")
    .replace(/generic_pa/gi, "PA à sélectionner")
    .replace(/adapter/gi, "connecteur");
}
