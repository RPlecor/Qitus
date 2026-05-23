# Checklist Ops Beta

## Avant ouverture beta

- `npm run validate:production-config` vert.
- `npm run validate:beta-infra` sans blocage.
- `/healthz` retourne `ok`.
- `/readyz` retourne `ready`.
- `/api/system/status` ne contient aucun secret brut.
- `/api/storage/audit` ne signale pas d'artefact critique manquant.
- `/api/metrics/catalog` expose les métriques attendues.
- `/privacy` est accessible sans authentification.
- `/api/privacy/export` fonctionne pour un utilisateur authentifié.
- Les DPA Clerk, Render et Clever Cloud sont vérifiés selon l'environnement utilisé.
- La TIA simplifiée Clerk et la liste des sous-traitants Clerk sont archivées.
- Aucun secret, token, IBAN complet ou donnée métier Clerk interdite n'apparaît dans les logs ou statuts.
- Avant beta ouverte avec données réelles : l'app et PostgreSQL sont prêts sur Clever Cloud France, backups et restauration inclus.

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

## Confidentialité et conservation

- Les actions utilisateur disponibles : export RGPD, anonymisation, demande de suppression.
- Les données comptables ne sont jamais purgées automatiquement.
- Les purges automatiques ne concernent que liens expirés, notifications anciennes, webhooks anciens, exports temporaires et workdirs.
- Les exports RGPD temporaires doivent être supprimés après leur durée utile.

## Rollback local

- Désactiver connecteurs live : `OPEN_BANKING_PROVIDER=disabled` ou `mock`.
- Revenir au stockage local : `OBJECT_STORAGE_MODE=local`.
- Relancer web/worker.
- Vérifier `/readyz`, `/api/beta-readiness`, puis `npm run validate:mvp`.
