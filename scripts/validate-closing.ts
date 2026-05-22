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
    await pageContains("/cloture/od", ["OD de clôture", "Workpapers", "FNP", "Variation de stock"]);

    const workpapers = await requestJson<{ workpapers: Array<{ kind: string; status: string }> }>("/api/closing-workpapers");
    check(workpapers.workpapers.some((workpaper) => workpaper.kind === "FNP" && workpaper.status === "READY"), "closing_beta doit charger un workpaper FNP prêt.");
    check(workpapers.workpapers.some((workpaper) => workpaper.kind === "STOCK_VARIATION"), "closing_beta doit charger un workpaper de stock.");

    const generated = await requestJson<{ generated: number; proposals: ClosingProposal[] }>("/api/closing-adjustments/generate", { method: "POST" });
    check(generated.generated >= 5, `Au moins 5 propositions OD attendues, obtenu ${generated.generated}.`);

    const proposals = await requestJson<{ proposals: ClosingProposal[] }>("/api/closing-adjustments");
    const fnp = proposals.proposals.find((proposal) => proposal.kind === "FNP");
    const stock = proposals.proposals.find((proposal) => proposal.kind === "STOCK_VARIATION");
    check(Boolean(fnp), "Une proposition FNP doit être visible.");
    check(Boolean(stock), "Une proposition variation de stock doit être visible.");
    await pageContains(`/controle/od/${encodeURIComponent(fnp!.proposalKey)}`, ["OD proposée", "FNP", "Lignes débit/crédit"]);

    await uploadDecisionEvidence(fnp!.proposalKey, "decision-fnp.txt");
    await requestJson<{ proposal: ClosingProposal }>(`/api/closing-adjustments/${encodeURIComponent(fnp!.proposalKey)}/recalculate`, { method: "POST" });
    const approved = await requestJson<{ proposal: ClosingProposal }>(`/api/closing-adjustments/${encodeURIComponent(fnp!.proposalKey)}/approve`, { method: "POST" });
    check(approved.proposal.status === "APPROVED", "La FNP validée doit passer APPROVED.");
    check(Boolean(approved.proposal.journalEntryId), "La validation FNP doit créer une écriture OD.");

    await pageContains("/ecritures?journal=OD", ["OD", "FNP"]);
    const readiness = await requestJson<{ status: string; workpapers: { total: number; proposals: { approved: number } } }>("/api/closing-adjustments/readiness");
    check(readiness.workpapers.total >= 5, "Le readiness doit inclure les workpapers.");
    check(readiness.workpapers.proposals.approved >= 1, "Le readiness doit compter l'OD validée.");

    await pageContains("/couverture/closing", ["Clôture"]);
    await pageContains("/cloture/CLOSING_ADJUSTMENTS", ["OD validées", "Workpapers"]);

    console.log(`Validation closing OK sur ${baseUrl}`);
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

async function uploadDecisionEvidence(proposalKey: string, filename: string) {
  const form = new FormData();
  form.set("file", new File([`Décision utilisateur pour ${proposalKey}`], filename, { type: "text/plain" }));
  form.set("entityType", "CLOSING_ADJUSTMENT");
  form.set("entityId", proposalKey);
  form.set("relationType", "USER_DECISION");
  form.set("note", "Validation closing : pièce de décision utilisateur.");
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
