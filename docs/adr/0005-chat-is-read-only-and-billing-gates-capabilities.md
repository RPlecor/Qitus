# ADR 0005 — Chat Read-Only Et Billing Comme Gate De Capacités

## Statut

Accepté.

## Contexte

Paperasse arrive à une beta locale comptablement large : imports, écritures, OD, liasse, preuve, clôture et revue expert-comptable. La Phase 9 ajoute un assistant conversationnel et une logique d'abonnement.

Le risque principal est de laisser le chat devenir une nouvelle surface de mutation comptable difficile à auditer. Le second risque est de disperser les règles d'abonnement dans les routes.

## Décision

- Le chat comptable est strictement lecture seule en Phase 9.
- Il reçoit un `ChatContext` construit par les Modules comptables existants.
- Il peut expliquer, synthétiser et pointer vers `/transactions`, `/controle`, `/ecritures`, `/documents`, `/cloture` ou `/abonnement`.
- Il ne crée aucune transaction, écriture, OD, document, clôture ou règle.
- Le provider par défaut est `codex-cli`, connecté au compte ChatGPT/Codex local, sans `OPENAI_API_KEY`.
- `FakeChatAdapter` est l'Adapter de tests.
- Les quotas et abonnements passent par `SubscriptionCenter`, `UsageMeter` et `EntitlementGate`.
- `BILLING_MODE=stub` reste le défaut local.
- `BILLING_MODE=stripe` active Stripe test-mode via Checkout, Portal et webhook signé.

## Conséquences

- Les routes Remix restent des Adapters fins.
- Les mutations comptables restent dans leurs Modules dédiés et leurs audits existants.
- Le chat est utile pour comprendre un dossier, pas pour le modifier.
- Les quotas peuvent être appliqués à chat et import sans connaître Stripe dans les Modules métier.
- Stripe live n'est jamais implicite : il dépend explicitement des variables d'environnement.
