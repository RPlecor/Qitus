const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";

async function main() {
  const readiness = await requestJson<{
    provider: string;
    status: string;
    receptionCompliant: boolean;
    checks: Array<{ code: string; status: string }>;
    missingConfig: string[];
  }>("/api/e-invoice-providers/qonto-pa/readiness");
  check(readiness.provider === "qonto_pa", `Provider qonto_pa attendu, obtenu ${readiness.provider}.`);
  check(readiness.receptionCompliant === false, "Qonto PA ne doit pas etre marquee conforme avant contract test partenaire.");
  check(["contract_missing", "blocked", "sandbox_ready", "ready"].includes(readiness.status), `Statut Qonto PA inattendu : ${readiness.status}.`);
  check(readiness.checks.some((item) => item.code === "contract"), "Check contrat Qonto PA attendu.");
  check(readiness.checks.some((item) => item.code === "webhook_secret"), "Check webhook secret Qonto PA attendu.");

  const selection = await requestJson<{ candidates: Array<{ key: string; status: string }>; qontoPaReadiness: { status: string } }>("/api/e-invoice-providers/selection");
  check(selection.candidates[0]?.key === "qonto_pa", "Qonto PA doit etre la candidate prioritaire.");
  check(selection.qontoPaReadiness.status === readiness.status, "La selection PA doit reutiliser la readiness Qonto PA.");

  console.log(`Validation Qonto PA readiness OK sur ${baseUrl}`);
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(new URL(path, baseUrl), { headers: { Accept: "application/json" } });
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
