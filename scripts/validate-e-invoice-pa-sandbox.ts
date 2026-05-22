const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";

async function main() {
  const status = await requestJson<{ provider: string; mode: string; receptionCompliant: boolean }>("/api/e-invoice-providers/status");
  check(status.provider === "sandbox" || status.mode === "sandbox", `E_INVOICE_PROVIDER=sandbox attendu, obtenu ${status.provider}/${status.mode}.`);
  check(status.receptionCompliant === false, "La sandbox ne doit jamais etre marquee conforme PA reelle.");
  await requestJson("/api/e-invoice-providers/connect", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  const sync = await requestJson<{ sync: { status: string; fetchedCount: number; importedCount: number } }>("/api/e-invoice-providers/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  check(sync.sync.status === "COMPLETED", `Sync sandbox attendue COMPLETED, obtenu ${sync.sync.status}.`);
  check(sync.sync.fetchedCount >= 4, "La sandbox doit exposer les cas doublon/rejet/annulation/XML invalide.");
  const invoices = await requestJson<{ invoices: Array<{ invoiceNumber: string | null; providerStatus?: string | null; status: string }> }>("/api/e-invoices");
  check(invoices.invoices.some((invoice) => invoice.invoiceNumber === "SANDBOX-OVH-2025-001"), "Facture sandbox valide attendue.");
  check(invoices.invoices.some((invoice) => invoice.providerStatus === "REJECTED" || invoice.providerStatus === "CANCELLED" || invoice.status === "ERROR"), "Cas sandbox de rejet/annulation/erreur attendu.");
  console.log(`Validation sandbox PA facture electronique OK sur ${baseUrl}`);
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
