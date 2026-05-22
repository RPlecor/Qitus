const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";

async function main() {
  const contract = await requestJson<{ requiredSteps: string[] }>("/api/e-invoice-providers/contract-test");
  check(contract.requiredSteps.includes("sync"), "Le contrat provider doit couvrir la synchronisation.");
  const report = await requestJson<{ status: string; summary: { failed: number; total: number }; steps: Array<{ code: string; status: string }> }>("/api/e-invoice-providers/contract-test/run", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  check(report.status === "passed", `Contrat provider attendu passed, obtenu ${report.status} (${report.summary.failed}/${report.summary.total}).`);
  check(report.steps.some((step) => step.code === "webhook" && step.status === "passed"), "Etape webhook attendue.");
  console.log(`Validation contrat provider facture electronique OK sur ${baseUrl}`);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(path, baseUrl), { ...init, headers: { Accept: "application/json", ...init?.headers } });
  const body = await response.text();
  check(response.ok, `${path} attendu OK, obtenu ${response.status}: ${body.slice(0, 500)}`);
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
