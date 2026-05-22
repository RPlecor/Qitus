# ADR 0002: Closing Adjustments Are User-Validated Drafts

Date: 2026-05-19

## Status

Accepted

## Decision

Closing adjustment proposals are deterministic drafts. Paperasse SaaS may calculate CCA, depreciation, and indicative corporate tax proposals, but it never creates an OD journal entry until the user explicitly approves the proposal.

Each draft stores editable assumptions, calculation output, draft journal lines, and an audit trail of assumption changes, recalculations, approvals, and rejections.

## Consequences

- Validated OD entries are immutable from the proposal screen.
- Recalculation is explicit after assumption changes.
- Documents are considered stale when they were generated before a newer import, correction, journal entry, or validated OD.
- Regeneration remains a user action; stale state is a product signal, not a destructive replacement.
