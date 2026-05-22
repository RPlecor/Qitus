const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";

type GeneratedDocument = {
  id: string;
  type: string;
  filename: string;
};

async function main() {
  await pageContains("/dashboard", ["Charges", "Résultat", "2 transactions à vérifier", "Exploitation cohérente"]);
  await expectOperationalConsistency("consistent");
  await pageContains("/tva", ["TVA", "FRANCHISE", "Non applicable", "Aucune déclaration TVA générée"]);
  await expectVatApis("not_applicable");
  await pageContains("/controle", ["Pré-clôture bloquée", "2 transaction", "Charges annuelles", "Immobilisations"]);
  await resolveFirstIssue("ANNUAL_CHARGE_CCA", "Calcul CCA revu dans la validation MVP.");
  await pageContains("/controle/ANNUAL_CHARGE_CCA", ["Résolu", "Calcul CCA revu"]);
  await pageContains("/imports", ["qonto-export-2025.csv", "42"]);
  await pageContains("/transactions", ["42 transactions importées", "PAYOUT MARS 2025", "VIREMENT REF 789456123", "DEPOT COMPTES ANNUELS 2024"]);
  await pageContains("/transactions?status=review", ["2 affichées", "VIREMENT REF 789456123", "DEPOT COMPTES ANNUELS 2024"]);
  await expectTransactionsApiShape();
  await pageContains("/transactions?search=stripe", ["PAYOUT MARS 2025"]);
  await pageContainsAtLeast("/transactions", "Corriger", 2);
  const correctionLinks = await correctionDetailLinks();
  check(correctionLinks.length === 2, `/transactions doit exposer exactement 2 liens Corriger, obtenu ${correctionLinks.length}.`);
  await pageContains(correctionLinks[0], ["Correction transaction", "Transaction à vérifier", "Valider la catégorisation"]);
  await pageContains("/ecritures", ["40 écritures", "80 lignes"]);
  await expectJournalApi(40, 80, true);
  await expectJournalAudit("exportable");
  await expectJournalExport(["BQ"]);
  await expectDocumentGenerationBlocked();
  await correctReviewTransactions(correctionLinks);
  await pageContains("/transactions?status=review", ["Aucune transaction à corriger"]);
  await pageContains("/corrections", ["Règles existantes", "Active"]);
  await expectFirstCorrectionRuleImpact();
  await toggleFirstCorrectionRule("disable");
  await pageContains("/corrections?active=false", ["Inactive"]);
  await toggleFirstCorrectionRule("enable");
  await pageContains("/controle", ["Documents générables", "Charges annuelles", "point", "rapprochement"]);
  await pageContains("/ecritures", ["42 écritures", "84 lignes"]);
  await expectJournalApi(42, 84, true);
  await generateDocuments("/api/documents/fec/generate", ["FEC"]);
  await pageContains("/documents", ["912345678FEC20251231.txt", "À jour", "script:generate-fec", "Audit génération", "Dernière génération réussie", "Télécharger paquet de preuve"]);
  await expectDocumentsApiMetadata();
  await expectDocumentsAudit("succeeded");
  await approveFirstDraftProposal("CCA");
  await pageContains("/ecritures", ["43 écritures", "86 lignes", "Clôture", "CCA"]);
  await expectJournalExport(["BQ", "OD"]);
  await pageContains("/documents", ["912345678FEC20251231.txt", "À régénérer"]);

  const fec = await generateDocuments("/api/documents/fec/generate", ["FEC"]);
  await expectEvidenceBundle();
  const fecDownload = await request(`/api/documents/${fec[0].id}/download`);
  const fecBody = await fecDownload.text();
  check(fecDownload.status === 200, `Téléchargement FEC attendu 200, obtenu ${fecDownload.status}.`);
  check(fecDownload.headers.get("content-disposition")?.includes("attachment") === true, "Le téléchargement FEC doit être servi en attachment.");
  check(fecDownload.headers.get("content-disposition")?.includes(".txt") === true, "Le téléchargement FEC doit annoncer un fichier .txt.");
  check(fecBody.includes("JournalCode") || fecBody.includes("EcritureNum"), "Le téléchargement FEC ne ressemble pas à un FEC.");
  check(fecBody.includes("OD") && fecBody.includes("CCA"), "Le FEC doit contenir l'OD de pré-clôture validée.");

  await generateDocuments("/api/documents/statements/generate", ["BALANCE", "BILAN", "COMPTE_RESULTAT"]);
  const documents = await requestJson<{ documents: GeneratedDocument[] }>("/api/documents");
  const documentTypes = documents.documents.map((document) => document.type).sort();
  assertSameMembers(documentTypes, ["BALANCE", "BILAN", "COMPTE_RESULTAT", "FEC"]);
  await pageContains("/documents", ["912345678FEC20251231.txt", "balance.md", "bilan.md", "compte-de-resultat.md"]);
  await validateAnnualClosing();
  await pageContains("/chat", ["Chat comptable", "Chat en lecture seule", "IA ce mois"]);
  await pageContains("/abonnement", ["Abonnement", "Plan", "Appels IA", "Imports"]);
  await expectSubscriptionAndUsage();
  await pageContains("/notifications", ["Notifications"]);
  await pageContains("/exercices", ["Exercices disponibles"]);
  await expectPhase10Apis();
  await pageContains("/activity", ["Point de contrôle résolu", "Hypothèses OD modifiées", "OD recalculée", "OD validée", "Documents à régénérer", "Audit génération réussi", "Paquet de preuve téléchargé", "Document généré", "Document téléchargé", "Clôture démarrée", "Exercice clôturé", "Exercice rouvert"]);

  console.log(`Validation MVP OK sur ${baseUrl}`);
}

