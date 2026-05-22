const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";

async function main() {
  const status = await requestJson<{ configured: boolean; readiness: { status: string } }>("/api/e-invoice-providers/status");
  check(status.configured, "Le provider facture électronique doit être configuré pour le parcours PA mock.");
  await requestJson("/api/e-invoice-providers/connect", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  const sync = await requestJson<{ sync: { status: string; importedCount: number } }>("/api/e-invoice-providers/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  check(sync.sync.status === "COMPLETED", `Sync PA attendue COMPLETED, obtenu ${sync.sync.status}.`);
  const invoices = await requestJson<{ invoices: Array<{ id: string; source: string; providerStatus?: string | null }> }>("/api/e-invoices");
  const invoice = invoices.invoices.find((item) => item.source === "PROVIDER");
  check(invoice, "Une facture reçue via provider PA mock est attendue.");
  check(invoice.providerStatus === "AVAILABLE", `Statut PA AVAILABLE attendu, obtenu ${invoice.providerStatus}.`);
  const audit = await requestJson<{ events: unknown[]; syncs: unknown[]; connections: unknown[] }>("/api/e-invoice-providers/audit");
  check(audit.syncs.length > 0, "Audit PA doit contenir au moins une synchronisation.");
  check(audit.connections.length > 0, "Audit PA doit contenir la connexion provider.");
  console.log(`Validation parcours PA facture électronique OK sur ${baseUrl}`);
}

async function requestJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(path, baseUrl), { ...init, headers: { Accept: "application/json", ...init?.headers } });
  const body = await response.text();
  check(response.ok, `${path} attendu OK, obtenu ${response.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body) as T;
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

export {};
