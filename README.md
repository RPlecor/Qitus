# Paperasse SaaS MVP

MVP Remix/Prisma qui transforme des imports bancaires CSV en transactions, catégorisations, écritures équilibrées, puis documents Paperasse.

## Setup

```sh
npm install
cp .env.example .env
docker compose up -d
npm run prisma:migrate
npm run seed
npm run dev
```

Par défaut, l'app utilise un contexte de développement mono-utilisateur et mono-company. En définissant `AUTH_MODE=clerk`, les routes serveur passent par Clerk tout en conservant le mode démo local quand `AUTH_MODE=dev`.

## Variables

- `DATABASE_URL`: URL PostgreSQL Prisma.
- `DEMO_DATASET`: dataset utilisé par `npm run demo:reset`, défaut `qonto_mvp`.
- `AUTH_MODE`: `dev` par défaut, ou `clerk` pour activer l'authentification Clerk serveur.
- `CLERK_PUBLISHABLE_KEY`: requis seulement avec `AUTH_MODE=clerk`.
- `CLERK_SECRET_KEY`: requis seulement avec `AUTH_MODE=clerk`.
- `CLERK_WEBHOOK_SECRET`: secret Svix du webhook Clerk, requis avec `AUTH_MODE=clerk`.
- `REDIS_URL`: URL Redis, prévue pour le traitement asynchrone.
- `AI_PROVIDER`: `codex-cli`, `fake`, `auto` ou `openai`. Le MVP cible `codex-cli`.
- `CODEX_CLI_BIN`: binaire Codex local, défaut `codex`.
- `CODEX_MODEL`: modèle utilisé par `codex exec`, défaut `gpt-5.4-mini`.
- `CHAT_PROVIDER`: `codex-cli` par défaut, ou `fake` pour tests/démo sans appel IA.
- `CHAT_MODEL`: modèle utilisé par le chat via `codex exec`, défaut `CODEX_MODEL`.
- `LIVE_CHAT_TESTS=1`: autorise la validation chat live avec `codex-cli`; par défaut `validate:chat-billing` privilégie `CHAT_PROVIDER=fake`.
- `OPENAI_API_KEY`: optionnel, uniquement pour le provider Platform API `openai`.
- `OPENAI_MODEL`: modèle OpenAI Platform API, défaut `gpt-4o-mini`.
- `LIVE_AI_TESTS=1`: autorise les tests live IA si `OPENAI_API_KEY` est présent.
- `PAPERASSE_REPO_PATH`: chemin du repo Paperasse, défaut `./vendor/paperasse`.
- `DOCUMENT_STORAGE_DIR`: stockage local des documents générés.
- `BILLING_MODE`: `stub` par défaut, ou `stripe` pour activer Checkout/Portal/webhook Stripe test-mode.
- `STRIPE_SECRET_KEY`: requis seulement avec `BILLING_MODE=stripe`.
- `STRIPE_WEBHOOK_SECRET`: requis seulement avec `BILLING_MODE=stripe`.
- `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_ENTREPRISE`, `STRIPE_PRICE_ENTREPRISE_PLUS`: price IDs Stripe test-mode requis avec `BILLING_MODE=stripe`.

## Vérification

```sh
npm test
npm run typecheck
npm run build
npm run validate:end-user
npm run ci
```

Les tests CI restent mockés par défaut. Les transactions non catégorisées avec forte confiance restent en revue et ne génèrent pas d'écriture automatique.
`validate:end-user` est le scénario Playwright du MVP local ; lance `npm run demo:reset` puis `npm run dev` avant de l'exécuter.

## Publication GitHub

Le dépôt est prévu pour être publié sans données locales ni secrets. Avant le premier push, consultez `docs/github-publish-checklist.md`.

Fichiers volontairement exclus :

- `.env` et variantes locales ;
- `storage/`, `tmp/`, `test-results/`, `playwright-report/` ;
- archives et artefacts de démo générés.

Le runtime `vendor/paperasse/` est suivi comme submodule Git vers `https://github.com/romainsimon/paperasse.git`. Après un clone frais :

```sh
git submodule update --init --recursive
```

La CI GitHub se trouve dans `.github/workflows/ci.yml` et exécute typecheck, tests et build avec PostgreSQL en service.

## Déploiement Render

Le dépôt contient un Blueprint [render.yaml](render.yaml) pour créer :

- un service web `qitus-web`;
- une base PostgreSQL `qitus-db`.

La configuration Render par défaut est une staging démo sans secrets live : auth dev, billing stub, chat fake, Open Banking désactivé et stockage local éphémère. Pour une beta réelle, voir `docs/deployment-beta.md`.

Datasets démo disponibles :

