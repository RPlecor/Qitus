const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";

async function main() {
  const status = await requestJson<{
    provider: string;
    mode: string;
    readiness: { status: string; message: string };
    configured: boolean;
  }>("/api/e-invoice-providers/status");
  check(status.provider.length > 0, "Provider facture électronique attendu.");
  check(["disabled", "mock", "generic_pa", "live"].includes(status.mode), `Mode PA inattendu: ${status.mode}`);
  check(status.readiness.message.length > 0, "Readiness PA doit fournir un message lisible.");
  console.log(`Validation readiness PA facture électronique OK sur ${baseUrl}: ${status.provider}/${status.readiness.status}`);
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
