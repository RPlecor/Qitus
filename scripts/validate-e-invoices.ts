const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";

async function main() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ID>VALIDATE-EINV-001</cbc:ID>
  <cbc:IssueDate>2025-04-01</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>OVH SAS</cbc:RegistrationName><cbc:CompanyID>424761419</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">20.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">120.00</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">120.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>`;
  const form = new FormData();
  form.set("returnTo", "/pieces");
  form.set("file", new Blob([xml], { type: "application/xml" }), "validate-einvoice.xml");
  const upload = await requestJson<{ attachment: { id: string } }>("/api/attachments", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: form,
  });
  check(Boolean(upload.attachment.id), "Upload facture électronique attendu.");

  const invoices = await requestJson<{ invoices: Array<{ id: string; invoiceNumber: string | null; status: string }> }>("/api/e-invoices");
  const invoice = invoices.invoices.find((item) => item.invoiceNumber === "VALIDATE-EINV-001");
  if (!invoice) throw new Error("Facture électronique parsée attendue.");
  check(invoice.status === "PARSED" || invoice.status === "ACCOUNTING_DRAFT" || invoice.status === "ACCOUNTED", `Statut facture inattendu ${invoice.status}.`);

  const draft = await requestJson<{ draft: { id: string; status: string; proposedJournalEntry: { lines: unknown[] } } }>(`/api/e-invoices/${invoice.id}/accounting-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  check(draft.draft.status === "READY", `Brouillon attendu READY, obtenu ${draft.draft.status}.`);
  check(draft.draft.proposedJournalEntry.lines.length >= 2, "Brouillon attendu avec lignes comptables.");

  const approved = await requestJson<{ draft: { status: string; journalEntryId: string | null } }>(`/api/e-invoices/${invoice.id}/approve-accounting`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ draftId: draft.draft.id }),
  });
  check(approved.draft.status === "APPROVED", "Brouillon attendu approuvé.");
  check(Boolean(approved.draft.journalEntryId), "Écriture E_INVOICE attendue.");
  console.log(`Validation factures électroniques OK sur ${baseUrl}`);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(path, baseUrl), { ...init, headers: { Accept: "application/json", ...init?.headers } });
  const body = await response.text();
  check(response.ok, `${path} attendu OK, obtenu ${response.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body) as T;
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

export {};
