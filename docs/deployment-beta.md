# Déploiement Beta Paperasse

Paperasse Phase 16 reste local-first en développement, mais expose une configuration beta plus stricte.

## Processus

- `paperasse-web` : Remix/API (`npm run build`, puis `npm start`).
- `paperasse-worker` : imports BullMQ et tâches planifiées (`npm run worker:all`).
- PostgreSQL managé recommandé.
- Redis requis si `IMPORT_EXECUTION_MODE=bullmq` ou `CRON_MODE=worker`.
- Stockage local en dev, S3-compatible en beta si `OBJECT_STORAGE_MODE=s3`.

## Déploiement Render depuis GitHub

Le dépôt contient un Blueprint Render à la racine : `render.yaml`.

Il crée :

- `qitus-web` : service web Node/Remix.
- `qitus-db` : PostgreSQL managé.

Configuration livrée par défaut :

- `APP_ENV=staging`
- `AUTH_MODE=dev`
- `BILLING_MODE=stub`
- `CHAT_PROVIDER=fake`
- `OPEN_BANKING_PROVIDER=disabled`
- `OBJECT_STORAGE_MODE=local`

Cette configuration sert à obtenir une URL Render rapidement, sans exposer de secrets Clerk, Stripe, Open Banking ou S3. Elle n'est pas une configuration production multi-utilisateur.

Depuis Render :

1. Aller dans **Blueprints**.
2. Sélectionner le repo GitHub `RPlecor/Qitus`.
3. Laisser Render lire `render.yaml`.
4. Créer le Blueprint.
5. Après le premier deploy, ouvrir `/readyz`.

Le build exécute :

```sh
git submodule update --init --recursive && npm ci --include=dev && npx prisma generate && npm run build
```

Sur le plan free Render, `preDeployCommand` n'est pas disponible. La commande de démarrage exécute donc d'abord les migrations puis démarre l'app :

```sh
npx prisma migrate deploy && npm start
```

Sur un plan payant, il est possible de déplacer `npx prisma migrate deploy` dans un pre-deploy command et de revenir à un start command plus strict :

```sh
npm start
```

Important : en Blueprint staging, les documents et pièces utilisent `/tmp/qitus/...`, donc un stockage local éphémère Render. Pour une beta avec preuves persistantes, basculer vers `OBJECT_STORAGE_MODE=s3`.

Pour exposer à de vrais utilisateurs :

- passer `AUTH_MODE=clerk` et renseigner Clerk ;
- passer `BILLING_MODE=stripe` si abonnement réel ;
- passer `OBJECT_STORAGE_MODE=s3` ;
- configurer `PUBLIC_APP_URL` avec le domaine réel ;
- configurer Open Banking uniquement quand le provider est prêt.

## Variables critiques

- `APP_ENV=production`
- `PUBLIC_APP_URL`
- `SESSION_SECRET`
- `COOKIE_SECURE=true`
- `AUTH_MODE=clerk`
- `BILLING_MODE=stripe`
- `OBJECT_STORAGE_MODE=s3`
- `OPEN_BANKING_PROVIDER=mock|gocardless|bridge|powens|tink|yapily`

`npm run validate:production-config` refuse une configuration production incomplète.

## Runbook beta

1. Déployer les migrations : `npx prisma migrate deploy`.
2. Générer le client Prisma si besoin : `npx prisma generate`.
3. Construire l'app : `npm run build`.
4. Démarrer le web : `npm start`.
5. Démarrer les workers si requis : `npm run worker:all`.
6. Vérifier la config : `npm run validate:production-config`.
7. Vérifier le socle beta : `npm run validate:beta-infra`.
8. Vérifier Open Banking mock : `npm run validate:open-banking`.
9. Vérifier le parcours Open Banking end-user : `npm run validate:open-banking-end-user`.

Rollback local : revenir à `OBJECT_STORAGE_MODE=local`, `OPEN_BANKING_PROVIDER=disabled` ou `mock`, puis relancer `/readyz` et `/api/beta-readiness`.

## Open Banking

Paperasse ne fait pas d'intégration DSP2 banque-par-banque. Le flux passe par un provider agréé :

