# ADR 0015 — Qitus connects to an accredited platform but does not become one

## Status

Accepted.

## Context

French electronic invoicing requires reception through a Plateforme Agréée for legally compliant automated reception. Qitus needs to exploit incoming supplier invoices for accounting without taking on the regulatory burden of becoming an accredited platform.

## Decision

- Qitus remains an accounting exploitation product, not a Plateforme Agréée.
- Legally compliant automated reception is represented by `EInvoiceProviderAdapter` and a concrete PA Adapter when a provider contract/API is available.
- The first implementation is `GenericAccreditedPlatformAdapter`, a live-shaped contract that fails safely until a real PA Adapter is selected.
- Provider secrets stay in `ProviderCredentialVault`, never in Prisma, logs or ActivityLog.
- Qitus stores PA-safe identifiers, mandate status, provider invoice status, source XML and provider proof metadata.
- Webhooks are verified, idempotent and auditable through `WebhookEvent`.
- Receiving a PA invoice never creates accounting entries automatically; only user approval of an `EInvoiceAccountingDraft` creates `JournalEntry.source = E_INVOICE`.
- Mock, sandbox and generic PA Adapters must never report `receptionCompliant=true`.
- A real PA Adapter must pass `EInvoiceProviderContractTestKit` before being advertised as compliant.

## Consequences

- Uploading Factur-X/UBL/CII remains useful, but it is not marked as PA-compliant reception.
- The expert dossier can distinguish manual structured evidence from PA-received invoices.
- Adding Qonto, jefacture, Pennylane, Sage or another PA means adding an Adapter behind the existing Seam, not changing accounting flows.
- `AccreditedPlatformSandboxAdapter` can exercise provider-like edge cases, but its invoices remain non-compliant sandbox evidence.
- Emission, e-reporting, payment reporting and certified PA status remain out of scope.
