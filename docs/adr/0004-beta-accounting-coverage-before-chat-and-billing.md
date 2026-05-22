# ADR 0004: Beta Accounting Coverage Before Chat And Billing

Date: 2026-05-19

## Status

Accepted

## Decision

Before implementing chat and billing, Qitus SaaS must cover the three accounting gaps identified by the MVP coverage audit: TVA-aware JournalEntries, a structured fiscal package draft, and external expert-comptable review.

TVA handling is deterministic. `VatLedgerPolicy` owns the decision and the JournalLines. For real VAT regimes, it creates HT/TVA/TTC lines using `44566` for deductible TVA and `44571` for collected TVA. Franchise companies keep the two-line journal behavior.

The fiscal package is source-first. `TaxPackageTemplateRenderer` produces the structured HTML/Markdown source with case labels, amounts, and calculation references. That source is the business truth. renderer PDF documentaire may derive a PDF via Qitus CLI and Puppeteer, but PDF failure does not block the beta coverage if the structured source exists.

Qitus scripts stay CLI-only for this phase. The SaaS prepares a workdir and calls scripts via `execFile`; no upstream refactor to importable generators is required before beta.

External review is delivered with `ExpertReviewShareCenter` and `ShareLink`, not a full multi-role accountant portal. A tokenized read-only link exposes the dossier, and an expert validation records reviewer name, note and timestamp in `ActivityLog`.

## Consequences

- Routes stay thin and call deep Modules.
- TVA logic is testable without importing Remix routes or Qitus scripts.
- The liasse fiscal package remains useful even when Puppeteer/Chromium is unavailable.
- Evidence bundles include the structured liasse, TVA summary and any expert validation.
- A full accountant portal, EDI teletransmission, CA3/CA12 filing and object storage remain later phases.
