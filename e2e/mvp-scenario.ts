import { expect, type Download, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function goToSidebar(page: Page, label: string) {
  await page.getByRole("navigation").getByRole("link", { name: label, exact: true }).click();
}

export async function expectInitialMvpState(page: Page) {
  await page.goto("/dashboard");
  await expect(page.getByText("2 transactions à vérifier")).toBeVisible();
  await expect(page.getByText("Exploitation cohérente")).toBeVisible();

  await goToSidebar(page, "TVA");
  await expect(page.getByText("Position déclarative et brouillons CA3/CA12")).toBeVisible();
  await expect(page.getByText("Franchise en base", { exact: true })).toBeVisible();
  await expect(page.getByText("Non applicable")).toBeVisible();

  await goToSidebar(page, "Transactions");
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByText("42 transactions importées")).toBeVisible();
  await expect(page.getByText("VIREMENT REF 789456123")).toBeVisible();
  await expect(page.getByText("DEPOT COMPTES ANNUELS 2024")).toBeVisible();
  await expect(page.getByRole("link", { name: "Corriger" })).toHaveCount(2);
  await page.getByLabel("Statut").selectOption("review");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page.getByText("2 affichées")).toBeVisible();
  await page.getByLabel("Recherche").fill("stripe");
  await page.getByLabel("Statut").selectOption("all");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page.getByText("PAYOUT MARS 2025")).toBeVisible();

  await goToSidebar(page, "Écritures");
  await expect(page.getByText("40 écritures · 80 lignes")).toBeVisible();
  await expect(page.getByText("Journal équilibré")).toBeVisible();

  await goToSidebar(page, "Contrôle");
  await expect(page.getByText("Pré-clôture bloquée")).toBeVisible();
  await expect(page.getByText("2 transactions à corriger")).toBeVisible();
  await page.getByRole("link", { name: /Traiter les CCA/ }).click();
  await expect(page).toHaveURL(/\/controle\/ANNUAL_CHARGE_CCA$/);
  await page.locator("textarea[name='note']").first().fill("CCA revue pendant la validation end-user.");
  await page.getByRole("button", { name: "Marquer résolu" }).first().click();
  await expect(page.getByText("Résolu").first()).toBeVisible();
}

export async function correctAllReviewTransactions(page: Page) {
  await page.goto("/transactions?status=review");
  await correctFirstReviewTransaction(page, true, "next");
  await expectLearnedRuleLifecycle(page);
  await correctFirstReviewTransaction(page, false, "empty");

  await page.goto("/transactions?status=review");
  await expect(page.getByText("Aucune transaction à corriger").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Corriger" })).toHaveCount(0);

  await goToSidebar(page, "Écritures");
  await expect(page.getByText("42 écritures · 84 lignes")).toBeVisible();
  await expect(page.getByText("Équilibré", { exact: true })).toBeVisible();
  await expect(page.getByText("Journal équilibré")).toBeVisible();
  await page.getByLabel("Journal").selectOption("BQ");
  await page.getByLabel("Compte").fill("5121");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/journal=BQ/);
  await expect(page.getByText("Équilibré", { exact: true })).toBeVisible();

  await goToSidebar(page, "Documents");
  await generateCard(page, "FEC");
  await expect(page.getByRole("cell", { name: "912345678FEC20251231.txt" })).toBeVisible();
  await expect(page.getByText("À jour").first()).toBeVisible();
  await expect(page.getByText("Audit génération")).toBeVisible();
  await expect(page.getByText("Dernière génération réussie")).toBeVisible();

  await goToSidebar(page, "Contrôle");
  await expect(page.getByText("Documents générables")).toBeVisible();
  await expect(page.getByText("Charges annuelles à revoir en CCA").first()).toBeVisible();
  await approveFirstClosingAdjustment(page);

  await goToSidebar(page, "Écritures");
  await expect(page.getByText("43 écritures · 86 lignes")).toBeVisible();
  await page.getByLabel("Journal").selectOption("OD");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: "Clôture" }).first()).toBeVisible();
  const journalDownload = await downloadJournal(page);
  expect(journalDownload.suggestedFilename()).toBe("journal-entries.csv");
  await goToSidebar(page, "Documents");
  await expect(page.getByText("À régénérer").first()).toBeVisible();
}

