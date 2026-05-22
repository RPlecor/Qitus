# Checklist Ops Beta

## Avant ouverture beta

- `npm run validate:production-config` vert.
- `npm run validate:beta-infra` sans blocage.
- `/healthz` retourne `ok`.
- `/readyz` retourne `ready`.
- `/api/system/status` ne contient aucun secret brut.
- `/api/storage/audit` ne signale pas d'artefact critique manquant.
- `/api/metrics/catalog` expose les métriques attendues.

## Web et workers

- Web lancé avec `npm start`.
- Worker lancé avec `npm run worker:all` si `IMPORT_EXECUTION_MODE=bullmq` ou `CRON_MODE=worker`.
- Redis disponible si worker requis.
- Nettoyage workdirs activé selon `WORKDIR_CLEANUP_MAX_AGE_MINUTES`.

## Open Banking

- Local/beta automatisée : `OPEN_BANKING_PROVIDER=mock`.
- Provider live : uniquement si client id, secret, webhook secret et redirect URI sont configurés.
- Aucun secret provider ne doit apparaître dans `/connecteurs`, `/api/system/status` ou les logs.
- `npm run validate:open-banking-end-user` doit prouver connexion, sync, absence de doublon et webhook idempotent.

## Stockage

- Dev : `OBJECT_STORAGE_MODE=local`.
- Beta S3-compatible : endpoint, région, buckets documents/evidence et credentials configurés.
- Si retour arrière, repasser en local et vérifier `/api/storage/audit`.

## Rollback local

- Désactiver connecteurs live : `OPEN_BANKING_PROVIDER=disabled` ou `mock`.
- Revenir au stockage local : `OBJECT_STORAGE_MODE=local`.
- Relancer web/worker.
- Vérifier `/readyz`, `/api/beta-readiness`, puis `npm run validate:mvp`.
