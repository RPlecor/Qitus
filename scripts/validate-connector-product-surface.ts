const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";
const forbidden = ["mock", "fixture", "sandbox", "generic_pa", "adapter"];

async function main() {
  const paths = ["/api/connectors/status", "/api/open-banking/status", "/api/e-invoice-providers/status"];
  for (const path of paths) {
    const payload = await requestJson(path);
    const serialized = JSON.stringify(payload).toLowerCase();
    for (const word of forbidden) {
      check(!serialized.includes(word), `${path} expose encore le libellé technique "${word}".`);
    }
  }
  console.log(`Validation surface connecteurs produit OK sur ${baseUrl}`);
}

async function requestJson(path: string): Promise<unknown> {
  const response = await fetch(new URL(path, baseUrl), { headers: { Accept: "application/json" } });
  const body = await response.text();
  check(response.ok, `${path} attendu OK, obtenu ${response.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

export {};
