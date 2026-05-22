import { test } from "@playwright/test";
import {
  correctAllReviewTransactions,
  expectActivityTimeline,
  expectChatAndBilling,
  expectInitialMvpState,
  generateAndDownloadDocuments,
  resolveOneEvidenceRequirement,
  runAnnualClosing,
} from "./mvp-scenario";
import { resetDemoDataset } from "./demo-reset";

test("MVP end-user path stays usable from dashboard to documents", async ({ page }) => {
  await resetDemoDataset("qonto_mvp");
  await expectInitialMvpState(page);
  await correctAllReviewTransactions(page);
  await resolveOneEvidenceRequirement(page);
  await generateAndDownloadDocuments(page);
  await runAnnualClosing(page);
  await expectChatAndBilling(page);
  await expectActivityTimeline(page);
});