async function pageContains(path: string, fragments: string[]) {
  const response = await request(path);
  const body = await response.text();
  check(response.status === 200, `${path} attendu 200, obtenu ${response.status}.`);
  for (const fragment of fragments) {
    check(body.includes(fragment), `${path} ne contient pas "${fragment}".`);
  }
}

async function pageContainsAtLeast(path: string, fragment: string, expectedCount: number) {
  const response = await request(path);
  const body = await response.text();
  check(response.status === 200, `${path} attendu 200, obtenu ${response.status}.`);
  const count = body.split(fragment).length - 1;
  check(count >= expectedCount, `${path} contient ${count} occurrence(s) de "${fragment}", attendu au moins ${expectedCount}.`);
}

async function correctionDetailLinks() {
  const response = await request("/transactions");
  const body = await response.text();
  check(response.status === 200, `/transactions attendu 200, obtenu ${response.status}.`);
  return Array.from(body.matchAll(/href="(\/transactions\/[^"]+)">Corriger<\/a>/g)).map((match) => match[1]);
}

async function generateDocuments(path: string, expectedTypes: string[]) {
  const payload = await requestJson<{ documents: GeneratedDocument[] }>(path, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const types = payload.documents.map((document) => document.type).sort();
  assertSameMembers(types, expectedTypes.slice().sort());
  return payload.documents;
}

async function expectDocumentGenerationBlocked() {
  const response = await request("/api/documents/fec/generate", {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const body = await response.text();
  check(response.status === 409, `La génération FEC avant correction doit être bloquée en 409, obtenu ${response.status}: ${body.slice(0, 200)}`);
  check(body.includes("Génération bloquée"), "La génération bloquée doit retourner un message lisible.");
}

async function correctReviewTransactions(correctionLinks: string[]) {
  for (const [index, link] of correctionLinks.entries()) {
    const id = link.split("/").pop();
    check(Boolean(id), `Lien de correction invalide: ${link}`);
    const form = new URLSearchParams({
      accountDebit: "471",
      accountCredit: "5121",
      ecritureLabel: "Transaction corrigée",
    });
    if (index === 0) form.set("learn", "on");
    const response = await request(`/api/transactions/${id}/categorize`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const body = await response.text();
    check(response.ok, `Correction ${id} attendue OK, obtenu ${response.status}: ${body.slice(0, 200)}`);
  }
}

async function toggleFirstCorrectionRule(intent: "disable" | "enable") {
  const payload = await requestJson<{ rules: Array<{ id: string; active: boolean }> }>(`/api/correction-rules?active=${intent === "disable" ? "true" : "false"}`);
  const rule = payload.rules[0];
  check(Boolean(rule), `Aucune règle à ${intent === "disable" ? "désactiver" : "réactiver"}.`);
  const form = new URLSearchParams({ intent });
  const response = await request(`/api/correction-rules/${rule.id}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const body = await response.text();
  check(response.ok, `Toggle règle attendu OK, obtenu ${response.status}: ${body.slice(0, 200)}`);
}

async function expectTransactionsApiShape() {
  const payload = await requestJson<{ filterState: { status: string }; activeFilterLabels: Array<{ label: string }>; queueSummary: { total: number } }>("/api/transactions?status=review");
  check(payload.filterState.status === "review", "L'API transactions doit retourner le filtre normalisé.");
  check(payload.activeFilterLabels.some((filter) => filter.label === "À vérifier"), "L'API transactions doit retourner les libellés de filtres actifs.");
  check(payload.queueSummary.total === 2, `La file de revue API doit compter 2 transactions, obtenu ${payload.queueSummary.total}.`);
}

async function expectJournalApi(entriesCount: number, linesCount: number, balanced: boolean) {
  const payload = await requestJson<{ summary: { entriesCount: number; linesCount: number; balanced: boolean }; facets: { journals: string[] } }>("/api/journal-entries?pageSize=50");
  check(payload.summary.entriesCount === entriesCount, `Journal attendu ${entriesCount} écritures, obtenu ${payload.summary.entriesCount}.`);
  check(payload.summary.linesCount === linesCount, `Journal attendu ${linesCount} lignes, obtenu ${payload.summary.linesCount}.`);
  check(payload.summary.balanced === balanced, `Journal équilibré attendu ${balanced}, obtenu ${payload.summary.balanced}.`);
  check(payload.facets.journals.includes("BQ"), "Les facettes journal doivent inclure BQ.");
}

async function expectJournalAudit(expectedStatus: string) {
  const payload = await requestJson<{ audit: { status: string; label: string; issues: unknown[]; summary: { balanced: boolean } } }>("/api/journal-entries/audit");
  check(payload.audit.status === expectedStatus, `Audit journal attendu ${expectedStatus}, obtenu ${payload.audit.status}.`);
  check(payload.audit.summary.balanced, "Audit journal doit confirmer debit = credit.");
  check(payload.audit.label === "Journal équilibré", `Libellé audit journal inattendu: ${payload.audit.label}.`);
  check(payload.audit.issues.length === 0, `Audit journal ne doit pas exposer d'anomalies, obtenu ${payload.audit.issues.length}.`);
}

async function expectJournalExport(expectedJournals: string[]) {
  const response = await request("/api/journal-entries/export?format=csv");
  const body = await response.text();
  check(response.ok, `Export journal attendu OK, obtenu ${response.status}.`);
  check(body.includes("\"num\",\"date\",\"journal\",\"source\",\"label\",\"account\",\"accountLabel\",\"debit\",\"credit\""), "Export journal CSV avec colonnes stables attendu.");
  for (const journal of expectedJournals) check(body.includes(`"${journal}"`), `Export journal doit contenir ${journal}.`);
}

async function expectDocumentsApiMetadata() {
  const payload = await requestJson<{ documents: Array<{ filename: string; generatedBy: string; scriptVersion: string | null; freshness: { statusLabel: string } | null }> }>("/api/documents");
  const fec = payload.documents.find((document) => document.filename === "912345678FEC20251231.txt");
  check(Boolean(fec), "Le FEC doit être listé dans l'API documents.");
  check(fec!.generatedBy === "script:generate-fec", `generatedBy FEC inattendu: ${fec!.generatedBy}.`);
  check(typeof fec!.scriptVersion === "string", "scriptVersion doit être présent dans l'API documents.");
  check(fec!.freshness?.statusLabel === "À jour", `freshness FEC attendue À jour, obtenue ${fec!.freshness?.statusLabel}.`);
}

async function expectDocumentsAudit(expectedStatus: string) {
  const payload = await requestJson<{ latestGeneration: { status: string; filenames: string[]; scriptVersion: string | null; entriesCount: number | null } | null }>("/api/documents/audit");
  check(Boolean(payload.latestGeneration), "L'audit documents doit exposer la dernière génération.");
  check(payload.latestGeneration!.status === expectedStatus, `Audit documents attendu ${expectedStatus}, obtenu ${payload.latestGeneration!.status}.`);
  check(payload.latestGeneration!.filenames.includes("912345678FEC20251231.txt"), "Audit documents doit citer le FEC généré.");
  check(typeof payload.latestGeneration!.scriptVersion === "string", "Audit documents doit contenir scriptVersion.");
  check(typeof payload.latestGeneration!.entriesCount === "number", "Audit documents doit contenir entriesCount.");
}

async function expectSubscriptionAndUsage() {
  const subscription = await requestJson<{ tier: string; status: string; provider: string; limits: { aiCallsPerMonth: number; importsPerMonth: number } }>("/api/subscription");
  check(subscription.tier === "SOLO", `Plan attendu SOLO, obtenu ${subscription.tier}.`);
  check(subscription.status === "ACTIVE_STUB", `Abonnement attendu ACTIVE_STUB, obtenu ${subscription.status}.`);
  check(subscription.provider === "NONE", `Provider abonnement attendu NONE, obtenu ${subscription.provider}.`);
  check(subscription.limits.aiCallsPerMonth === 100, "Le plan Solo doit exposer 100 appels IA/mois.");

  const usage = await requestJson<{ usage: { aiCalls: number; chatMessages?: number; aiCategorizations?: number; imports: number }; remaining: { aiCalls: number; imports: number } }>("/api/usage");
  check((usage.usage.chatMessages ?? 0) === 0, `Usage chat attendu 0 après reset, obtenu ${usage.usage.chatMessages}.`);
  check((usage.usage.aiCategorizations ?? 0) >= 0, "Usage catégorisation IA attendu dans le quota IA.");
  check(usage.remaining.imports === subscription.limits.importsPerMonth, "Le reset démo ne doit pas consommer le quota import.");
}

async function expectPhase10Apis() {
  const notifications = await requestJson<{ notifications: unknown[]; summary: { total: number } }>("/api/notifications");
  check(Array.isArray(notifications.notifications), "L'API notifications doit retourner une liste.");
  check(typeof notifications.summary.total === "number", "L'API notifications doit retourner un résumé.");

  const fiscalYears = await requestJson<{ fiscalYears: Array<{ active: boolean; counters: { transactions: number } }> }>("/api/fiscal-years");
  check(fiscalYears.fiscalYears.some((fiscalYear) => fiscalYear.active), "Un exercice doit être actif.");
  check(fiscalYears.fiscalYears.some((fiscalYear) => fiscalYear.counters.transactions >= 42), "L'exercice de démo doit conserver ses transactions.");

  const activityAudit = await requestJson<{ coverage: { activityCount: number; actionCount: number } }>("/api/activity-log/audit");
  check(activityAudit.coverage.activityCount > 0, "L'audit activity doit compter des événements.");
  check(activityAudit.coverage.actionCount > 0, "L'audit activity doit compter des actions.");

  const exportResponse = await request("/api/exports/all");
  const exportBody = await exportResponse.text();
  check(exportResponse.ok, `Export RGPD attendu OK, obtenu ${exportResponse.status}.`);
  check(exportBody.includes("qitus-user-export-v1"), "Export RGPD doit contenir la version d'export.");
}

async function expectVatApis(expectedStatus: string) {
  const position = await requestJson<{ position: { regime: string; totals: { net: number } } }>("/api/vat/position");
  check(position.position.regime === "FRANCHISE", `Régime TVA attendu FRANCHISE, obtenu ${position.position.regime}.`);
  check(typeof position.position.totals.net === "number", "Position TVA doit retourner un net numérique.");

  const review = await requestJson<{ review: { status: string; controls: unknown[] } }>("/api/vat/review");
  check(review.review.status === expectedStatus, `Revue TVA attendue ${expectedStatus}, obtenue ${review.review.status}.`);
  check(Array.isArray(review.review.controls), "Revue TVA doit retourner une liste de contrôles.");
}

async function expectEvidenceBundle() {
  const response = await request("/api/documents/evidence-bundle");
  const body = await response.text();
  check(response.status === 200, `Paquet de preuve attendu 200, obtenu ${response.status}: ${body.slice(0, 200)}`);
  check(response.headers.get("content-disposition")?.includes("qitus-evidence-2025.json") === true, "Le paquet de preuve doit annoncer un manifest JSON 2025.");
  const manifest = JSON.parse(body) as { documents: Array<{ filename: string }>; journal: { auditStatus: string; csv: string } };
  check(manifest.journal.auditStatus === "exportable", `Audit manifest attendu exportable, obtenu ${manifest.journal.auditStatus}.`);
  check(manifest.journal.csv.includes("\"journal\""), "Le manifest doit inclure l'export CSV du journal.");
  check(manifest.documents.some((document) => document.filename === "912345678FEC20251231.txt"), "Le manifest doit référencer le FEC.");
}

async function validateAnnualClosing() {
  await requestJson<{ overview: unknown }>("/api/cloture/start", { method: "POST" });
  await pageContains("/cloture", ["Workflow annuel", "Vérification balance", "Export et archivage"]);
  const fixedAsset = new URLSearchParams({
    label: "MacBook Pro 14 pouces M3",
    account: "2183",
    acquisitionDate: "2025-02-10",
    amount: "1899.00",
    usefulLifeYears: "3",
    depreciationAccount: "28183",
    expenseAccount: "68112",
  });
  await requestJson<{ asset: unknown }>("/api/fixed-assets", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: fixedAsset,
  });
  await pageContains("/immobilisations", ["MacBook Pro", "563"]);
  await requestJson<{ reconciliation: unknown }>("/api/reconciliations/bank/run", { method: "POST" });
  const reconciliation = await requestJson<{ reconciliation: { ledgerBalance: number; status: string } }>("/api/bank-reconciliation");
  const bankForm = new URLSearchParams({
    statementBalance: String(reconciliation.reconciliation.ledgerBalance),
    statementDate: "2025-12-31",
  });
  await requestJson<{ step: { status: string } }>("/api/cloture/steps/BANK_RECONCILIATION/run", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bankForm,
  });
  for (const step of [
    "BALANCE_CHECK",
    "THIRD_PARTY_MATCHING",
    "PREPAID_ACCRUALS",
    "DEPRECIATION",
    "PROVISIONS",
    "VAT_REVIEW",
    "TAX_CALCULATION",
    "CLOSING_ADJUSTMENTS",
    "FINANCIAL_STATEMENTS",
    "TAX_PACKAGE",
    "EXPORT_ARCHIVE",
  ]) {
    await requestJson<{ step: { status: string } }>(`/api/cloture/steps/${step}/run`, { method: "POST" });
  }
  await pageContains("/cloture/archive", ["Archive prête", "qitus-evidence-2025.json"]);
  const overview = await requestJson<{ canClose: boolean; steps: Array<{ status: string }> }>("/api/cloture");
  check(overview.canClose, "La clôture doit être possible après exécution des 12 étapes.");
  await requestJson<{ overview: { fiscalYearStatus: string } }>("/api/cloture/close", { method: "POST" });
  await pageContains("/cloture", ["Exercice clôturé", "CLOSED"]);
  const closedImport = await request("/api/imports", { method: "POST", headers: { Accept: "application/json" }, body: new FormData() });
  check(closedImport.status === 400 || closedImport.status === 409, `Import sur exercice clôturé doit être refusé, obtenu ${closedImport.status}.`);
  await requestJson<{ overview: { fiscalYearStatus: string } }>("/api/cloture/reopen", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ reason: "Validation MVP de la réouverture." }),
  });
  await pageContains("/cloture", ["Clôture en cours", "CLOSING"]);
}

