import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";

type ClosingProposal = {
  proposalKey: string;
  kind: string;
  status: string;
  journalEntryId: string | null;
};

async function main() {
  try {
    await resetDemo("closing_beta");
    await pageContains("/cloture/od", ["OD de clôture", "Workpapers", "Pièces manquantes"]);

    await requestJson<{ generated: number }>("/api/closing-adjustments/generate", { method: "POST" });
    const queue = await requestJson<{ reviews: Array<{ proposal: ClosingProposal; evidence: { missing: boolean }; freshness: { statusLabel: string } }> }>("/api/closing-adjustments/review");
    const fnp = queue.reviews.find((review) => review.proposal.kind === "FNP");
    const provision = queue.reviews.find((review) => review.proposal.kind === "PROVISION");
    check(Boolean(fnp), "Une FNP doit être présente dans la file OD.");
    check(Boolean(provision), "Une provision doit être présente dans la file OD.");

    await expectHttpError(`/api/closing-adjustments/${encodeURIComponent(fnp!.proposal.proposalKey)}/approve`, 409);
    await uploadDecisionEvidence(fnp!.proposal.proposalKey, "decision-fnp.txt");
    await requestJson<{ proposal: ClosingProposal }>(`/api/closing-adjustments/${encodeURIComponent(fnp!.proposal.proposalKey)}/recalculate`, { method: "POST" });
    const approved = await requestJson<{ proposal: ClosingProposal }>(`/api/closing-adjustments/${encodeURIComponent(fnp!.proposal.proposalKey)}/approve`, { method: "POST" });
    check(approved.proposal.status === "APPROVED", "La FNP doit être validée après rattachement de pièce.");
    check(Boolean(approved.proposal.journalEntryId), "La validation doit créer une écriture OD.");

    const rejected = await postForm<{ proposal: ClosingProposal }>(`/api/closing-adjustments/${encodeURIComponent(provision!.proposal.proposalKey)}/reject`, { note: "Provision non retenue après revue utilisateur." });
    check(rejected.proposal.status === "REJECTED", "La provision doit être rejetée avec note.");

    await pageContains("/cloture/od?tab=rejected", ["Rejetées", "Provision"]);
    await pageContains("/ecritures?journal=OD", ["OD", "FNP"]);
    await pageContains("/couverture/closing", ["Clôture", "OD"]);
    await pageContains("/cloture/CLOSING_ADJUSTMENTS", ["OD validées", "Workpapers"]);
    await pageContains("/activity", ["OD validée"]);

    console.log(`Validation closing end-user OK sur ${baseUrl}`);
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
  check(response.status === 200, `${path} attendu 200, obtenu ${response.status}: ${body.slice(0, 300)}`);
  for (const fragment of fragments) check(body.includes(fragment), `${path} ne contient pas "${fragment}".`);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, { ...init, headers: { Accept: "application/json", ...init?.headers } });
  const body = await response.text();
  check(response.ok, `${path} attendu OK, obtenu ${response.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body) as T;
}

async function postForm<T>(path: string, fields: Record<string, string>) {
  return requestJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
}

async function expectHttpError(path: string, status: number) {
  const response = await request(path, { method: "POST", headers: { Accept: "application/json" } });
  const body = await response.text();
  check(response.status === status, `${path} attendu ${status}, obtenu ${response.status}: ${body.slice(0, 300)}`);
  check(body.includes("pièce") || body.includes("Pièce"), `${path} doit expliquer la pièce manquante.`);
}

async function uploadDecisionEvidence(proposalKey: string, filename: string) {
  const form = new FormData();
  form.set("file", new File([`Décision utilisateur pour ${proposalKey}`], filename, { type: "text/plain" }));
  form.set("entityType", "CLOSING_ADJUSTMENT");
  form.set("entityId", proposalKey);
  form.set("relationType", "USER_DECISION");
  form.set("note", "Validation end-user clôture : décision utilisateur.");
  const response = await request("/api/attachments", { method: "POST", headers: { Accept: "application/json" }, body: form });
  const body = await response.text();
  check(response.ok, `/api/attachments attendu OK, obtenu ${response.status}: ${body.slice(0, 300)}`);
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
