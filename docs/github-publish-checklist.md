# Checklist Publication GitHub

Cette checklist prépare Paperasse pour un premier dépôt GitHub propre, sans secrets ni artefacts locaux.

## 1. Vérifier les fichiers exclus

```sh
git status --short --ignored
```

Doivent rester ignorés :

- `.env`
- `node_modules/`
- `build/`
- `storage/`
- `tmp/`
- `test-results/`
- `playwright-report/`

`vendor/paperasse/` est suivi comme submodule Git. Il apparaît donc dans le dépôt comme un pointeur de commit, pas comme une copie complète du runtime.

## 2. Vérifier les secrets

```sh
rg -n --hidden -g '!.git/**' -g '!node_modules/**' -g '!build/**' -g '!storage/**' -g '!tmp/**' -g '!test-results/**' -g '!.env' "sk_live_|sk_test_|whsec_|QONTO_API_SECRET=|OPEN_BANKING_CLIENT_SECRET=|PROVIDER_SECRET_ENCRYPTION_KEY="
```

Les seules occurrences acceptables sont des exemples, des tests ou de la documentation. Aucun secret réel ne doit apparaître.

## 3. Initialiser le dépôt

Si le dossier n'est pas encore un dépôt git :

```sh
git init
git add .
git status
git commit -m "Initial Paperasse repository"
```

Si le dépôt est cloné ailleurs, récupérer aussi le runtime :

```sh
git submodule update --init --recursive
```

## 4. Créer le dépôt GitHub

Sur GitHub, créez un dépôt vide, puis :

```sh
git branch -M main
git remote add origin git@github.com:<owner>/<repo>.git
git push -u origin main
```

## 5. Configurer GitHub Actions

La CI `.github/workflows/ci.yml` lance :

- `npm ci`
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npm run typecheck`
- `npm test`
- `npm run build`

Elle utilise PostgreSQL en service GitHub Actions et des providers stub/mock.

## 6. Notes Render

Pour Render, utilisez le Blueprint `render.yaml` à la racine du repo. Il crée un service web Node et une base PostgreSQL avec une configuration staging sans secrets live.

Le premier déploiement est volontairement en mode :

- `AUTH_MODE=dev`
- `BILLING_MODE=stub`
- `CHAT_PROVIDER=fake`
- `OPEN_BANKING_PROVIDER=disabled`
- `OBJECT_STORAGE_MODE=local`

Ne copiez jamais votre `.env` local dans GitHub ou Render.

Commandes habituelles :

```sh
git submodule update --init --recursive && npm ci && npx prisma generate && npm run build
npx prisma migrate deploy && npm start
```
