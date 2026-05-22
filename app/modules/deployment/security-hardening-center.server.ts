import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { assertFiscalYearMutable } from "../annual-closing/annual-closing-center.server";
import { getRuntimeConfig, sanitizedRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export class SecurityHardeningCenter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  getSecurityStatus() {
    const runtime = sanitizedRuntimeConfig(this.config);
    return {
      cookieSecure: this.config.cookieSecure,
      sessionSecretConfigured: Boolean(this.config.sessionSecret),
      productionStrict: this.config.appEnv === "production",
      secretsRedacted: true,
      runtime,
      checks: [
        { code: "session_secret", ok: this.config.appEnv !== "production" || Boolean(this.config.sessionSecret), label: "Session secret configuré" },
        { code: "secure_cookie", ok: this.config.appEnv !== "production" || this.config.cookieSecure, label: "Cookies secure en production" },
        { code: "auth_clerk", ok: this.config.appEnv !== "production" || this.config.authMode === "clerk", label: "Auth Clerk en production" },
        { code: "storage_s3", ok: this.config.appEnv !== "production" || this.config.objectStorageMode === "s3", label: "Stockage objet en production" },
        { code: "billing_stripe", ok: this.config.appEnv !== "production" || this.config.billingMode === "stripe", label: "Billing Stripe en production" },
        { code: "clerk_webhook_secret", ok: this.config.authMode !== "clerk" || Boolean(this.config.clerkWebhookSecret), label: "Webhook Clerk signé" },
        { code: "stripe_webhook_secret", ok: this.config.billingMode !== "stripe" || Boolean(this.config.stripeWebhookSecret), label: "Webhook Stripe signé" },
        { code: "open_banking_webhook_secret", ok: this.config.openBankingProvider === "disabled" || this.config.openBankingProvider === "mock" || this.config.openBankingProvider === "gocardless" || Boolean(this.config.openBankingWebhookSecret), label: "Webhook Open Banking signé" },
        { code: "provider_secret_vault", ok: this.config.appEnv === "local" || this.config.openBankingProvider === "disabled" || this.config.openBankingProvider === "mock" || this.config.openBankingProvider === "gocardless" || Boolean(this.config.providerSecretEncryptionKey), label: "Coffre secrets provider configuré" },
      ],
    };
  }

  async assertFiscalYearMutable(workspace: CompanyWorkspace) {
    return assertFiscalYearMutable(workspace);
  }

  redact(input: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(input).map(([key, value]) => [
      key,
      /secret|token|password|key/i.test(key) ? "[redacted]" : value,
    ]));
  }
}
