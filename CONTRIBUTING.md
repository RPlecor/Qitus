# Contribuer

## Installation locale

```sh
npm install
cp .env.example .env
docker compose up -d
npm run prisma:migrate
npm run seed
npm run dev
```

## Vérifications avant PR

```sh
npm run typecheck
npm test
npm run build
```

Pour les parcours produit :

```sh
npm run demo:reset
npm run validate:mvp
npm run validate:end-user
```

## Architecture

- Les routes Remix restent des Adapters fins.
- La logique métier vit dans les Modules profonds sous `app/modules/`.
- Les connecteurs et stockages externes passent par des Adapters.
- Aucun secret provider ne doit être stocké dans Prisma, les logs ou les statuts publics.

## Données de test

Utilisez les datasets démo plutôt que des exports clients :

```sh
npm run demo:reset -- --list-datasets
DEMO_DATASET=qonto_mvp npm run demo:reset
DEMO_DATASET=regime_reel_tva npm run demo:reset
DEMO_DATASET=closing_beta npm run demo:reset
```
