import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";

async function main() {
  try {
    await resetDemo("closing_beta");
    await pageContains("/dossier-ec", ["Dossier EC", "Sections du dossier", "Partager au cabinet"]);
    const dossier = await requestJson<{ readiness: { score: number }; sections: Array<{ code: string; status: string }> }>("/api/expert-dossier");
    check(dossier.sections.some((section) => section.code === "fec"), "Le dossier doit exposer une section FEC.");
    check(dossier.sections.some((section) => section.code === "tax_package"), "Le dossier doit exposer une section liasse.");

    await generate("/api/documents/fec/generate");
    await generate("/api/documents/statements/generate");
    await generate("/api/documents/liasse/generate");
    const prepared = await requestJson<{ snapshot: { id: string; status: string } }>("/api/expert-dossier/prepare", { method: "POST" });
    check(prepared.snapshot.status === "SUBMITTED", "La préparation doit créer un snapshot SUBMITTED.");

    const sharePayload = await requestJson<{ shareLink: { id: string; token: string; url: string } }>("/api/expert-review/share-links", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ label: "Validation cabinet", expiresInDays: "30" }),
    });
    const share = sharePayload.shareLink;
    await requestJson<{ review: { id: string } }>("/api/expert-dossier/submit-review", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ shareLinkId: share.id, reviewerName: "Cabinet Demo" }),
    });

    await pageContains(share.url, ["Revue expert-comptable", "Commentaires et demandes", "Validation finale"]);
    const created = await requestJson<{ item: { id: string } }>(`/api/expert-review/shared/${share.token}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ sectionCode: "evidence", severity: "WARNING", title: "Demande de précision", body: "Merci de confirmer cette pièce.", authorName: "Cabinet Demo" }),
    });
    await requestJson(`/api/expert-review/items/${created.item.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ note: "Réponse validée côté utilisateur." }),
    });
    await requestJson(`/api/expert-review/shared/${share.token}/signoff`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ reviewerName: "Cabinet Demo", reviewerEmail: "demo@example.com", reviewNote: "Dossier revu." }),
    });

    const exported = await request("/api/expert-dossier/export");
    const body = await exported.text();
    check(exported.ok, `Export dossier attendu OK, obtenu ${exported.status}: ${body.slice(0, 300)}`);
    check(body.includes("Cabinet Demo"), "L'export final doit inclure la validation cabinet.");

    console.log(`Validation dossier EC OK sur ${baseUrl}`);
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

async function generate(path: string) {
  const response = await request(path, { method: "POST", headers: { Accept: "application/json" } });
  const body = await response.text();
  check(response.ok || response.status === 409, `${path} attendu OK/409 lisible, obtenu ${response.status}: ${body.slice(0, 300)}`);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, { ...init, headers: { Accept: "application/json", ...init?.headers } });
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
