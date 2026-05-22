import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";

async function main() {
  try {
    await resetDemo("closing_beta");
    await pageContains("/rapprochements", ["Rapprochements", "Banque", "Stripe", "attente"]);

    await post("/api/reconciliations/bank/run");
    await pageContains("/rapprochements/banque", ["Rapprochement bancaire", "Matchés"]);
    await pageContains("/rapprochements", ["À jour", "Revue des issues"]);

    await post("/api/reconciliations/stripe/import-fixture");
    await post("/api/reconciliations/stripe/run");
    await pageContains("/rapprochements/stripe", ["Rapprochement Stripe", "Événements Stripe", "À jour"]);

    await post("/api/reconciliations/third-party/run");
    await pageContains("/rapprochements/tiers", ["Lettrage tiers"]);
    await pageContains("/rapprochements/attente", ["attente"]);
    await pageContains("/rapprochements/revue", ["Revue des rapprochements"]);

    const overview = await requestJson<{ readiness: { issues: { open: number }; bank: { totalMatches: number }; stripe: { payouts: number } } }>("/api/reconciliations");
    check(overview.readiness.bank.totalMatches > 0, "Le rapprochement bancaire doit produire des matches.");
    check(overview.readiness.stripe.payouts > 0, "Le rapprochement Stripe doit importer des payouts.");
    const freshness = await requestJson<{ freshness: { runs: { BANK: { status: string; label: string } } } }>("/api/reconciliations/freshness");
    check(freshness.freshness.runs.BANK.status === "fresh", `Rapprochement banque attendu fresh, obtenu ${freshness.freshness.runs.BANK.status}.`);
    const report = await requestJson<{ report: { bank: { matches: unknown[] }; stripe: { events: unknown[] } } }>("/api/reconciliations/report");
    check(report.report.bank.matches.length > 0, "Le rapport doit inclure les matches bancaires.");
    check(report.report.stripe.events.length > 0, "Le rapport doit inclure les événements Stripe.");
    const queue = await requestJson<{ queue: { issues: Array<{ issueKey: string; status: string }> } }>("/api/reconciliations/issues?status=OPEN");
    const issue = queue.queue.issues[0];
    if (issue) {
      await postForm(`/api/reconciliations/issues/${encodeURIComponent(issue.issueKey)}/ignore`, { note: "Validation rapprochements : ignore audité." });
      await postForm(`/api/reconciliations/issues/${encodeURIComponent(issue.issueKey)}/reopen`, { note: "Validation rapprochements : réouverture auditée." });
      const detail = await requestJson<{ issue: { issue: { status: string }; action: string } }>(`/api/reconciliations/issues/${encodeURIComponent(issue.issueKey)}`);
      check(detail.issue.issue.status === "OPEN", "L'issue rouverte doit redevenir OPEN.");
      check(Boolean(detail.issue.action), "Le détail issue doit exposer une action recommandée.");
    }
    await requestJson<{ status: { connectors: Array<{ message: string }> } }>("/api/connectors/status");

    await pageContains("/couverture/reconciliations", ["Rapprochements"]);
    await pageContains("/cloture/BANK_RECONCILIATION", ["Rapprochement bancaire"]);
    await pageContains("/cloture/THIRD_PARTY_MATCHING", ["Lettrage tiers"]);

    console.log(`Validation rapprochements OK sur ${baseUrl}`);
  } finally {
    await resetDemo("qonto_mvp");
  }
}

async function resetDemo(dataset: string) {
  await execFileAsync("npm", ["run", "demo:reset"], {
    cwd: process.cwd(),
    env: { ...process.env, DEMO_DATASET: dataset },
  });
}

async function pageContains(path: string, fragments: string[]) {
  const response = await request(path);
  const body = await response.text();
  check(response.status === 200, `${path} attendu 200, obtenu ${response.status}.`);
  for (const fragment of fragments) check(body.includes(fragment), `${path} ne contient pas "${fragment}".`);
}

async function post(path: string) {
  const response = await request(path, { method: "POST", headers: { Accept: "application/json" } });
  const body = await response.text();
  check(response.ok, `${path} attendu OK, obtenu ${response.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) as unknown : null;
}

async function postForm(path: string, fields: Record<string, string>) {
  const response = await request(path, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  const body = await response.text();
  check(response.ok, `${path} attendu OK, obtenu ${response.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) as unknown : null;
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await request(path, { headers: { Accept: "application/json" } });
  const body = await response.text();
  check(response.ok, `${path} attendu OK, obtenu ${response.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body) as T;
}

function request(path: string, init?: RequestInit) {
  return fetch(new URL(path, baseUrl), init);
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
