# ADR 0013 — Accounting rules come from official sources and apply to future imports

## Status

Accepted.

## Decision

Qitus watches official regulatory sources and turns trustworthy changes into versioned `AccountingRulePack` records.

- BOFiP RSS, ANC/PCG publications and impots.gouv documentation are the v1 official source inputs.
- `RegulatorySourceAdapter` Adapters retrieve source snapshots and checksums; they do not create mappings or entries.
- `AccountingRulePackCenter` owns executable Qitus rule packs and the active pack lifecycle.
- Structured, deterministic changes can activate a new pack automatically.
- Ambiguous BOFiP or impots.gouv text changes become `NEEDS_REVIEW` packs for internal Qitus review, not end-user decisions.
- Future imports use the active rule pack.
- Existing transactions, categorizations, JournalEntries and generated documents are never rewritten automatically.
- `RuleImpactPreviewCenter`, `RuleApplicationWorkflow` and `ChangeImpactCenter` surface any effect on existing data as a review/retry signal.

## Consequences

- Routes remain thin Adapters.
- Official source monitoring is traceable through snapshots and checksums.
- Users benefit from updated rules without approving rule packs.
- Accounting auditability is preserved because past generated entries are stable unless the user explicitly retries categorization or reconstruction.
- User `CorrectionRule` records stay higher priority than global Qitus mappings.

## Non-goals

- Legal certification of all regulatory interpretations.
- Automatic rewriting of existing entries.
- Asking end users to validate BOFiP or PCG changes.
- Replacing expert-comptable review for ambiguous fiscal changes.
