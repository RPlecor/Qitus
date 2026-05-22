# ADR 0009 — Expert dossier is collaborative but accounting mutations stay owner-controlled

## Status

Accepted

## Context

Phase 15 turns Paperasse's local accounting proof material into a complete expert-comptable dossier. The expert needs to review, request changes, comment and sign off, but Paperasse must not let an external shared link mutate accounting data.

## Decision

The expert-comptable dossier is built from deep Modules already responsible for accounting truth: journal audit, FEC precheck, tax package completion, evidence, VAT, reconciliations, closing workpapers, OD and activity log.

External access remains tokenized through `ShareLink`. The expert can create `ExpertReviewItem`, add `ExpertReviewComment`, request changes and perform `ExpertSignoff`. The expert cannot import data, correct transactions, approve OD, generate documents, close/reopen a FiscalYear or modify accounting records.

`DossierSnapshot` persists the transmitted manifest. Any later accounting, document, evidence, VAT, reconciliation, workpaper or closing change can make that snapshot stale. The final export is a structured local proof package, not a teletransmission and not a certified electronic signature.

## Consequences

- Routes stay thin and call `ExpertDossierCenter`, `ExpertReviewWorkflow` or `ExpertDossierExportCenter`.
- Accounting mutation authority remains with the authenticated Paperasse user.
- The expert workflow is auditable without becoming a full multi-client cabinet portal.
- The final dossier can be regenerated locally after changes instead of patched in place.
