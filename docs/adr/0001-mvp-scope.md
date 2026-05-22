# ADR 0001: MVP Scope And Architectural Seams

Date: 2026-05-19

## Status

Accepted

## Decision

The MVP is CSV-only, authenticated, and billing-free. IA is used only for residual transaction categorization after deterministic mappings fail. Paperasse document generation is integrated through CLI scripts, not by rewriting the scripts.

## Consequences

- The first product loop is onboarding -> CSV import -> categorization -> correction -> journal entries -> FEC/statements.
- Live Qonto/Stripe connectors, chat, full closing, billing, Factur-X, audit/CAC and multi-company are explicitly outside the MVP.
- `PaperasseRuntime` is the primary external seam because the repo is CLI-first and filesystem-oriented.
- Deterministic logic must be exhausted before any OpenAI call.