export async function generateAndDownloadDocuments(page: Page) {
  await goToSidebar(page, "Documents");
  await generateCard(page, "FEC");
  await expect(page.getByRole("cell", { name: "912345678FEC20251231.txt" })).toBeVisible();
  await expect(page.getByText("Audit génération")).toBeVisible();
  await expect(page.getByText("Dernière génération réussie")).toBeVisible();

  const bundleDownload = await downloadEvidenceBundle(page);
  expect(bundleDownload.suggestedFilename()).toBe("qitus-evidence-2025.json");
  const bundlePath = await bundleDownload.path();
  expect(bundlePath).toBeTruthy();
  const manifest = JSON.parse(await readFile(bundlePath!, "utf8")) as {
    journal: { auditStatus: string; csv: string };
    documents: Array<{ filename: string }>;
    attachments: { files: Array<{ filename: string; contentBase64: string | null }> };
  };
  expect(manifest.journal.auditStatus).toBe("exportable");
  expect(manifest.journal.csv).toContain("\"journal\"");
  expect(manifest.documents.some((document) => document.filename === "912345678FEC20251231.txt")).toBe(true);
  expect(manifest.attachments.files.some((file) => file.filename === "ovh-facture.txt" && file.contentBase64)).toBe(true);

  const download = await downloadFec(page);
  expect(download.suggestedFilename()).toBe("912345678FEC20251231.txt");
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const content = await readFile(filePath!, "utf8");
  expect(content).toContain("JournalCode");
  expect(content).toContain("OD");
  expect(content).toContain("CCA");

  await generateCard(page, "États financiers");
  await expect(page.getByRole("cell", { name: "balance.md" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "bilan.md" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "compte-de-resultat.md" })).toBeVisible();
}

export async function resolveOneEvidenceRequirement(page: Page) {
  await goToSidebar(page, "Pièces");
  await page.getByRole("link", { name: "Revue guidée" }).click();
  await expect(page).toHaveURL(/\/pieces\/revue$/);
  await expect(page.getByText("Revue des pièces")).toBeVisible();
  const beforeText = await page.locator(".kpi").filter({ hasText: "À fournir" }).textContent();

  const row = page.getByRole("row").filter({ hasText: "OVH" }).first();
  await row.locator("input[type='file']").setInputFiles(path.join(process.cwd(), "fixtures", "evidence", "ovh-facture.txt"));
  await row.getByRole("button", { name: "Fournir une pièce" }).click();
  await expect(page.getByText("Pièce fournie et rattachée")).toBeVisible();

  await page.goto("/pieces");
  await expect(page.getByText("ovh-facture.txt")).toBeVisible();
  await page.goto("/couverture/evidence");
  await expect(page.getByRole("heading", { name: "Justificatifs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Satisfaites" })).toBeVisible();
  expect(beforeText).toBeTruthy();
}

