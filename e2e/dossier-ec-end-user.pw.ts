import { expect, test } from "@playwright/test";
import { resetDemoDataset } from "./demo-reset";

test("dossier EC collaborative review and export", async ({ page }) => {
  await resetDemoDataset("closing_beta");
  const requestTitle = `Demande end-user ${Date.now()}`;
  await page.goto("/dossier-ec");
  await expect(page.getByText("Dossier EC — Dossier de révision collaboratif")).toBeVisible();
  await expect(page.getByText("File readiness dossier")).toBeVisible();

  await page.getByRole("button", { name: "Préparer le dossier" }).click();
  await expect(page.getByText(/Snapshot de dossier préparé|Le dossier contient encore/)).toBeVisible();

  const shareForm = page.locator("form").filter({ hasText: "Partager au cabinet" }).first();
  await shareForm.locator("input[name='label']").fill("Dossier EC end-user");
  await shareForm.locator("input[name='expiresInDays']").fill("30");
  await shareForm.getByRole("button", { name: "Partager au cabinet" }).click();
  await expect(page.getByText("Lien cabinet créé")).toBeVisible();

  const href = await page.locator(".alert a[href^='/shared/']").first().getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  await expect(page.getByRole("heading", { name: /.+/ }).first()).toBeVisible();
  await expect(page.locator(".eyebrow", { hasText: "Revue expert-comptable" })).toBeVisible();
  await expect(page.getByText("Commentaires et demandes")).toBeVisible();

  const requestForm = page.locator("form").filter({ hasText: "Créer une demande" }).first();
  await requestForm.locator("input[name='sectionCode']").fill("evidence");
  await requestForm.locator("select[name='severity']").selectOption("WARNING");
  await requestForm.locator("input[name='authorName']").fill("Cabinet Demo");
  await requestForm.locator("input[name='title']").fill(requestTitle);
  await requestForm.locator("textarea[name='body']").fill("Merci de confirmer cette pièce.");
  await requestForm.getByRole("button", { name: "Créer une demande" }).click();
  await expect(page.getByText(requestTitle)).toBeVisible();

  await page.goto("/dossier-ec/revue");
  await expect(page.getByText(requestTitle)).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: requestTitle }).first();
  await row.locator("input[name='body']").fill("Réponse utilisateur end-user.");
  await row.getByRole("button", { name: "Répondre" }).click();
  await expect(page.getByText("ANSWERED").first()).toBeVisible();
  await row.locator("input[name='note']").fill("Demande traitée.");
  await row.getByRole("button", { name: "Résoudre" }).click();
  await expect(page.getByText("RESOLVED").first()).toBeVisible();

  await page.goto(href!);
  await page.locator("input[name='reviewerName']").fill("Cabinet Demo");
  await page.locator("input[name='reviewerEmail']").fill("demo@example.com");
  await page.locator("textarea[name='reviewNote']").fill("Dossier signé côté end-user.");
  await page.getByRole("button", { name: "Valider le dossier" }).click();
  await expect(page.getByText("Validation enregistrée")).toBeVisible();

  await page.goto("/dossier-ec");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Exporter dossier final" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/dossier-ec-.*\.json/);

  await page.goto("/activity");
  await expect(page.getByText("Dossier signé par l'expert-comptable").first()).toBeVisible();
  await page.goto("/couverture/expert_review");
  await expect(page.getByText("Revue expert-comptable — Détail couverture expert-comptable")).toBeVisible();
});