1. `/connecteurs` crée un consentement.
2. Le provider renvoie un callback.
3. `OpenBankingCenter` synchronise comptes et mouvements.
4. `BankFeedNormalizer` transforme le flux en mouvements bancaires canoniques.
5. `ImportOrchestrator` ingère les mouvements avec la déduplication existante.
6. Les rapprochements sont marqués à relancer si nécessaire.

Aucun secret bancaire utilisateur n'est stocké en base.

### GoCardless Bank Account Data

- `OPEN_BANKING_PROVIDER=gocardless`
- `OPEN_BANKING_CLIENT_ID` contient le `secret_id` GoCardless.
- `OPEN_BANKING_CLIENT_SECRET` contient le `secret_key` GoCardless.
- `OPEN_BANKING_REDIRECT_URI` pointe vers `/api/open-banking/callback`.
- `OPEN_BANKING_WEBHOOK_SECRET` reste optionnel tant qu'aucun webhook GoCardless n'est activé.

Les transactions `booked` sont importées dans le pipeline existant. Les transactions `pending` ne créent pas d'écritures.

### Bridge

- `OPEN_BANKING_PROVIDER=bridge`
- `OPEN_BANKING_CLIENT_ID` et `OPEN_BANKING_CLIENT_SECRET` contiennent les identifiants Bridge API.
- `OPEN_BANKING_REDIRECT_URI` pointe vers `/api/open-banking/callback`.
- `OPEN_BANKING_WEBHOOK_SECRET` signe les webhooks Bridge.
- `PROVIDER_SECRET_ENCRYPTION_KEY` chiffre les tokens provider hors Prisma en staging/production.

Bridge gère le choix bancaire dans son parcours Connect. Paperasse stocke uniquement les ids provider non secrets, puis importe les comptes et transactions via `BankFeedNormalizer` et `ImportOrchestrator`.

### Powens

- `OPEN_BANKING_PROVIDER=powens`
- `OPEN_BANKING_BASE_URL=https://{domain}.biapi.pro/2.0`
- `OPEN_BANKING_CLIENT_ID` et `OPEN_BANKING_CLIENT_SECRET` contiennent les identifiants API Powens.
- `OPEN_BANKING_REDIRECT_URI` pointe vers `/api/open-banking/callback`.
- `OPEN_BANKING_WEBHOOK_SECRET` signe les webhooks Powens.
- `PROVIDER_SECRET_ENCRYPTION_KEY` chiffre le token utilisateur Powens hors Prisma en staging/production.

Powens gère le choix bancaire dans son Webview. Les comptes supprimés ou désactivés sont ignorés, et les transactions synchronisées passent par le pipeline d'import existant.

## Connecteurs Qonto et Stripe

`CONNECTORS_MODE=live` active les connecteurs directs :

- Qonto direct : `QONTO_ID` et `QONTO_API_SECRET`, puis `POST /api/connectors/qonto/sync`.
- Stripe rapprochement : `STRIPE_SECRET`, puis `POST /api/connectors/stripe/sync`.

Qonto alimente les transactions via le pipeline d'import Paperasse. Stripe alimente uniquement les modèles de rapprochement (`StripeEvent`, `StripePayout`) pour matcher payouts, frais et refunds. Les secrets restent dans l'environnement et ne sont jamais stockés en base.

## Healthchecks

- `GET /healthz` : liveness minimal.
- `GET /readyz` : readiness DB, runtime, Redis si requis, storage, Open Banking.
- `GET /api/system/status` : statut authentifié, secrets masqués.
- `GET /api/metrics` : métriques locales récentes.
- `GET /api/beta-readiness` : synthèse produit des checks beta.
- `GET /api/workers/status` : worker import et cron, sans dépendre d'un process live.
- `GET /api/metrics/catalog` : métriques beta attendues.

## Stockage

S3-compatible utilise :

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET_DOCUMENTS`
- `S3_BUCKET_EVIDENCE`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

Le mode local reste le défaut pour `demo:reset` et les validations MVP.

`GET /api/storage/audit` vérifie documents et pièces. Un fichier local manquant est signalé dans l'audit, pas remonté comme `Application Error`.