export async function runAnnualClosing(page: Page) {
  await goToSidebar(page, "Clôture");
  await expect(page.getByText("Workflow annuel")).toBeVisible();
  await page.getByRole("button", { name: "Démarrer la clôture" }).click();
  await expect(page.getByText("Vérification balance")).toBeVisible();

  await goToSidebar(page, "Immobilisations");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("MacBook Pro 14 pouces M3")).toBeVisible();
  await expect(page.getByText(/563/).first()).toBeVisible();

  await goToSidebar(page, "Rapprochements");
  await page.getByRole("link", { name: /Banque/ }).click();
  await page.getByRole("button", { name: "Lancer le rapprochement bancaire" }).click();
  await expect(page.getByText("42").first()).toBeVisible();

  await goToSidebar(page, "Clôture");
  await page.getByRole("row").filter({ hasText: "Rapprochement bancaire" }).getByRole("link", { name: "Détail", exact: true }).click();
  await expect(page).toHaveURL(/\/cloture\/BANK_RECONCILIATION$/);
  const balance = await page.locator("text=Solde comptable").locator("..").textContent();
  await page.getByRole("button", { name: "Enregistrer et confirmer" }).click();
  await expect(page.getByText("Étape terminée")).toBeVisible();
  expect(balance).toBeTruthy();

  for (const title of [
    "Vérification balance",
    "Lettrage tiers",
    "PCA / CCA",
    "Amortissements",
    "Provisions",
    "TVA annuelle",
    "Calcul IS / IR",
    "Écritures de clôture",
    "États financiers",
    "Liasse fiscale",
    "Export et archivage",
  ]) {
    await page.goto("/cloture");
    await page.getByRole("row").filter({ hasText: title }).getByRole("link", { name: "Détail", exact: true }).click();
    await page.getByRole("button", { name: "Exécuter l'étape" }).click();
    await expect(page.getByText("Étape terminée")).toBeVisible();
  }

  await page.goto("/cloture/archive");
  await expect(page.getByText("Archive prête")).toBeVisible();
  await expect(page.getByText("qitus-evidence-2025.json")).toBeVisible();

  await page.goto("/cloture");
  await page.getByRole("button", { name: "Clôturer l'exercice" }).click();
  await expect(page.getByText("Exercice clôturé")).toBeVisible();
  await expect(page.getByText("CLOSED")).toBeVisible();
  await page.getByRole("button", { name: "Réouvrir" }).click();
  await expect(page.getByText("Clôture en cours")).toBeVisible();
}

export async function expectActivityTimeline(page: Page) {
  await goToSidebar(page, "Activité");
  await expect(page.getByText("Point de contrôle résolu").first()).toBeVisible();
  await expect(page.getByText("Hypothèses OD modifiées").first()).toBeVisible();
  await expect(page.getByText("OD recalculée").first()).toBeVisible();
  await expect(page.getByText("OD validée").first()).toBeVisible();
  await expect(page.getByText("Documents à régénérer").first()).toBeVisible();
  await expect(page.getByText("Audit génération réussi").first()).toBeVisible();
  await expect(page.getByText("Paquet de preuve téléchargé").first()).toBeVisible();
  await expect(page.getByText("Transaction corrigée").first()).toBeVisible();
  await expect(page.getByText("Document généré").first()).toBeVisible();
  await expect(page.getByText("Document téléchargé").first()).toBeVisible();
  await expect(page.getByText("Clôture démarrée").first()).toBeVisible();
  await expect(page.getByText("Exercice clôturé").first()).toBeVisible();
  await expect(page.getByText("Exercice rouvert").first()).toBeVisible();
}

export async function expectChatAndBilling(page: Page) {
  await goToSidebar(page, "Chat");
  await expect(page.getByText("Chat comptable")).toBeVisible();
  await expect(page.getByText("Chat en lecture seule")).toBeVisible();
  await expect(page.getByText("IA ce mois")).toBeVisible();

  await goToSidebar(page, "Abonnement");
  await expect(page.getByText("Abonnement").first()).toBeVisible();
  await expect(page.getByText("Abonnement stub actif")).toBeVisible();
  await expect(page.getByText("SOLO").first()).toBeVisible();
}

