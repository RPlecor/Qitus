# ADR 0012 — Open Banking provider tokens live in a vault, not Prisma

## Status

Accepted.

## Decision

Bridge and Powens are implemented as concrete `OpenBankingProviderAdapter` Adapters behind the existing Open Banking Seam.

- Qitus stores provider connection ids, consent status and masked account metadata in Prisma.
- Provider user tokens are stored in `ProviderCredentialVault`, encrypted outside Prisma.
- Bridge and Powens use provider-hosted consent/Webview flows.
- Bank feeds continue through `BankFeedNormalizer` and `ImportOrchestrator`; no parallel import pipeline is created.
- Webhooks are idempotent through `WebhookEvent` and update provider connection state only.

## Consequences

- Routes remain thin Adapters.
- Business Modules never receive raw provider tokens.
- Bridge/Powens can be enabled by env without changing accounting Modules.
- Local validation can use fake HTTP providers while keeping the same Module Interface.

## Non-goals

- Native EBICS.
- Payment initiation.
- Fiscal teletransmission.
- Storing documents or attachments from banking providers.
