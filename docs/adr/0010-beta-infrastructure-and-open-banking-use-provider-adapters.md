# ADR 0010 — Beta Infrastructure And Open Banking Use Provider Adapters

## Status

Accepted.

## Decision

Qitus beta is production-shaped without becoming a regulated banking connector itself.

- Open Banking uses a provider Adapter (`bridge`, `powens`, `gocardless`, `tink`, `yapily`) behind `OpenBankingProviderAdapter`.
- Local validation uses `OPEN_BANKING_PROVIDER=mock`.
- Bank feeds are normalized by `BankFeedNormalizer` and ingested through the existing import pipeline.
- Native EBICS, payment initiation and fiscal teletransmission are out of scope.
- Documents and evidence keep local storage by default; S3-compatible storage is enabled only by env.
- Observability is local by default, with Sentry/OTEL as optional adapters.

## Consequences

- Qitus stores provider connection ids, consent status and masked account metadata, never raw bank credentials.
- Provider sync errors are user-readable and audit-safe.
- CSV imports and Open Banking imports share deduplication and reconciliation freshness.
- Production runtime config is stricter than local dev config.