async function approveFirstClosingAdjustment(page: Page) {
  const row = page.getByRole("row").filter({ hasText: "CCA" }).filter({ hasText: "À valider" }).first();
  await row.getByRole("link", { name: "Voir" }).click();
  await expect(page).toHaveURL(/\/controle\/od\//);
  await page.getByLabel("Montant N+1").fill("55.25");
  await page.getByLabel("Période couverte").fill("2026-01-01/2026-02-10");
  await page.getByRole("button", { name: "Enregistrer les hypothèses" }).click();
  await expect(page.getByText("recalcul recommandé").first()).toBeVisible();
  const proposalKey = decodeURIComponent(new URL(page.url()).pathname.split("/").pop() ?? "");
  await uploadDecisionEvidence(page, proposalKey);
  await page.getByRole("button", { name: "Recalculer" }).click();
  await expect(page.getByText("v2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Valider l'OD" })).toBeVisible();
  await page.getByRole("button", { name: "Valider l'OD" }).click();
  await expect(page.getByText("OD validée : l'écriture est")).toBeVisible();
}

async function uploadDecisionEvidence(page: Page, proposalKey: string) {
  const response = await page.request.post("/api/attachments", {
    multipart: {
      file: {
        name: "decision-od.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(`Décision utilisateur pour ${proposalKey}`),
      },
      entityType: "CLOSING_ADJUSTMENT",
      entityId: proposalKey,
      relationType: "USER_DECISION",
      note: "Validation end-user : décision utilisateur.",
    },
    headers: { Accept: "application/json" },
  });
  expect(response.ok()).toBe(true);
}

async function expectLearnedRuleLifecycle(page: Page) {
  await goToSidebar(page, "Règles");
  await expect(page.getByText("Règles existantes")).toBeVisible();
  await expect(page.getByRole("button", { name: "Désactiver" }).first()).toBeVisible();
  await page.getByRole("link", { name: /match/ }).first().click();
  await expect(page).toHaveURL(/\/corrections\//);
  await expect(page.getByText("Transactions exemples")).toBeVisible();
  await page.getByRole("link", { name: "← Retour aux règles" }).click();
  await page.getByRole("button", { name: "Désactiver" }).first().click();
  await expect(page.getByRole("button", { name: "Réactiver" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Réactiver" }).first().click();
  await expect(page.getByRole("button", { name: "Désactiver" }).first()).toBeVisible();
}

async function correctFirstReviewTransaction(page: Page, learn = false, expected: "next" | "empty" = "empty") {
  await page.goto("/transactions?status=review");
  await page.getByRole("link", { name: "Corriger" }).first().click();
  await expect(page.getByText("Correction transaction")).toBeVisible();
  await expect(page.getByText("Transaction à vérifier")).toBeVisible();
  if (learn) await page.getByLabel("Apprendre cette correction").check();
  await page.getByRole("button", { name: "Valider la catégorisation" }).click();
  if (expected === "next") {
    await expect(page).toHaveURL(/\/transactions\/.+status=review/);
    await expect(page.getByText("1 / 1 à corriger")).toBeVisible();
  } else {
    await expect(page).toHaveURL(/\/transactions\?status=review/);
    await expect(page.getByText("Aucune transaction à corriger").first()).toBeVisible();
  }
}

async function generateCard(page: Page, title: string) {
  const card = page.locator(".doc-card").filter({ hasText: title });
  const path = title === "FEC" ? "/api/documents/fec/generate" : "/api/documents/statements/generate";
  await Promise.all([
    page.waitForResponse((response) => response.url().includes(path) && response.request().method() === "POST"),
    card.getByRole("button", { name: "Générer" }).click(),
  ]);
  await expect(page).toHaveURL(/\/documents$/);
}

async function downloadFec(page: Page): Promise<Download> {
  const row = page.getByRole("row").filter({ hasText: "912345678FEC20251231.txt" });
  const downloadPromise = page.waitForEvent("download");
  await row.getByRole("link", { name: "Télécharger" }).click();
  return downloadPromise;
}

async function downloadEvidenceBundle(page: Page): Promise<Download> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Télécharger paquet de preuve" }).click();
  return downloadPromise;
}

async function downloadJournal(page: Page): Promise<Download> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exporter CSV" }).click();
  return downloadPromise;
}
