# Contrat d'Adapter Plateforme Agréée

Tout Adapter PA concret doit satisfaire `EInvoiceProviderAdapter` et passer `EInvoiceProviderContractTestKit`.

## Capacités minimales

- `getStatus` : retourne un statut secret-safe et indique si la réception est conforme.
- `createConnection` : crée ou rattache le mandat entreprise.
- `completeCallback` : termine le parcours provider si la PA utilise une redirection.
- `listIncomingInvoices` : liste les factures fournisseurs disponibles.
- `downloadInvoicePayload` : récupère le XML source et, si disponible, le visuel associé.
- `verifyWebhook` et `parseWebhook` : vérifient les signatures et normalisent les événements.
- `acknowledgeInvoiceStatus` : remonte un statut métier si la PA le demande.
- `disconnect` : révoque ou marque la connexion comme révoquée.

## Invariants

- Aucun secret provider en Prisma, logs, ActivityLog ou API.
- Aucun webhook ne crée d'écriture comptable.
- La synchronisation crée ou met à jour des `EInvoice`, jamais des `JournalEntry`.
- Les doublons sont absorbés par `sourceId` et checksum.
- `receptionCompliant=true` est interdit pour mock, sandbox et generic_pa.
- `QontoAccreditedPlatformAdapter` est un Adapter concret guarded : il peut diagnostiquer la cible Qonto PA, mais doit échouer au contract test tant que les endpoints partenaires ne sont pas implémentés.

## Contract test

Les endpoints suivants exposent le contrat :

- `GET /api/e-invoice-providers/contract-test`
- `POST /api/e-invoice-providers/contract-test/run`

Le script `npm run validate:e-invoice-provider-contract` doit passer avant d'activer une PA réelle.
