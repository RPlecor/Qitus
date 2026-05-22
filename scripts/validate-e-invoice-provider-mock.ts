const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";

async function main() {
  const status = await requestJson<{ provider: string; configured: boolean }>("/api/e-invoice-providers/status");
  check(status.configured, "Provider facture électronique mock attendu configuré.");
  const sync = await requestJson<{ sync: { status: string; fetchedCount: number; importedCount: number } }>("/api/e-invoice-providers/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  check(sync.sync.status === "COMPLETED", `Sync attendue COMPLETED, obtenu ${sync.sync.status}.`);
  check(sync.sync.fetchedCount >= 1, "Provider mock doit fournir au moins une facture.");
  const invoices = await requestJson<{ invoices: Array<{ invoiceNumber: string | null }> }>("/api/e-invoices");
  check(invoices.invoices.some((invoice) => invoice.invoiceNumber === "MOCK-OVH-2025-001"), "Facture provider mock attendue.");
  console.log(`Validation provider facture électronique mock OK sur ${baseUrl}`);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
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
