import { existsSync, readFileSync } from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error(`validate:privacy-export failed: ${message}`);
    process.exit(1);
  }
}

const route = "app/routes/api.privacy.export.ts";
const center = "app/modules/privacy/data-export-center.server.ts";
assert(existsSync(route), "GET /api/privacy/export route is missing");

const routeText = readFileSync(route, "utf8");
const centerText = readFileSync(center, "utf8");

assert(routeText.includes("requestDataExport"), "privacy export must create a PrivacyRequest");
assert(routeText.includes("privacy.exported"), "privacy export must record ActivityLog");
for (const expected of ["fiscalYears", "transactions", "journalEntries", "documents", "attachments", "attachmentLinks", "activity", "privacyRequests"]) {
  assert(centerText.includes(expected), `DataExportCenter must include ${expected}`);
}

console.log("validate:privacy-export ok");
