# ADR 0014 — E-invoices are incoming structured evidence, not an invoicing product

## Status

Accepted.

## Context

Qitus needs to prepare for French electronic invoicing without becoming a full invoicing, payment, or certified transmission product.

## Decision

- Qitus handles incoming supplier e-invoices first.
- Manual upload supports structured Factur-X, UBL and CII parsing.
- Automated reception is behind a PA-neutral `EInvoiceProviderAdapter`.
- Parsed invoices produce `EInvoiceAccountingDraft` records.
- Only explicit user approval creates a `JournalEntry` with source `E_INVOICE`.
- Existing entries are never rewritten silently.
- Source XML and the original attachment are preserved as evidence.

## Consequences

- Local upload is useful for beta workflows but is not full legal PA reception compliance.
- A concrete Plateforme Agréée can be added later as an Adapter without changing accounting flows.
- Qitus does not issue invoices, number outgoing invoices, initiate payments, or perform e-reporting in this phase.
