# ADR 0011 — Beta readiness is a product surface, not only DevOps

## Status

Accepted.

## Context

Phase 16 added production-shaped runtime config, healthchecks, storage Adapters and Open Banking provider Seams. Before post-beta extensions, the team needs one readable place to know whether Paperasse can be exercised safely outside the pure local demo.

## Decision

Paperasse exposes beta readiness as a product-facing Module, `BetaReadinessCenter`, and surfaces it in `/connecteurs` and `GET /api/beta-readiness`.

Readiness aggregates:

- runtime config and dependency health;
- storage configuration and storage audit;
- worker/cron mode;
- Open Banking provider configuration, freshness and webhook processing;
- secret redaction checks;
- validation scripts and metric catalog.

Open Banking remains provider-shaped but mock-first in Phase 16.5. Live provider-specific behavior is not implemented here. Webhooks are idempotent through `WebhookEvent`.

## Consequences

- Routes stay thin Adapters; beta checks live in Modules.
- Operators and product users can see the same readiness language.
- Missing storage artifacts and provider errors are reported as readable diagnostics, not `Application Error`.
- Phase 17 can add product extensions without reopening infrastructure Seams.

## Non-goals

- Choosing a live Open Banking provider.
- EBICS, payment initiation or fiscal teletransmission.
- External monitoring as a requirement.
- Object storage as a requirement for local validation.