async function expectFirstCorrectionRuleImpact() {
  const payload = await requestJson<{ rules: Array<{ id: string }> }>("/api/correction-rules?active=true");
  const rule = payload.rules[0];
  check(Boolean(rule), "Aucune règle active trouvée pour vérifier l'impact.");
  await pageContains(`/corrections/${rule.id}`, ["Transactions exemples", "Impact"]);
  const impact = await requestJson<{ impact: { count: number; transactions: unknown[] } }>(`/api/correction-rules/${rule.id}/impact`);
  check(impact.impact.count >= 1, `Impact règle attendu >= 1, obtenu ${impact.impact.count}.`);
}

async function expectOperationalConsistency(expected: "consistent" | "needs_attention") {
  const payload = await requestJson<{ consistency: { status: string } }>("/api/dashboard/consistency");
  check(payload.consistency.status === expected, `Cohérence dashboard attendue ${expected}, obtenue ${payload.consistency.status}.`);
}

async function resolveFirstIssue(controlCode: string, note: string) {
  const payload = await requestJson<{ review: { controls: Array<{ code: string; evidence: Array<{ issueKey?: string }> }> } }>("/api/accounting-review");
  const issueKey = payload.review.controls.find((control) => control.code === controlCode)?.evidence.find((item) => item.issueKey)?.issueKey;
  check(Boolean(issueKey), `Aucune issue trouvée pour ${controlCode}.`);
  const form = new URLSearchParams({ status: "RESOLVED", note });
  const response = await request(`/api/accounting-review/issues/${encodeURIComponent(issueKey!)}/status`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const body = await response.text();
  check(response.ok, `Résolution issue ${issueKey} attendue OK, obtenu ${response.status}: ${body.slice(0, 200)}`);
}

async function approveFirstDraftProposal(kind: string) {
  const payload = await requestJson<{ proposals: Array<{ proposalKey: string; kind: string; status: string }> }>("/api/closing-adjustments");
  const proposal = payload.proposals.find((candidate) => candidate.kind === kind && candidate.status === "DRAFT");
  check(Boolean(proposal), `Aucune proposition ${kind} à valider.`);
  await uploadDecisionEvidence(proposal!.proposalKey, `decision-${kind.toLowerCase()}.txt`);
  const assumptions = new URLSearchParams({ nextExerciseAmount: "55.25", period: "2026-01-01/2026-02-10", chargeAccount: "6161", prepaidExpenseAccount: "486" });
  const assumptionResponse = await request(`/api/closing-adjustments/${encodeURIComponent(proposal!.proposalKey)}/assumptions`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: assumptions,
  });
  const assumptionBody = await assumptionResponse.text();
  check(assumptionResponse.ok, `Sauvegarde hypothèses OD attendue OK, obtenu ${assumptionResponse.status}: ${assumptionBody.slice(0, 200)}`);
  const recalculateResponse = await request(`/api/closing-adjustments/${encodeURIComponent(proposal!.proposalKey)}/recalculate`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const recalculateBody = await recalculateResponse.text();
  check(recalculateResponse.ok, `Recalcul OD attendu OK, obtenu ${recalculateResponse.status}: ${recalculateBody.slice(0, 200)}`);
  const response = await request(`/api/closing-adjustments/${encodeURIComponent(proposal!.proposalKey)}/approve`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const body = await response.text();
  check(response.ok, `Validation OD ${proposal!.proposalKey} attendue OK, obtenu ${response.status}: ${body.slice(0, 200)}`);
}

async function uploadDecisionEvidence(proposalKey: string, filename: string) {
  const form = new FormData();
  form.set("file", new File([`Décision utilisateur pour ${proposalKey}`], filename, { type: "text/plain" }));
  form.set("entityType", "CLOSING_ADJUSTMENT");
  form.set("entityId", proposalKey);
  form.set("relationType", "USER_DECISION");
  form.set("note", "Validation MVP : décision utilisateur.");
  const response = await request("/api/attachments", { method: "POST", headers: { Accept: "application/json" }, body: form });
  const body = await response.text();
  check(response.ok, `/api/attachments attendu OK, obtenu ${response.status}: ${body.slice(0, 200)}`);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
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

function assertSameMembers(actual: string[], expected: string[]) {
  check(
    actual.length === expected.length && actual.every((value, index) => value === expected[index]),
    `Types attendus ${expected.join(", ")}, obtenus ${actual.join(", ")}.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
