# ADR 0003: Annual Closing Is Stepwise And Auditable

Date: 2026-05-19

## Status

Accepted

## Decision

Annual closing is a guided 12-step workflow stored per FiscalYear. Each step records status, blockers, warnings, evidence and completion state. The workflow is deterministic by default and reuses the existing deep Modules for journal audit, closing adjustments, document generation and evidence bundles.

The application may help explain or qualify provisions, but it does not create accounting entries from IA output. Any closing entry must still come from an explicit user-validated proposal.

Closing a FiscalYear requires all steps to be done or explicitly skipped, an exportable journal, fresh final documents, a FEC, and a local evidence bundle. Closing sets `FiscalYear.status = CLOSED`; reopening requires a reason and sets the exercise back to `CLOSING`.

## Consequences

- Routes stay thin and call `AnnualClosingCenter`, `FixedAssetRegister`, `BankReconciliationCenter`, or `TaxPackageDraftCenter`.
- Closed exercises reject imports, transaction corrections, OD changes, fixed asset changes and document regeneration until reopened.
- The local evidence bundle is the final Phase 8 proof artifact; it is not an electronic signature or certified fiscal filing.
- The liasse fiscale is a local Markdown draft, not EDI teletransmission.
