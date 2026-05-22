import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";

type VatDeclaration = {
  id: string;
  type: string;
  status: string;
  active?: boolean;
  lifecycleStatus?: string;
  documentId: string | null;
};

async function main() {
  try {
    await resetDemo("regime_reel_tva");
    await resolveAccountingReviewBlockers();
    await pageContains("/tva", ["TVA", "REEL_SIMPLIFIE", "TVA collectée", "Générer CA12"]);
    const position = await requestJson<{ position: { regime: string; totals: { collected: number; deductible: number; net: number }; accounts: Array<{ account: string }> } }>("/api/vat/position");
    check(position.position.regime === "REEL_SIMPLIFIE", `Régime TVA attendu REEL_SIMPLIFIE, obtenu ${position.position.regime}.`);
    check(position.position.totals.collected > 0, "La position TVA doit contenir de la TVA collectée.");
    check(position.position.totals.deductible > 0, "La position TVA doit contenir de la TVA déductible.");
    check(position.position.accounts.some((account) => account.account === "44566"), "Les comptes TVA doivent inclure 44566.");
    check(position.position.accounts.some((account) => account.account === "44571"), "Les comptes TVA doivent inclure 44571.");

    const first = await generateVatDeclaration();
    check(first.declaration.type === "CA12", `Déclaration attendue CA12, obtenue ${first.declaration.type}.`);
    const second = await generateVatDeclaration();
    check(second.declaration.type === "CA12", "La régénération TVA doit retourner une CA12.");

    const declarations = await requestJson<{ declarations: VatDeclaration[] }>("/api/vat/declarations");
    const active = declarations.declarations.filter((declaration) => declaration.type === "CA12" && declaration.status === "DRAFT" && declaration.active !== false);
    const superseded = declarations.declarations.filter((declaration) => declaration.type === "CA12" && declaration.status === "SUPERSEDED");
    check(active.length === 1, `Une seule CA12 active attendue, obtenu ${active.length}.`);
    check(superseded.length >= 1, "La première CA12 doit être superseded après régénération.");

    const download = await request(`/api/vat/declarations/${active[0].id}/download`);
    const body = await download.text();
    check(download.ok, `Téléchargement TVA attendu OK, obtenu ${download.status}.`);
    check(download.headers.get("content-disposition")?.includes(".md") === true, "Le brouillon TVA doit être téléchargé en markdown.");
    check(body.includes("Déclaration TVA CA12 - brouillon"), "Le markdown téléchargé doit contenir le titre CA12.");

    await pageContains("/couverture/vat", ["TVA"]);
    await pageContains("/cloture/VAT_REVIEW", ["TVA annuelle"]);
    await generateDocuments("/api/documents/fec/generate");
    const bundle = await requestJson<{ vat: { position?: unknown; declarations?: VatDeclaration[]; declarationFreshness?: { activeCount: number } } }>("/api/documents/evidence-bundle");
    check(Boolean(bundle.vat.position), "Le paquet de preuve doit inclure vat.position.");
    check((bundle.vat.declarations ?? []).some((declaration) => declaration.type === "CA12"), "Le paquet de preuve doit inclure la déclaration CA12.");
    check(typeof bundle.vat.declarationFreshness?.activeCount === "number", "Le paquet de preuve doit inclure la fraîcheur TVA.");

    console.log(`Validation TVA OK sur ${baseUrl}`);
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

async function generateVatDeclaration() {
  return requestJson<{ declaration: VatDeclaration; documentId: string }>("/api/vat/declarations/generate", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ type: "CA12" }),
  });
}

async function generateDocuments(path: string) {
  const response = await request(path, { method: "POST", headers: { Accept: "application/json" } });
  const body = await response.text();
  check(response.ok, `${path} attendu OK, obtenu ${response.status}: ${body.slice(0, 300)}`);
}

async function resolveAccountingReviewBlockers() {
  const payload = await requestJson<{
    review: {
      controls: Array<{
        code: string;
        evidence: Array<{ entityId: string; label: string; amount: string; account?: string | null }>;
      }>;
    };
  }>("/api/accounting-review");
  const reviewControl = payload.review.controls.find((control) => control.code === "UNCORRECTED_TRANSACTIONS");
  if (!reviewControl) return;

  for (const transaction of reviewControl.evidence) {
    const amount = Number(transaction.amount);
    const operationalAccount = transaction.account && transaction.account !== "471" ? transaction.account : "627";
    const form = new URLSearchParams({
      accountDebit: amount >= 0 ? "5121" : operationalAccount,
      accountCredit: amount >= 0 ? operationalAccount : "5121",
      vatRate: "none",
      vatOperationNature: "OUT_OF_SCOPE",
      ecritureLabel: transaction.label,
    });
    const response = await request(`/api/transactions/${transaction.entityId}/categorize`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const body = await response.text();
    check(response.ok, `Correction ${transaction.label} attendue OK, obtenu ${response.status}: ${body.slice(0, 300)}`);
  }

  const after = await requestJson<{ review: { blockingCount: number } }>("/api/accounting-review");
  check(after.review.blockingCount === 0, `Contrôle comptable attendu sans blocage, obtenu ${after.review.blockingCount}.`);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, { ...init, headers: { Accept: "application/json", ...init?.headers } });
  const body = await response.text();
  check(response.ok, `${path} attendu OK, obtenu ${response.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body) as T;
}

async function request(path: string, init?: RequestInit) {
  return fetch(new URL(path, baseUrl), init);
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
