# ADR 0007 — Reconciliations Are Line-Based And Connectors Are Adapters

## Status

Accepted.

## Context

Qitus already had declarative reconciliation warnings and a bank statement balance check. Phase 13 needs expert-comptable coverage that proves which lines were matched, which lines remain open, and how Qonto/Stripe data entered the system.

## Decision

- Reconciliations are persisted as `ReconciliationRun`, `ReconciliationMatch` and `ReconciliationIssue`.
- Bank, Stripe, third-party and suspense reviews each own a deep Module with a small Interface.
- Qonto and Stripe live sync are Adapters behind `ConnectorSyncCenter`.
- `CONNECTORS_MODE=disabled` remains the default; fixtures remain the local validation path.
- Provider secrets stay in environment variables and are never stored in the database.
- Differences and suspense items can produce proposals later, but Phase 13 never creates accounting entries automatically.

## Consequences

- `/controle`, `/cloture`, `/couverture`, notifications and the evidence bundle consume reconciliation Modules instead of duplicating matching rules.
- A reconciliation can be ignored with a note, but the audit trail remains visible.
- Phase 14 can reuse ReconciliationIssues to propose validated OD for durable differences.