```sh
npm run demo:reset -- --list-datasets
DEMO_DATASET=qonto_mvp npm run demo:reset
DEMO_DATASET=multi_bank npm run demo:reset
DEMO_DATASET=regime_reel_tva npm run demo:reset
DEMO_DATASET=closing_beta npm run demo:reset
```

`qonto_mvp` reste le dataset reproductible des validations. Les autres datasets ingèrent les fixtures nécessaires aux cas multi-banques, TVA réel et clôture beta sans devenir la source des tests MVP rapides.
En `AUTH_MODE=dev`, la page `/demo` expose le même sélecteur dans l'application, avec confirmation obligatoire avant reset.

## Activer Codex CLI

Dans `.env`, renseigne :

```sh
AI_PROVIDER="codex-cli"
CODEX_CLI_BIN="codex"
CODEX_MODEL="gpt-5.4-mini"
```

Puis connecte le CLI/app Codex à ton compte ChatGPT :

```sh
codex --login
```

Le backend lit `.env` au démarrage et appelle `codex exec` localement pour la catégorisation IA résiduelle. Aucune `OPENAI_API_KEY` n'est nécessaire pour ce chemin.

Le provider `openai` reste disponible seulement si tu veux explicitement utiliser la Platform API séparée :

```sh
AI_PROVIDER="openai"
OPENAI_API_KEY="sk-..."
```

## Foundation locale

Interfaces ajoutées en Phase 2 :

- `CompanyWorkspace`: charge User, Company, FiscalYear actif, BankAccount principal et abonnement stub.
- `CompanyProfile`: concentre profil et onboarding.
- `ActivityLogCenter`: journalise imports, corrections, documents et profil.
- `RuntimeConfig`: valide l'environnement dev ou Clerk.

Endpoints nouveaux :

- `POST /webhooks/clerk`
- `GET /api/subscription`
- `GET /api/activity-log`
- `GET /api/activity-log/export`
- `GET /chat`
- `POST /api/chat/message`
- `GET /api/chat/history`
- `GET /api/chat/readiness`
- `POST /api/chat/conversations/:id/archive`
- `GET /abonnement`
- `GET /api/usage`
- `GET /api/billing/status`
- `GET /notifications`
- `GET /api/notifications`
- `PATCH /api/notifications/read-all`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/:id/dismiss`
- `GET /exercices`
- `GET /api/fiscal-years`
- `POST /api/fiscal-years`
- `PATCH /api/fiscal-years/:id/activate`
- `GET /api/exports/all`
- `POST /api/privacy/soft-delete`
- `POST /api/privacy/anonymize`
- `POST /api/subscription/checkout`
- `POST /api/subscription/portal`
- `POST /webhooks/stripe`

## Chat et billing beta

Le chat comptable est volontairement en lecture seule. Il utilise le contexte produit réel — dashboard, contrôle, OD, audit journal, documents et clôture — pour expliquer l'état du dossier et orienter vers les bons écrans. Il ne crée ni écriture, ni document, ni OD.

Depuis la Phase 9.5, `ChatReadOnlyPolicy` bloque les demandes qui ressemblent à des mutations avant tout appel provider. `ChatAnswerGrounding` ajoute les références produit utilisées par la réponse, et `/api/chat/readiness` expose provider, modèle, état lecture seule et quota disponible.

Pour tester sans appel Codex :

```sh
CHAT_PROVIDER="fake"
```

Pour utiliser ta souscription ChatGPT/Codex, garde :

```sh
CHAT_PROVIDER="codex-cli"
CODEX_CLI_BIN="codex"
CHAT_MODEL="gpt-5.4-mini"
```

Le billing local reste stub par défaut. Pour tester Stripe en mode test :

```sh
BILLING_MODE="stripe"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_SOLO="price_..."
STRIPE_PRICE_ENTREPRISE="price_..."
STRIPE_PRICE_ENTREPRISE_PLUS="price_..."
```

Le webhook Stripe local cible :

```txt
http://localhost:5173/webhooks/stripe
```

Validation dédiée :

```sh
npm run validate:chat-billing
```

Pour vérifier l'envoi d'un message sans appel Codex live, lancez le serveur avec `CHAT_PROVIDER=fake`. Avec `codex-cli`, le script vérifie readiness et billing puis saute l'envoi, sauf si `LIVE_CHAT_TESTS=1`.

### Clerk en local

Pour tester l'auth réelle :

```sh
AUTH_MODE="clerk"
CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."
```

Dans Clerk, configure un endpoint webhook vers :

```txt
http://localhost:5173/webhooks/clerk
```

Événements à activer :

- `user.created`
- `user.updated`
- `user.deleted`

Le webhook est vérifié avec Svix et enregistré dans `WebhookEvent` pour éviter les doublons. `AUTH_MODE=dev` reste le mode recommandé pour `npm run demo:reset` et `npm run validate:mvp`.
