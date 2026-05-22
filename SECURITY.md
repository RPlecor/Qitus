# Security Policy

Paperasse manipule des données comptables, bancaires et fiscales. Le dépôt ne doit jamais contenir de secrets réels.

## Secrets

Ne commitez jamais :

- `.env` ou une variante locale ;
- clés Clerk, Stripe, Qonto, Open Banking, S3 ou OpenAI ;
- tokens provider Bridge/Powens ;
- exports comptables réels, FEC réels ou pièces justificatives clients.

Les valeurs attendues sont documentées dans `.env.example`. Les secrets live doivent rester dans l'environnement d'exécution ou dans le vault provider prévu par l'application.

## Données locales

Les dossiers suivants sont ignorés volontairement :

- `storage/` : documents, pièces et vault local ;
- `tmp/` : workdirs temporaires ;
- `test-results/` et `playwright-report/` : résultats de validation ;
- `vendor/paperasse/` : checkout runtime amont local.

## Avant publication

Avant tout push vers GitHub :

```sh
git status --short --ignored
rg -n --hidden -g '!.git/**' -g '!node_modules/**' -g '!build/**' -g '!storage/**' -g '!tmp/**' -g '!test-results/**' -g '!.env' "sk_live_|sk_test_|whsec_|QONTO_API_SECRET=|OPEN_BANKING_CLIENT_SECRET=|PROVIDER_SECRET_ENCRYPTION_KEY="
```

Si un secret réel apparaît, retirez-le avant de créer le commit.

## Signalement

Pour une beta privée, signalez les vulnérabilités directement au mainteneur du projet plutôt que dans une issue publique.
