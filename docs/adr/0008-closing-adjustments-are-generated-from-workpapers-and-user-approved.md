# ADR 0008 — Closing adjustments are generated from workpapers and user approved

Status: Accepted

## Context

Phase 14 extends closing beyond the MVP cases: FNP, FAE, PCA/CCA, stock variation, provisions, loans, payroll, VAT settlement, corporate tax and reconciliation differences.

These areas require user assumptions and accounting judgement. They must be auditable, recalculable and attachable to evidence before they affect the ledger.

## Decision

Qitus separates the closing flow into three layers:

- `ClosingWorkpaper`: user assumptions, note, optional source entity and evidence expectation.
- `ClosingAdjustmentProposal`: deterministic calculation and draft debit/credit lines.
- `JournalEntry`: real `OD` entry created only when the user approves the proposal.

No workpaper, VAT balance, reconciliation issue or IA output may create an accounting entry directly.

Rejected proposals are accepted when they carry a note. Rejection is an auditable accounting decision, not a silent deletion.

## Consequences

- Routes remain thin Adapters and call `ClosingWorkpaperCenter` or `ClosingAdjustmentCenter`.
- Domain calculators return drafts compatible with `ClosingAdjustmentCenter`.
- Evidence requirements affect coverage, notifications and the evidence bundle.
- Any approved OD marks generated documents stale.
- Reconciliation and VAT modules can propose adjustments, but approval remains explicit.

This keeps Phase 14 deterministic, auditable and compatible with the future expert-comptable dossier.
