# Roadmap Qitus SaaS

Date : 2026-05-19  
Sources : `Backend/cadrage-architecture-backend-qitus-v3.md`, `Backend/annexe cadrage architecture-deterministe-vs-ia-qitus.md`, `Backend/analyse-execution-etapes-1-4.md`

## Lecture rapide

Qitus SaaS transforme un runtime documentaire CLI/filesystem historique en application web SaaS.

L'idée centrale est simple :

1. Construire l'expérience SaaS autour de Qitus : comptes utilisateurs, entreprises, imports, écrans, base de données, documents téléchargeables.
2. Réutiliser au maximum les scripts, templates, données et skills du repo Qitus existant.
3. Utiliser l'IA seulement quand il faut interpréter du texte libre ou porter un jugement.
4. Garder tout ce qui est calculable en code déterministe : parsing CSV, écritures, KPIs, FEC, documents, alertes, calculs comptables simples.

Dans ce repo, le provider IA cible est `codex-cli`, c'est-à-dire Codex local connecté au compte ChatGPT/Codex, sans `OPENAI_API_KEY` manuelle.

## Recalage après audit de couverture fonctionnelle

L'audit `Backend/audit-couverture-fonctionnelle-mvp.md` introduit une distinction importante entre trois niveaux :

- **Implémenté localement** : disponible dans Qitus, couvert par tests et validations locales.
- **Préparé ou réutilisable** : présent dans le runtime documentaire submodule ou dans l'architecture, mais pas encore branché comme fonctionnalité SaaS complète.
- **Nécessaire avant beta** : indispensable pour soutenir la promesse "automatisation comptable avec revue expert-comptable" au-delà d'une micro-entreprise en franchise de TVA.

Conclusion de l'audit :

- Qitus couvre fortement la boucle locale `import → catégorisation → écritures → documents → contrôle → clôture`.
- Le produit est déjà très avancé sur l'auditabilité interne : preuves, journal, génération Qitus, contrôle pré-clôture, OD, archive et verrouillage.
- Avant une beta SaaS sérieuse, il faut combler trois fondamentaux comptables :
  - ventilation TVA dans les écritures ;
  - liasse fiscale brouillon structurée et vérifiable case par case ;
  - partage/revue expert-comptable.

Conséquence roadmap : la prochaine priorité produit devient une **Phase 8.5 — Couverture comptable beta**, avant la Phase 9 chat/billing.

## Principe d'architecture

Le module critique est le pont entre deux mondes :

- Monde SaaS : Remix, Prisma, PostgreSQL, utilisateurs, entreprises, transactions, documents.
- Monde Qitus : fichiers `company.json`, `data/journal-entries.json`, scripts Node.js, templates, données réglementaires.

Ce pont est actuellement matérialisé par runtime documentaire. Dans le cadrage backend, il est appelé `QitusAdapter`.

Son rôle :

- convertir une entreprise SaaS en `company.json` compatible Qitus ;
- convertir les écritures comptables en `data/journal-entries.json` ;
- préparer un dossier temporaire compatible avec les scripts Qitus ;
- lancer les scripts avec `execFile` ;
- récupérer les fichiers générés ;
- nettoyer le dossier temporaire.

## Phase 1 — MVP

Objectif : prouver la boucle centrale de valeur.

Statut local : MVP construit, puis gelé via la Phase 1.5 avec un reset démo reproductible et une validation HTTP locale.

Un utilisateur doit pouvoir configurer son entreprise, importer des transactions, obtenir des catégorisations, corriger les cas incertains, générer des écritures équilibrées et produire les premiers documents Qitus.

### Résultat attendu

Le MVP doit livrer cette boucle :

```txt
Onboarding entreprise
→ Import CSV bancaire
→ Normalisation transactions
→ Catégorisation déterministe
→ Codex CLI pour les cas résiduels
→ Revue/correction utilisateur
→ Écritures comptables équilibrées
→ Dashboard
→ FEC + balance + bilan + compte de résultat
```

### Fonctionnel inclus

- Authentification et onboarding entreprise.
- Profil société : identité, forme juridique, SIREN/SIRET, adresse, dirigeant, régime fiscal, TVA, exercice.
- Création d'un exercice comptable actif.
- Création du compte bancaire principal, par défaut `5121`.
- Import CSV bancaire.
- Historique des imports.
- Détection des colonnes pour les CSV inconnus.
- Mapping manuel des colonnes si le format n'est pas reconnu.
- Parsers CSV Qonto, BNP, Société Générale, Boursorama et générique.
- Normalisation des transactions.
- Déduplication.
- Catégorisation déterministe par règles :
  - `CorrectionRule` propre à l'entreprise ;
  - `VendorMapping` global ou propre à l'entreprise ;
  - patterns et mots-clés dans les libellés.
- Appel IA seulement pour les transactions résiduelles.
- Provider IA `codex-cli`, via `codex exec`, sans clé API OpenAI Platform.
- Correction manuelle d'une transaction.
- Apprentissage à partir des corrections utilisateur.
- Génération d'écritures comptables en partie double.
- Journal `BQ`.
- Numérotation séquentielle des écritures.
- Dashboard basique : chiffre d'affaires, charges, résultat, trésorerie, transactions à vérifier.
- Liste des transactions.
- Liste des écritures.
- Génération de documents :
  - FEC ;
  - balance ;
  - bilan ;
  - compte de résultat.
- Stockage local des documents en développement.
- Téléchargement des documents.

### Ce qui est réutilisé depuis Qitus

- `scripts/generate-fec.js` pour le FEC.
- `scripts/generate-statements.js` pour balance, bilan et compte de résultat.
- `data/pcg_2026.json`.
- `data/nomenclature-liasse-fiscale.csv`.
- `data/sources.json`.
- Les templates nécessaires aux documents.
- Le runtime documentaire dans `vendor/paperasse`.

### Ce qui est construit dans le SaaS

- Application Remix.
- Modèle Prisma.
- API HTTP.
- Import pipeline.
- Parsers CSV.
- Catégorisation déterministe.
- Adapter/runtime Qitus.
- Frontend MVP repris du prototype HTML.
- Tests unitaires.
- Setup local Postgres/Redis.

### Interfaces API MVP

- `POST /api/companies`
- `GET /api/companies/:id`
- `PATCH /api/companies/:id`
- `POST /api/imports`
- `GET /api/imports`
- `GET /api/imports/:id/status`
- `GET /api/imports/:id/detected-columns`
- `POST /api/imports/:id/column-mapping`
- `GET /api/transactions`
- `GET /api/transactions/:id`
- `PATCH /api/transactions/:id/categorize`
- `GET /api/journal-entries`
- `GET /api/journal-entries/export`
- `GET /api/dashboard/kpis`
- `GET /api/dashboard/alerts`
- `GET /api/documents`
- `POST /api/documents/:type/generate`
- `GET /api/documents/:id/download`

### Règle IA du MVP

L'IA ne doit pas être le chemin principal.

Ordre de traitement :

1. CorrectionRule de l'entreprise.
2. VendorMapping de l'entreprise.
3. VendorMapping global exact.
4. VendorMapping global en `contains`.
5. Mot-clé dans le libellé.
6. Regex dans le libellé.
7. Codex CLI seulement si rien n'a matché.

Si Codex échoue, timeout ou ne répond pas correctement :

- la transaction reste en revue ;
- le compte d'attente `471` est utilisé ;
- aucune écriture automatique ne doit être créée avec une confiance faible.

### Tests MVP

- Parsers CSV avec fixtures.
- `CategorizationEngine` avec provider fake.
- Provider `codex-cli` testé sans lancer de vraie session Codex.
- Fallback en revue si l'IA échoue.
- `LedgerWriter` : débit = crédit.
- conversion company.json du runtime documentaire compatible avec `company.example.json`.
- Build Remix.

### État actuel dans ce repo

Déjà en place :

- Remix + Prisma + Vitest.
- Modèle Prisma MVP.
- runtime documentaire.
- Parsers CSV.
- Catégorisation déterministe.
- Provider `codex-cli`.
- Provider `openai` gardé mais désactivé par défaut.
- Routes API MVP.
- Frontend MVP adapté du prototype.
- Tests.
- `config/llm-providers.json`.
- `config/agents.json`.
- `docker-compose.yml`.
- `README.md`.

À durcir avant usage réel :

- Brancher Clerk réellement au lieu du contexte dev.
- Exécuter une migration Prisma sur Postgres local.
- Faire un test complet avec import CSV réel et base de données active.
- Ajouter les workers BullMQ au lieu d'un traitement synchrone.
- Ajouter stockage objet type S3/Scaleway pour production.
- Ne pas considérer les connecteurs Qonto/Stripe comme couverts tant que les scripts du runtime documentaire ne sont pas branchés dans un vrai module SaaS d'intégrations.
- Compléter le seed déterministe : le MVP local contient une base courte de mappings, pas encore une table globale de 100 à 150 vendors.
- Ajouter la ventilation TVA avant d'adresser les entreprises au régime réel.
- Transformer la liasse fiscale `.md` actuelle en brouillon structuré exploitable par un expert-comptable.
- Ajouter un mode de revue ou partage expert-comptable.

## Phase 2 — Foundation production

Objectif : transformer le MVP local en base exploitable proprement.

Cette phase correspond aux éléments "Foundation" du cadrage backend.

### Livrables

- Migrations Prisma stabilisées.
- Auth Clerk réelle.
- Middleware utilisateur.
- Middleware entreprise.
- Middleware abonnement, même si l'abonnement peut rester inactif au début.
- CRUD entreprise complet.
- Onboarding API complet.
- CI/CD.
- Fork ou submodule Qitus décidé et documenté.
- Adapter Qitus stabilisé.
- Gestion des erreurs structurée.
- Journal d'activité technique minimal.

### Points techniques

- Le repo Qitus reste une dépendance locale/forkée.
- Les scripts Qitus doivent être audités :
  - s'ils sont importables comme modules, on peut les appeler directement ;
  - sinon, on garde l'exécution CLI via dossier temporaire.
- Le cadrage recommande `execFile`, pas une commande shell composée.
- Chaque exécution doit avoir un timeout.
- Les logs stdout/stderr doivent être capturés.
- Le `scriptVersion` doit être stocké avec les documents générés.

## Phase 3 — Import pipeline avancé

Objectif : rendre l'import robuste, traçable et asynchrone.

Cette phase reprend "Import pipeline CSV" du cadrage, en version production.

### Livrables

- Pipeline BullMQ en plusieurs étapes.
- Statuts d'import temps réel.
- Endpoint SSE ou polling court pour le suivi.
- Gestion `NEEDS_MAPPING` si le CSV est inconnu.
- Retry d'un import échoué.
- Retry de la catégorisation uniquement, sans reparser le CSV.
- Historique complet des imports.
- Durée d'exécution et nombre de lignes suivis.

### Étapes du pipeline CSV

1. Détecter format, encodage, séparateur et banque.
2. Parser et normaliser les lignes.
3. Si format inconnu, exposer les colonnes et demander un mapping manuel.
4. Appliquer les règles déterministes.
5. Appeler Codex CLI seulement pour les transactions résiduelles.
6. Créer les écritures comptables.

### Parsers prévus

- Qonto.
- BNP.
- Société Générale.
- Boursorama.
- GenericParser avec mapping manuel.

## Phase 4 — Connecteurs bancaires et paiement

Objectif : permettre l'import automatique depuis les connecteurs fournis par Qitus.

Cette phase reprend "Import connecteurs" du cadrage.

### Livrables

- CRUD des intégrations.
- Connexion Qonto.
- Connexion Stripe.
- Test de connexion.
- Déclenchement manuel d'un fetch.
- Intégration des résultats dans le même pipeline que le CSV.
- Chiffrement des credentials.
- Champ `Integration.lastFetchCount`.

### Réutilisation Qitus

- `integrations/qonto/fetch.js`.
- `integrations/stripe/fetch.js`.

### Sécurité

- Les secrets Qonto/Stripe ne doivent pas être écrits en clair dans le dossier temporaire.
- Ils doivent être stockés chiffrés.
- Ils doivent être injectés au worker via variables d'environnement au moment de l'exécution.

## Phase 5 — Catégorisation IA et optimisation déterministe

Objectif : améliorer la qualité de catégorisation tout en minimisant le recours à l'IA.

Cette phase reprend "Catégorisation IA" du cadrage et l'annexe déterministe vs IA.

### Livrables

- `VendorLookupTable` plus complète.
- Seed global de 100 à 150 mappings.
- Hit rate mesuré.
- CorrectionRules créées automatiquement après correction utilisateur.
- Batches IA optimisés.
- Suivi des appels IA économisés.
- Suivi du coût IA évité.
- Meilleure gestion des cas ambigus.

### Exemples de mappings globaux

- `ovh`, `aws`, `scaleway`, `hetzner`, `digitalocean`, `cloudflare` → `6135`.
- `notion`, `slack`, `github`, `figma`, `canva`, `anthropic`, `openai` → `6135`.
- `sncf`, `air france`, `eurostar`, `easyjet`, `ryanair` → `6251`.
- `booking`, `airbnb`, `accor`, `ibis` → `6256`.
- `axa`, `allianz`, `maif`, `mma`, `macif`, `generali` → `6161`.
- `urssaf` → `6451`.
- `orange`, `sfr`, `bouygues telecom`, `free mobile` → `6262`.
- `qonto`, `boursorama`, `bnp` avec frais/commission → `627`.
- `stripe fee/commission` → `6278`.
- `stripe payout` → mouvement de trésorerie, pas un revenu.
- `greffe`, `inpi`, `cci` → `6354`.
- `expert comptable`, `fiduciaire` → `6226`.
- `impots.gouv`, `dgfip`, `tresor public` → `635`.
- `loyer`, `bail`, `coworking`, `regus`, `wework` → `6132`.

### Objectif chiffré

Sur 200 transactions :

- environ 65 % catégorisées par vendor lookup ;
- environ 12 % par patterns ;
- environ 8 % par CorrectionRules ;
- environ 15 % seulement passent à l'IA.

Cela vise environ 70 % de réduction de coût IA par utilisateur.

## Phase 6 — Dashboard, transactions et correction avancés

Objectif : rendre l'exploitation quotidienne confortable.

Cette phase reprend "Dashboard + transactions" du cadrage.

Statut local : implémentée dans le MVP avec `TransactionExplorer`, `TransactionSuggestionCenter`, `CorrectionRuleCenter`, filtres/pagination transactions, règles utilisateur et dashboard enrichi.

### Livrables

- KPIs fiables.
- Liste transaction paginée.
- Filtres par statut, date, recherche.
- Détail transaction.
- Suggestions de catégorisation.
- Correction transaction.
- Création et suppression des règles de correction.
- Alertes visibles sur le dashboard.

### KPIs

- Chiffre d'affaires cumulé.
- Charges cumulées.
- Résultat courant.
- Trésorerie.
- Tendance N/N-1 lorsque plusieurs exercices existent.
- Nombre de transactions à vérifier.

Tout cela est déterministe : agrégations SQL, zéro IA.

## Phase 6.5 — Gel exploitation quotidienne

Objectif : stabiliser l'expérience quotidienne livrée en Phase 6 avant de passer à la production documentaire.

Statut local : implémentée comme gel de cohérence autour des Modules `TransactionFilterState`, `TransactionReviewQueue`, `CorrectionRuleImpactCenter` et `OperationalDashboardConsistency`.

### Livrables

- Filtres transactions bookmarkables dans l'URL.
- Badges de filtres actifs.
- Page size `25 / 50 / 100`.
- États vides différenciés, dont `Aucune transaction à corriger`.
- File de revue avec position, précédent, suivant et redirection automatique après correction.
- Détail d'une règle de correction avec impact, exemples et conflits.
- API d'impact de règle.
- API de cohérence dashboard.
- Dashboard indiquant `Exploitation cohérente` ou `Données à revoir`.
- Validation end-user renforcée sur filtres, correction suivante, règles et cohérence.

### Principe d'architecture

Les routes Remix restent des Adapters fins. Les règles de lecture métier sont concentrées dans des Modules profonds :

- `TransactionFilterState` pour les filtres et URLs.
- `TransactionReviewQueue` pour la revue.
- `CorrectionRuleImpactCenter` pour l'explicabilité des règles.
- `OperationalDashboardConsistency` pour l'alignement dashboard/transactions/documents/OD/règles.

## Phase 7 — Journal et documents production

Objectif : fiabiliser la partie comptable et documentaire.

Cette phase reprend "Journal + documents" du cadrage.

Statut local : implémentée comme base production-shaped avec journal filtrable/exportable, documents enrichis et exécution Qitus structurée.

### Livrables

- API journal paginée et filtrable.
- Export CSV des écritures.
- `JournalExplorer` : filtres, pagination, facettes, totaux débit/crédit, contrôle d'équilibre.
- `JournalExportCenter` : CSV/JSON/preview FEC du journal SaaS.
- `DocumentCatalog` : listing, téléchargement, métadonnées et fraîcheur.
- `DocumentGenerationCenter` : préflight comptable, génération et remplacement sans doublons.
- `DocumentStorageAdapter` local : seam prête pour stockage objet futur.
- centre d’exécution documentaire : scripts Qitus avec args, timeout, stdout/stderr, exitCode, scriptVersion et message utilisateur.
- Génération FEC.
- Génération balance.
- Génération bilan.
- Génération compte de résultat.
- Génération PDF reportée hors MVP local.
- Upload S3/Scaleway reporté Phase infrastructure.
- Traçabilité `generatedBy`.
- Traçabilité `scriptVersion`.

### Scripts réutilisés

- `generate-fec.js`.
- `generate-statements.js`.
- `generate-pdfs.js`.

## Phase 7.5 — Gel preuve comptable et documents auditables

Objectif : figer l'auditabilité locale avant la clôture annuelle.

Statut local : implémentée comme gel d'auditabilité avec preuves journal, génération Qitus et paquet de preuve local.

### Livrables

- `JournalAuditCenter` : contrôle de preuve du journal au-dessus de `JournalExplorer`.
- Détection des écritures sans lignes, lignes invalides, doubles sens débit/crédit et déséquilibres.
- API `/api/journal-entries/audit`.
- Bloc `Journal équilibré` / anomalies dans `/ecritures`.
- `DocumentGenerationAuditCenter` : audit ActivityLog des tentatives, succès et échecs de génération.
- API `/api/documents/audit`.
- Bloc `Audit génération` dans `/documents`.
- `DocumentEvidenceBundle` : manifest local de preuve avec company, exercice, documents, `scriptVersion`, audit journal et CSV.
- API `/api/documents/evidence-bundle`.
- Action `Télécharger paquet de preuve`.
- Validation HTTP et Playwright renforcée sur audit journal, audit génération, manifest de preuve et activité.

### Hors scope

- Signature électronique.
- Stockage objet.
- Verrouillage d'exercice.
- PDF obligatoire.
- Workflow complet de clôture.

## Phase 8 — Clôture annuelle

Objectif : couvrir le workflow de clôture en 12 étapes.

Cette phase reprend "Clôture" du cadrage, avec l'optimisation de l'annexe : la clôture doit être majoritairement déterministe.

Statut local : implémentée comme clôture guidée auditable avec verrouillage/réouverture d'exercice.

### Livrables

- État de clôture par exercice.
- Démarrage de clôture.
- Détail de chaque étape.
- Exécution étape par étape.
- Stockage des résultats.
- Immobilisations CRUD.
- Double-check arithmétique.
- Génération des documents finaux.
- `AnnualClosingCenter` pour orchestrer le run, les étapes et le verrouillage.
- `ClosingStepCatalog` avec 12 codes stables.
- `FixedAssetRegister` pour les immobilisations et amortissements linéaires.
- `BankReconciliationCenter` pour le solde bancaire de clôture.
- `TaxPackageDraftCenter` pour la liasse fiscale brouillon `.md`.
- Document final `EVIDENCE_BUNDLE` persisté localement.
- APIs `/api/cloture`, `/api/fixed-assets`, `/api/bank-reconciliation`.
- UI `/cloture`, `/cloture/:step`, `/cloture/archive`, `/immobilisations`.
- ADR 0003 sur la clôture étape par étape et auditable.

### Les 12 étapes

1. Vérification balance.
2. Rapprochement bancaire.
3. Lettrage tiers.
4. PCA/CCA.
5. Amortissements.
6. Provisions.
7. TVA annuelle.
8. Calcul IS/IR.
9. Écritures de clôture.
10. États financiers.
11. Liasse fiscale.
12. Export et archivage.

### Ce qui doit rester déterministe

- Balance : somme débit = somme crédit.
- Rapprochement : comparaison solde comptable vs solde réel.
- PCA/CCA : formule au prorata si la charge est flaggée annuelle.
- Amortissements : formule linéaire ou dégressive.
- TVA : agrégation des comptes TVA.
- IS : formule avec taux réduit PME si les conditions sont remplies.
- États financiers et exports : scripts Qitus.

### Ce qui justifie l'IA

- Lettrage ambigu.
- Provisions : évaluer un risque ou un litige.
- Explication utilisateur des anomalies.

### Double-check backend

Même si l'IA propose un calcul, le backend vérifie :

- dotations d'amortissement ;
- calcul IS ;
- équilibre actif/passif ;
- équilibre débit/crédit.

### Limite actuelle de la Phase 8

La Phase 8 prouve un workflow local de clôture auditable, mais elle ne suffit pas encore pour promettre un dépôt fiscal quasi complet avec expert-comptable.

Points à ne pas surinterpréter :

- `TaxPackageDraftCenter` produit une liasse brouillon `.md`, pas un formulaire CERFA/2033/2065 vérifiable case par case.
- Les étapes TVA, IS, provisions et lettrage sont représentées dans le workflow, mais toutes ne sont pas encore des calculateurs fiscaux complets.
- Les scripts Qonto/Stripe existent dans le runtime documentaire, mais les connecteurs SaaS ne sont pas encore livrés.
- Les écritures d'import restent majoritairement en 2 lignes TTC ; la TVA n'est pas encore ventilée dans les comptes `44566` et `44571`.
- La validation reste faite par l'utilisateur courant ; il n'existe pas encore de revue expert-comptable séparée.

## Phase 8.5 — Couverture comptable beta

Objectif : combler les trois écarts comptables bloquants identifiés par l'audit avant de passer au chat, au billing et à l'infrastructure beta.

Cette phase ne remplace pas la Phase 9. Elle la précède pour éviter de commercialiser une expérience très auditable mais encore trop étroite fonctionnellement.

### Statut

À planifier et implémenter.

### Livrables prioritaires

#### 1. TVA déterministe dans les écritures

Objectif : permettre aux entreprises au régime réel simplifié ou normal de produire des écritures exploitables.

Livrables :

- Ajouter `vatRate` sur les mappings ou catégorisations utiles.
- Préremplir le taux TVA depuis les vendors déterministes quand c'est fiable.
- Permettre à l'utilisateur de corriger le taux lors de la revue transaction.
- Adapter `LedgerWriter` pour générer des écritures HT/TVA/TTC quand l'entreprise n'est pas en franchise.
- Utiliser `44566` pour la TVA déductible sur achats.
- Utiliser `44571` pour la TVA collectée sur ventes.
- Garder les écritures sans TVA pour les entreprises en franchise.
- Préparer les agrégations qui alimenteront les futures déclarations TVA.

Exemple achat au réel :

```txt
Débit  6135   Charge HT          100,00
Débit  44566  TVA déductible      20,00
Crédit 5121   Banque             120,00
```

Exemple vente au réel :

```txt
Débit  5121   Banque           1 200,00
Crédit 706    Produit HT       1 000,00
Crédit 44571  TVA collectée      200,00
```

Modules concernés :

- `LedgerWriter`
- `CategorizationEngine`
- `TransactionCorrectionFlow`
- `VendorMapping`
- `TransactionSuggestionCenter`
- `JournalAuditCenter`

#### 2. Liasse fiscale brouillon structurée

Objectif : donner à l'expert-comptable un document contrôlable case par case, même sans télétransmission EDI.

Livrables :

- Brancher les templates Qitus existants pour la liasse 2033/2065.
- Produire une source structurée obligatoire avec rubriques, cases identifiables, montants et références de calcul.
- Produire un PDF dérivé si le runtime Puppeteer/Chromium est disponible.
- Garder un fallback HTML/Markdown structuré si le PDF échoue ou n'est pas activé.
- Renseigner les montants depuis le journal, les états financiers et les OD validées.
- Garder un marquage clair `Brouillon local - non télétransmis`.
- Stocker le document comme `DocumentType.LIASSE_FISCALE`.
- Lier la génération à `DocumentGenerationAuditCenter`.
- Inclure la liasse dans le paquet de preuve.

Modules concernés :

- `TaxPackageDraftCenter`
- `TaxPackageTemplateRenderer`
- `DocumentGenerationCenter`
- centre d’exécution documentaire
- renderer PDF documentaire
- `DocumentEvidenceBundle`
- `AnnualClosingCenter`

Décisions verrouillées pour la Phase 8.5 :

- Les scripts Qitus restent appelés en CLI via workdir et `execFile`.
- Aucun refactor upstream pour rendre `generate-pdfs.js` importable n'est requis dans cette phase.
- La source structurée est la vérité métier.
- Le PDF est un rendu de confort pour l'expert-comptable, pas une dépendance bloquante.

#### 3. Partage expert-comptable en lecture seule

Objectif : réduire le va-et-vient email/export/import et permettre une revue humaine externe.

Livrables :

- Créer un modèle `ShareLink` avec token, expiration, company, fiscal year et permissions.
- Ajouter une route `/shared/:token` en lecture seule.
- Exposer dashboard, écritures, documents, contrôle, OD et clôture.
- Ajouter une action `Validé par l'expert-comptable` avec nom, note et horodatage.
- Enregistrer la validation dans `ActivityLog`.
- Afficher cette validation dans `/cloture` et dans le paquet de preuve.

Cette approche évite de construire tout de suite un portail multi-rôles complet.

Modules à créer ou approfondir :

- `ExpertReviewShareCenter`
- `ShareLinkAccess`
- `AnnualClosingCenter`
- `DocumentEvidenceBundle`
- `ActivityLogCenter`

### Livrables secondaires

- Upload justificatifs par transaction : stockage local d'abord, interface prête pour objet distant.
- Journaux `AC` et `VE` configurables quand l'opération ne doit pas rester dans le seul journal `BQ`.
- Rapprochement bancaire périodique, décorrélé du seul workflow annuel.
- Déclarations TVA périodiques : CA3/CA12 brouillon, alimentées par les comptes TVA une fois la ventilation en place.

### Critère de sortie

La Phase 8.5 est terminée quand une SASU/EURL au régime réel simplifié peut :

```txt
Importer ses transactions
→ corriger les cas ambigus
→ obtenir des écritures HT/TVA/TTC
→ générer FEC, états et liasse brouillon structurée
→ obtenir un PDF de liasse si Puppeteer/Chromium est disponible
→ partager le dossier à son expert-comptable
→ obtenir une validation tracée
→ clôturer et archiver le dossier
```

### Tests attendus

- Unit : ventilation TVA achats/ventes/franchise.
- Unit : liasse brouillon structurée stable à partir d'un journal connu.
- Unit : fallback HTML/Markdown si le rendu PDF est indisponible.
- Unit : création, expiration et refus d'un `ShareLink`.
- Integration : import fixture régime réel → écritures avec `44566`/`44571` → FEC contenant la TVA.
- Integration : génération liasse structurée → document inclus dans evidence bundle.
- Integration : génération PDF si Puppeteer/Chromium est disponible, sans échec bloquant sinon.
- End-user : partager le dossier, ouvrir `/shared/:token`, valider comme EC, vérifier l'activité.

### Datasets de durcissement

Le reset local reste basé sur `qonto_mvp` pour conserver les chiffres de validation MVP, mais `DemoDatasetSeeder` expose aussi :

- `multi_bank` : Qonto + BNP + Société Générale + Boursorama, pour durcir parsers et idempotence.
- `regime_reel_tva` : SARL commerce au réel simplifié, pour vérifier les écritures TVA.
- `closing_beta` : MVP Qonto + immobilisations + rapprochement bancaire, pour nourrir clôture, liasse et paquet de preuve.

## Phase 9 — Chat comptable et billing — implémentée beta locale

Objectif : ajouter l'assistant conversationnel et la logique d'abonnement.

Cette phase reprend "Chat + billing" du cadrage.

### Chat

- Endpoint `POST /api/chat/message`.
- Réponse SSE compatible, avec fallback JSON/HTML.
- Historique de conversation persisté.
- `ChatContextBuilder` injecte entreprise, exercice, KPIs, contrôle, OD, audit journal, documents et clôture.
- `AccountingChatProvider` passe par `codex-cli` par défaut, avec `FakeChatAdapter` pour tests.
- `UsageMeter` suit les messages IA.

Le chat est 100 % IA pour la génération de réponse, mais 0 % mutation : il est lecture seule et ne crée aucune donnée comptable.

### Billing

- État abonnement via `SubscriptionCenter`.
- Checkout Stripe test-mode.
- Customer portal Stripe test-mode.
- Webhook Stripe signé et idempotent via `BillingWebhookEvent`.
- Gate d'accès via `EntitlementGate`.
- Usage mensuel via `UsageEvent`.
- Mode local `BILLING_MODE=stub` conservé par défaut.

### Tiers du cadrage

- Solo : 60 requêtes API/min, 100 appels IA/mois, 5 imports/mois.
- Entreprise : 120 requêtes API/min, 300 appels IA/mois, 15 imports/mois.
- Entreprise+ : 200 requêtes API/min, 1000 appels IA/mois, 50 imports/mois.

## Phase 9.5 — Gel chat/billing beta — implémentée localement

Objectif : rendre le chat et le billing suffisamment vérifiables avant d'élargir vers notifications, RGPD et multi-exercice.

### Chat gelé

- `ChatReadOnlyPolicy` bloque les demandes de mutation avant tout appel provider.
- `ChatAnswerGrounding` ajoute des références produit citées par le chat.
- `GET /api/chat/readiness` expose provider, modèle, état lecture seule et quota disponible.
- Les conversations peuvent être archivées sans supprimer l'historique.
- `validate:chat-billing` vérifie les écrans et APIs chat/billing ; l'envoi de message est exécuté seulement avec `CHAT_PROVIDER=fake` ou `LIVE_CHAT_TESTS=1`.

### Billing gelé

- `UsageMeter` agrège chat IA et catégorisation IA dans le même quota mensuel.
- `EntitlementGate` applique aussi la limite par minute des tiers.
- `GET /api/billing/status` expose subscription, usage, entitlements, readiness Stripe et derniers webhooks.
- Le webhook Stripe peut résoudre le tier depuis le `price.id` configuré, pas seulement depuis les metadata.

### Critère de sortie

- Les pages `Chat` et `Abonnement` expliquent clairement le mode local/stub.
- Les erreurs quota/rate-limit restent des erreurs produit lisibles.
- Les tests unitaires couvrent le blocage lecture seule et les limites d'usage.
- `npm run validate:chat-billing` devient le smoke test dédié avant Phase 10.

## Phase 10 — Notifications, audit, RGPD et multi-exercice — implémentée beta locale

Objectif : couvrir les écrans avancés du prototype et les exigences transverses.

Cette phase reprend "Polish + beta" et les ajouts v3 du cadrage.

### Notifications

- Liste des notifications.
- Marquer une notification comme lue.
- Tout marquer comme lu.
- Masquer une notification.
- Alertes TVA.
- Échéances fiscales.
- Transactions à vérifier.
- Import terminé.
- Fraîcheur réglementaire.
- `NotificationCenter` déduplique et persiste l'état lu/masqué.
- UI `/notifications` et APIs read/read-all/dismiss.

### Journal d'activité

- `GET /api/activity-log`.
- Filtres par type : import, categorization, clôture, document, profil.
- Export CSV.
- `AuditExportCenter` expose couverture et export JSON d'audit.

### Multi-exercice

- Liste des exercices.
- Création d'un nouvel exercice.
- Activation d'un exercice.
- Compteurs par exercice : transactions, écritures, documents.
- Exercice actif via cookie/query `qitus_fiscal_year_id`.

### RGPD

- Export complet des données utilisateur.
- Soft delete.
- Anonymisation après délai.
- Suppression définitive.
- Nettoyage des dossiers temporaires.
- `PrivacyCenter` protège la purge définitive.
- `DataExportCenter` produit un export JSON complet local.

## Phase 10.5 — Gel beta et préparation couverture expert-comptable — implémentée locale

Objectif : rendre visible ce qui est couvert, partiel ou manquant avant les grandes phases de couverture EC complète.

- `AccountingCoverageCenter` agrège transactions, écritures, justificatifs, TVA, documents, FEC, liasse, rapprochements, clôture, revue EC et audit/RGPD.
- `EvidenceRequirementCenter` détecte les écritures import/OD sans pièce attendue, sans livrer encore l'upload/OCR.
- UI `/couverture` et `/couverture/:areaCode`.
- APIs `/api/accounting-coverage`, `/api/accounting-coverage/:areaCode`, `/api/evidence-requirements`, `/api/evidence-requirements/missing`.
- Dashboard enrichi avec le score de couverture EC.
- Notifications sur couverture EC partielle, justificatifs manquants et TVA partielle.
- Paquet de preuve enrichi avec `coverage-summary`.

Cette phase ne certifie pas le dossier : elle donne une lecture produit exploitable pour prioriser les Phases 11 à 15.

## Phase 11 — Justificatifs et pièces comptables — implémentée locale

Objectif : transformer les écritures en dossier probant attaché aux pièces.

- `AttachmentCenter` gère upload, liste, détail, téléchargement et archivage des pièces.
- `EvidenceStorageAdapter` livre le stockage local `storage/evidence` et prépare le stockage objet sans l'activer.
- `AttachmentExtractionCenter` tente une extraction locale non bloquante (`pdftotext`, `tesseract`, TXT) et permet la correction manuelle.
- `AttachmentLinkCenter` rattache une pièce à une transaction, une écriture, une OD ou l'exercice.
- `EvidenceRequirementCenter` marque les exigences satisfaites quand un `AttachmentLink` compatible existe.
- `EvidenceControlCenter` expose `écriture sans pièce`, `pièce sans écriture` et extraction OCR à revoir.
- UI `/pieces`, `/pieces/:id`, APIs attachments/links/evidence-review, intégration transaction, écritures, contrôle, couverture EC et bundle de preuve.

Factur-X et facture électronique complète restent Phase 15 ou post-beta.

## Phase 11.5 — Gel justificatifs probants locaux — implémentée locale

Objectif : rendre le parcours justificatifs exploitable de bout en bout avant la TVA complète.

- `EvidenceReviewWorkflow` expose une file guidée des exigences requises, recommandées et satisfaites.
- `/pieces/revue` permet d'uploader une pièce depuis une exigence précise et de la rattacher automatiquement au bon élément comptable.
- `AttachmentMatchingCenter` calcule les suggestions de rattachement par montant, date, fournisseur et type de preuve, sans rattachement automatique hors upload ciblé.
- `/pieces/:id` rattache maintenant une pièce via une exigence réelle plutôt que via des champs libres ambigus.
- `EvidenceAuditCenter` détecte liens cassés et fichiers locaux manquants.
- Le paquet de preuve JSON inclut les pièces en base64 quand elles sont disponibles, les liens, les hashes et le résumé des preuves manquantes.
- Fixtures légères `fixtures/evidence` pour factures OVH/Google, contrat client et décision utilisateur OD.
- Le dataset `closing_beta` charge quelques pièces déjà rattachées ; `qonto_mvp` reste sans pièce par défaut.

Cette phase ne livre pas Factur-X, OCR cloud, stockage objet ni workflow cabinet. Elle gèle la preuve locale : upload, extraction non bloquante, rattachement, couverture et bundle.

## Phase 12 — TVA complète déclarative — implémentée locale

Objectif : passer de la ventilation TVA dans les écritures à une couverture déclarative exploitable.

- `VatLedgerPolicy` ventile les achats/ventes domestiques en HT/TVA/TTC, conserve la franchise sans ligne TVA, et couvre intracom/autoliquidation, exonéré et hors champ.
- Les catégorisations, règles et vendor mappings portent maintenant le taux et la nature TVA.
- `VatPositionCenter` agrège la position par période, taux, nature et comptes `44566`, `44571`, `4452`, `44551`, `44567`.
- `VatControlCenter` expose les contrôles TVA : taux/nature manquants, déclaration absente ou obsolète, soldes TVA ouverts.
- `VatDeclarationCenter` génère des brouillons locaux CA3/CA12 en `.md`, stockés comme `TVA_DECLARATION`.
- `/tva`, `/tva/:declarationId` et les APIs `/api/vat/*` rendent la position, les contrôles, les brouillons et le téléchargement.
- Couverture EC, notifications, clôture `VAT_REVIEW`, liasse et bundle de preuve consomment ces Modules sans recalcul parallèle.
- Les régularisations TVA restent une prévisualisation : aucune écriture de paiement TVA automatique en Phase 12.

## Phase 12.5 — Gel TVA déclarative et parcours régime réel — implémentée locale

Objectif : rendre le parcours TVA régime réel reproductible et vérifiable avant les rapprochements de Phase 13.

- `VatRatePolicy` centralise les taux, natures, libellés et compatibilités TVA.
- `VatReviewWorkflow` expose `/tva/revue` et des issue keys stables pour taux manquant, nature manquante et déclaration obsolète.
- Les corrections TVA passent par `TransactionCorrectionFlow`, qui reconstruit les lignes de l'écriture existante pour éviter un journal décalé.
- `VatDeclarationCenter` garantit un seul brouillon actif par type/période et supersède les brouillons remplacés.
- `VatDeclarationFreshnessCenter` marque les déclarations TVA actives, obsolètes ou superseded.
- Le paquet de preuve inclut désormais la position TVA, les déclarations et leur fraîcheur.
- `npm run validate:vat` charge `regime_reel_tva`, génère/régénère une CA12, vérifie le téléchargement et restaure `qonto_mvp`.

## Phase 13 — Rapprochements réels — implémentée locale

Objectif : remplacer les alertes déclaratives par des rapprochements ligne à ligne.

- `ReconciliationRun`, `ReconciliationMatch` et `ReconciliationIssue` portent le socle commun de rapprochement.
- `BankLineReconciliationCenter` rapproche Transactions bancaires et lignes `5121`, tout en conservant le contrôle de solde `BankReconciliation`.
- `StripeReconciliationCenter` importe la fixture Stripe, rapproche payouts et banque, et remonte frais/refunds/litiges comme points à revoir.
- `ThirdPartyMatchingCenter` lettré les comptes `401`, `411`, `467`.
- `SuspenseAccountCenter` contrôle les comptes `471`, `467`, `511`, `580`.
- `ConnectorSyncCenter` prépare Qonto/Stripe live derrière `CONNECTORS_MODE=disabled|fixture|live`, sans stocker de secrets.
- `/rapprochements` et ses sous-écrans alimentent contrôle, clôture, couverture EC, notifications et paquet de preuve.
- Phase 14 réutilisera les `ReconciliationIssue` pour proposer des OD d'écart validables.

## Phase 13.5 — Gel rapprochements auditables et frais — implémentée locale

Objectif : stabiliser le parcours de rapprochement avant les OD généralisées.

- `ReconciliationFreshnessCenter` calcule `À jour`, `À relancer` ou `Jamais lancé` sans nouveau statut persistant.
- `ReconciliationReviewWorkflow` porte la revue guidée : résoudre, ignorer avec note, réouvrir.
- `ReconciliationReportCenter` produit un rapport JSON probant inclus dans le paquet de preuve.
- `ConnectorSyncCenter` expose un `ConnectorStatus` non secret pour expliquer `disabled`, `fixture` ou `live`.
- `/rapprochements/revue`, `/api/reconciliations/freshness`, `/api/reconciliations/report` et `/api/connectors/status` stabilisent les interfaces publiques.
- Les rapprochements peuvent bloquer la clôture, mais ne bloquent pas la génération documentaire MVP.
- Phase 14 consommera les issues résolues ou ouvertes pour proposer des OD d'écart validables.

## Phase 14 — Clôture généralisée — implémentée locale

Objectif : couvrir les cas de clôture attendus par un cabinet comptable, au-delà des fixtures MVP.

- `ClosingWorkpaperCenter` porte les hypothèses utilisateur, notes, source éventuelle et attente de pièce.
- `ClosingAdjustmentCenter` reste la seule Interface qui transforme une proposition validée en vraie écriture `OD`.
- Calculateurs déterministes livrés : FNP, FAE, PCA, variation de stock, provisions/reprises, intérêts courus, paie à payer, TVA à régulariser et écarts de rapprochement.
- `/cloture/od` devient le cockpit des OD généralisées : brouillons, prêts, validés, rejetés, pièces requises.
- `/cloture/workpapers/:kind` permet de créer des workpapers par domaine.
- APIs : `/api/closing-workpapers`, `/api/closing-adjustments/generate`, `/api/closing-adjustments/readiness`.
- `closing_beta` charge des workpapers de stock, emprunt, provision, paie, FNP/FAE/PCA pour les validations locales.
- Couverture EC, notifications, clôture et paquet de preuve consomment les workpapers et propositions sans recalcul parallèle.
- ADR 0008 verrouille la règle : workpaper = hypothèses, proposition = calcul/lignes, validation utilisateur = écriture.

Cette phase reste locale/beta : pas de télétransmission, pas d'OD automatique et pas de certification fiscale.

## Phase 14.5 — Gel OD généralisées auditables et fraîches — implémentée locale

Objectif : stabiliser les OD généralisées avant le dossier expert-comptable complet.

- `ClosingWorkpaperWorkflow` porte la revue guidée des workpapers : brouillon, prêt, archivé, proposition attendue et pièce manquante.
- `ClosingAdjustmentReviewWorkflow` devient l'Interface de validation : rejet avec note obligatoire, réouverture d'un rejet, validation idempotente et blocage si pièce requise absente.
- `ClosingAdjustmentFreshnessCenter` calcule les OD `À jour` ou `À recalculer` après modification de workpaper, pièce, import, correction, écriture, OD validée, TVA, rapprochement ou profil fiscal.
- `/cloture/od` affiche les onglets `Workpapers`, `OD à relire`, `Validées`, `Rejetées`, `Pièces manquantes` et l'action `Recalculer les obsolètes`.
- `/controle/od/:proposalKey` affiche fraîcheur, preuves liées, raisons d'obsolescence, note de rejet et réouverture.
- Le paquet de preuve inclut workpapers, OD, fraîcheur, pièces liées et rejets motivés.
- Les notifications et la couverture EC signalent OD obsolètes, pièces requises et rejets motivés.
- Validation locale ajoutée : `npm run validate:closing-end-user`.

Phase 15 portera le dossier EC collaboratif complet ; elle ne doit pas réintroduire de nouveaux calculateurs OD majeurs sans workpaper et validation utilisateur.

## Phase 15 — Dossier expert-comptable complet

Objectif : livrer un dossier de révision complet, relisible et collaboratif.

- `ExpertDossierCenter` agrège FEC, journal audit, liasse, états financiers, TVA, justificatifs, rapprochements, workpapers, OD, clôture, activité et revue EC en sections prêtes/partielles/bloquées.
- `FecPrecheckCenter` précontrôle présence, fraîcheur, format, équilibre journal, cohérence du nombre d'écritures et comptes TVA.
- `TaxPackageCompletionCenter` exige une source structurée de liasse fraîche ; le PDF reste dérivé et optionnel.
- `DossierSnapshotCenter` fige le manifest transmis et calcule son obsolescence après import, correction, OD, pièce, rapprochement, TVA, document, workpaper ou réouverture.
- `ExpertReviewWorkflow` ajoute les demandes, commentaires, réponses, résolutions, réouvertures et validation finale expert-comptable.
- `ExpertDossierExportCenter` produit le dossier cabinet JSON : FEC, liasse, états, TVA, pièces, rapprochements, workpapers, OD, audit, couverture, commentaires et validation.
- `/dossier-ec`, `/dossier-ec/revue` et `/shared/:token` deviennent les surfaces produit du dossier collaboratif.
- ADR 0009 verrouille la règle : l'expert commente et valide, mais ne modifie jamais la comptabilité.

Cette phase ne livre pas de télétransmission, pas de signature électronique certifiée, pas de portail cabinet multi-client et pas de nouveaux calculateurs OD majeurs.

## Phase 15.5 — Gel dossier EC collaboratif exportable et vérifié

Objectif : stabiliser le dossier EC avant infrastructure/beta.

- `ExpertDossierReadinessWorkflow` centralise les blocages avant partage et export : FEC, liasse, pièces, rapprochements, OD, clôture, snapshot et revue EC.
- `DossierSnapshotReviewCenter` liste les snapshots, détaille leur fraîcheur et compare l'état transmis à l'état courant.
- `ExpertReviewPortalProjection` devient la projection read-only de `/shared/:token`; seules demandes, commentaires et signoff restent autorisés côté expert.
- `ExpertReviewQueue` porte la file de demandes cabinet : réponse utilisateur, résolution avec note, waiver avec note et blocage du signoff si demande bloquante ouverte.
- `ExpertDossierExportVerifier` vérifie le manifest exporté et ajoute `exportVerification` au dossier cabinet JSON.
- `/dossier-ec` affiche readiness queue, snapshot, vérification export et actions recommandées.
- `/dossier-ec/snapshots`, `/api/expert-dossier/readiness`, `/api/expert-dossier/export/verify` et `/api/expert-review/queue` stabilisent les surfaces de gel.
- Validation locale ajoutée : `npm run validate:dossier-ec-end-user`.

Cette phase ne change pas le modèle Prisma. Elle ne crée pas de mutation comptable côté expert, pas de signature certifiée et pas de télétransmission.

## Phase 16 — Infrastructure, monitoring et beta

Objectif : rendre le service exploitable en production.

État Phase 16 : **implémentée en socle beta production-shaped**.

- `DeploymentRuntimeCenter` durcit `RuntimeConfig` avec `APP_ENV`, `PUBLIC_APP_URL`, `SESSION_SECRET`, stockage objet, observabilité, cron et Open Banking provider.
- `HealthCheckCenter` expose `/healthz`, `/readyz` et `/api/system/status` avec secrets masqués.
- `MonitoringCenter`, `MetricsCenter` et `CronTaskCenter` ajoutent métriques locales, capture d'erreurs locale et tâches cron beta.
- `DocumentStorageAdapter` et `EvidenceStorageAdapter` ont un Adapter S3-compatible activable par `OBJECT_STORAGE_MODE=s3`.
- `OpenBankingCenter`, `OpenBankingProviderAdapter`, `BankFeedNormalizer` et les modèles `BankConnection`, `BankFeedAccount`, `BankFeedSyncEvent` livrent le flux provider read-only mock/live-shaped.
- `/connecteurs` centralise Open Banking, connecteurs Qonto/Stripe existants, readiness et stockage.
- `npm run validate:production-config`, `npm run validate:open-banking` et `npm run worker:all` complètent les validations.

### Open Banking provider

Objectif : sortir du CSV-first pur sans devenir nous-mêmes fournisseur DSP2.

Décision : Qitus intégrera l'Open Banking via un **provider agréé** ou opérant comme AISP, par exemple Bridge, Powens, GoCardless Bank Account Data, Tink, Yapily ou équivalent. Qitus ne fera pas d'intégration PSD2 directe banque par banque avant maturité production.

Architecture attendue :

- Créer un `OpenBankingProviderAdapter` derrière `ConnectorSyncCenter`.
- Normaliser les comptes, soldes, transactions et statuts de consentement dans un Module `BankFeedNormalizer`.
- Réinjecter les mouvements dans `ImportOrchestrator` plutôt que créer un pipeline parallèle.
- Alimenter `BankLineReconciliationCenter`, `ReconciliationFreshnessCenter`, `NotificationCenter` et `ActivityLogCenter`.
- Ne jamais stocker de secrets bancaires utilisateur hors du coffre/stockage chiffré prévu.
- Journaliser les consentements, expirations, erreurs de synchro et reconnexions sans exposer de données sensibles.

Périmètre Phase 16 :

- lecture seule comptes, soldes et transactions ;
- consentement utilisateur ;
- reconnexion/expiration du consentement ;
- import incrémental idempotent ;
- déduplication avec les imports CSV existants ;
- message produit lisible en cas d'échec banque/provider ;
- métriques de synchronisation bancaire.

Hors scope Phase 16 :

- devenir AISP directement ;
- EBICS natif maison ;
- EBICS paiement ;
- initiation de paiement ;
- télétransmission fiscale.

EBICS reste une extension ultérieure, prioritairement en **lecture seule relevés** via provider ou service spécialisé, pas comme implémentation protocolaire maison.

### Services prévus

- `qitus-web` : app Remix/API.
- `qitus-worker` : jobs BullMQ.
- PostgreSQL managé.
- Redis managé.
- Stockage objet Scaleway.
- Provider Open Banking configuré par environnement.

### Cron jobs

- Vérification quotidienne de la fraîcheur réglementaire avec `update_data.py`.
- Reset mensuel des compteurs IA.
- Nettoyage horaire des workdirs temporaires.
- Vérification quotidienne des échéances fiscales.

### Monitoring

- Durée des imports.
- Durée des synchronisations Open Banking.
- Taux de succès des connexions bancaires.
- Nombre de consentements expirés.
- Nombre de transactions bancaires synchronisées.
- Hit rate catégorisation déterministe.
- Coût IA.
- Tokens IA si provider mesurable.
- Durée des scripts Qitus.
- Erreurs des scripts Qitus.
- Nombre de documents générés par type.
- Messages de chat.
- Clôtures actives.

### Métriques spécifiques à l'optimisation IA

- `qitus_lookup_hits_total`.
- `qitus_lookup_misses_total`.
- `qitus_lookup_hit_rate`.
- `qitus_ai_calls_saved_total`.
- `qitus_ai_cost_saved_cents`.
- `qitus_vendor_mappings_total`.
- `qitus_correction_rules_created_total`.

Une alerte doit être déclenchée si le hit rate déterministe descend sous 60 %.

## Phase 16.5 — Gel infrastructure beta vérifiable

Objectif : stabiliser le socle Phase 16 avant les extensions post-beta, avec readiness beta visible dans Qitus.

- `BetaReadinessCenter` agrège runtime, DB/Redis/storage, migrations, workers/cron, Open Banking, webhooks, secrets masqués et validations clés.
- `OpenBankingSyncWorkflow` rend lisibles le détail connexion, l'historique de sync, la sync par connexion et la reconnexion mock.
- `OpenBankingFreshnessCenter` calcule consentement expiré, sync jamais lancée, sync obsolète après import/correction/rapprochement, ou sync fraîche.
- `OpenBankingWebhookReceiver` traite `/webhooks/open-banking` avec signature provider et idempotence via `WebhookEvent`.
- `StorageAuditCenter` audite documents et pièces en stockage local/S3, en signalant les artefacts manquants sans `Application Error`.
- `WorkerRuntimeCenter` et `MetricCatalog` exposent le statut worker/cron et les métriques beta stables.
- `/connecteurs` devient la surface produit de readiness beta : Open Banking, fraîcheur, audit stockage, checks beta et historique sync.
- Nouvelles validations : `npm run validate:beta-infra` et `npm run validate:open-banking-end-user`.

Cette phase ne choisit pas encore un provider bancaire live. Le mock Open Banking reste la preuve automatisée. Après readiness beta verte, la Phase 17 peut démarrer sur les extensions métier sans rouvrir les Seams d'infrastructure.

## Phase 17 — Mise à jour automatique des règles comptables officielles

Objectif : automatiser la veille et l'activation des règles comptables Qitus à partir de sources officielles, sans action demandée à l'utilisateur final.

- `RegulatorySourceAdapter` isole les sources BOFiP RSS, ANC/PCG et impots.gouv documentation derrière un Seam d'Adapters.
- `RegulatorySourceCenter` stocke des `RegulatorySourceSnapshot` et `RegulatoryChange` traçables par checksum, sans créer directement d'écriture ni de mapping.
- `AccountingRulePackCenter` construit, active et archive des `AccountingRulePack` versionnés ; le pack actif alimente les futurs imports.
- `RuleImpactPreviewCenter` et `RuleApplicationWorkflow` signalent les impacts sur les données existantes sans mutation silencieuse.
- `ChangeImpactCenter` remonte les règles mises à jour, les imports à relancer, et les documents/FEC/dossier EC potentiellement obsolètes.
- `/regles-comptables` reste une surface dev/admin de transparence : sources consultées, dernière synchronisation, pack actif et packs en revue interne.
- Nouveau script : `npm run validate:accounting-rules-auto-update`.

Décisions :

- Les écritures existantes ne sont jamais modifiées automatiquement.
- Les `CorrectionRule` utilisateur restent prioritaires.
- Les changements BOFiP ou impots.gouv textuels ambigus restent en revue interne Qitus (`NEEDS_REVIEW`), invisibles comme tâche utilisateur.
- Les futurs imports utilisent automatiquement le pack actif.

## Phase 18 — Facture Électronique Entrante Et Exploitation Comptable

Objectif : préparer Qitus à la facture électronique sans devenir un outil de facturation complet.

Décision verrouillée :

- Qitus traite d'abord la **réception/exploitation comptable** des factures fournisseurs.
- P0 : upload local et parsing structuré Factur-X / UBL / CII.
- P1 : réception automatisée via un **Seam PA-neutral** branchable plus tard sur une Plateforme Agréée.
- P1.5 : connexion PA conforme via Adapter concret ; Qitus ne devient pas PA, il conserve les preuves PA et exploite les factures reçues.
- Aucune émission de facture, numérotation client, paiement, e-reporting ou télétransmission dans cette phase.
- Les écritures existantes ne sont jamais modifiées automatiquement.

### 1. Socle Facture Électronique

Créer un domaine profond `e-invoices`.

Modules principaux :

- `EInvoiceCenter`
- `StructuredInvoiceParserCenter`
- `EInvoiceMatchingCenter`
- `EInvoiceAccountingDraftCenter`
- `EInvoiceProviderCenter`
- `EInvoiceSyncWorkflow`

Formats supportés en P0 :

- Factur-X PDF avec XML embarqué.
- UBL XML.
- CII XML.
- PDF/image classique : reste traité comme pièce OCR légère, sans statut facture électronique structurée.

Ajouter un modèle `EInvoice` :

- company, fiscal year, attachment liée, source upload/provider.
- format, statut, checksum, sourceId.
- fournisseur, SIRET si présent, numéro facture, dates, devise.
- montants HT, TVA, TTC, ventilation TVA JSON, lignes JSON.
- raw XML storage key si disponible.
- erreur lisible si parsing impossible.

Ajouter `EInvoiceAccountingDraft` :

- facture liée.
- statut `DRAFT`, `READY`, `APPROVED`, `REJECTED`, `SUPERSEDED`.
- lignes comptables proposées.
- justification, matching, note utilisateur.
- approbation seule crée l'écriture.

Ajouter `JournalEntry.source = E_INVOICE`.

### 2. Parsing Et Stockage

Étendre `AttachmentCenter` :

- accepter XML en plus de PDF, PNG, JPG, TXT.
- détecter automatiquement si la pièce est une facture électronique structurée.
- stocker l'original comme pièce probante.
- créer ou mettre à jour `EInvoice` via `EInvoiceCenter`.

`StructuredInvoiceParserCenter` :

- détecte le format.
- extrait un payload canonique.
- calcule checksum et dédoublonne.
- retourne une erreur métier lisible si le format est invalide.
- ne fait aucune écriture comptable.

Adapters :

- `FacturXParserAdapter`
- `UblInvoiceParserAdapter`
- `CiiInvoiceParserAdapter`

### 3. Matching Comptable

`EInvoiceMatchingCenter` propose des rapprochements vers :

- transactions bancaires existantes ;
- écritures existantes ;
- exigences de preuve ;
- fournisseur ou mapping existant.

Critères :

- montant TTC exact ou proche ;
- date facture / date transaction ;
- fournisseur, libellé, SIRET, numéro facture ;
- devise ;
- taux et ventilation TVA.

Aucun rattachement automatique sauf si l'utilisateur valide explicitement depuis la revue.

### 4. Brouillons Comptables

`EInvoiceAccountingDraftCenter` produit des propositions déterministes.

Cas principal facture fournisseur non payée :

- débit charge ou immobilisation HT ;
- débit TVA déductible si applicable ;
- crédit fournisseur `401` TTC.

Cas facture déjà payée par banque :

- propose le lien facture ↔ transaction ;
- signale si l'écriture bancaire existante doit être revue ;
- ne réécrit pas automatiquement l'écriture `IMPORT`.

Cas TVA :

- réutiliser les politiques TVA existantes.
- accepter ventilation multi-taux.
- signaler les incohérences plutôt que forcer un compte.

Validation :

- l'utilisateur relit puis approuve.
- seule l'approbation crée une écriture `E_INVOICE`.
- rejet avec note auditable.

### 5. Provider PA-Neutral

Créer `EInvoiceProviderAdapter`.

Interface cible :

- `getStatus()`
- `createConnection(workspace, input)`
- `completeCallback(request)`
- `listIncomingInvoices(workspace)`
- `downloadInvoicePayload(workspace, providerInvoiceId)`
- `syncIncomingInvoices(workspace)`
- `disconnect(workspace)`
- `verifyWebhook(request)`

Adapters :

- `MockEInvoiceProviderAdapter` pour validation automatisée.
- `AccreditedPlatformSandboxAdapter` pour tester doublon, rejet, annulation, XML invalide, webhook hors ordre et pièce visuelle manquante.
- `GenericAccreditedPlatformAdapter` pour figer le contrat PA et refuser proprement tant qu'aucune PA réelle n'est branchée.
- `EInvoiceProviderContractTestKit` pour valider tout Adapter PA concret avant activation.
- PA concrète à brancher ensuite sans changer le pipeline.

Sécurité :

- secrets provider dans `ProviderCredentialVault`, jamais dans Prisma.
- webhooks idempotents via `WebhookEvent`.
- statut de mandat, statut provider facture, preuve PA et audit de réception conservés.
- sync interdite sur exercice fermé.
- aucune facture fournisseur ne crée d'écriture sans validation utilisateur.

### 6. UI Et APIs

Ajouter `/factures-entrantes`.

Vue liste :

- statut parsing ;
- fournisseur ;
- numéro facture ;
- date ;
- HT / TVA / TTC ;
- matching ;
- brouillon comptable ;
- action recommandée.

Vue détail `/factures-entrantes/:id` :

- pièce source ;
- données extraites ;
- ventilation TVA ;
- suggestions de rapprochement ;
- brouillon comptable ;
- actions : rattacher, créer brouillon, approuver, rejeter, archiver.

Intégrations UI :

- `/pieces` affiche si une pièce est une facture électronique reconnue.
- `/transactions/:id` affiche les factures liées.
- `/ecritures` indique les écritures issues de facture électronique.
- `/couverture/evidence` considère une facture électronique liée comme preuve forte.
- `/tva` consomme les données TVA structurées approuvées.
- `/documents` et bundle incluent les manifestes facture électronique.

APIs :

- `GET /api/e-invoices`
- `POST /api/e-invoices`
- `GET /api/e-invoices/:id`
- `POST /api/e-invoices/:id/reparse`
- `POST /api/e-invoices/:id/match`
- `POST /api/e-invoices/:id/accounting-draft`
- `POST /api/e-invoices/:id/approve-accounting`
- `POST /api/e-invoices/:id/reject-accounting`
- `GET /api/e-invoice-providers/status`
- `POST /api/e-invoice-providers/connect`
- `POST /api/e-invoice-providers/sync`
- `POST /webhooks/e-invoice-provider`

### 7. Impacts, Notifications Et Bundle

`ChangeImpactCenter` signale :

- facture structurée reçue mais non comptabilisée ;
- facture matchée à une transaction déjà écrite qui mérite revue ;
- TVA potentiellement à recalculer ;
- FEC, documents ou dossier EC obsolètes après approbation.

`NotificationCenter` ajoute :

- facture électronique à traiter ;
- parsing échoué ;
- brouillon comptable prêt ;
- facture non rapprochée ;
- sync provider échouée.

`DocumentEvidenceBundle` inclut :

- `e-invoices-manifest.json`
- XML source si disponible ;
- pièce originale ;
- matching ;
- statut du brouillon comptable ;
- écriture créée après approbation.

Activity log :

- `e_invoice.received`
- `e_invoice.parsed`
- `e_invoice.parse_failed`
- `e_invoice.matched`
- `e_invoice.accounting_draft_created`
- `e_invoice.accounting_approved`
- `e_invoice.accounting_rejected`
- `e_invoice_provider.synced`

### Test Plan

Unit :

- parser UBL, CII et Factur-X minimal.
- refuser XML invalide avec erreur lisible.
- dédoublonner par checksum et source provider.
- matcher facture ↔ transaction par montant/date/fournisseur.
- produire un brouillon équilibré HT/TVA/TTC.
- bloquer l'approbation si exercice fermé.
- vérifier qu'aucune écriture existante n'est modifiée automatiquement.
- sync provider mock idempotente.

Integration :

- upload XML → `EInvoice PARSED`.
- upload Factur-X PDF → XML extrait et stocké.
- facture fournisseur → brouillon `401 / charge / TVA`.
- approbation → écriture `E_INVOICE` visible dans `/ecritures`.
- facture liée à transaction bancaire existante → impact de revue, pas de réécriture silencieuse.
- provider mock sync → factures créées, deuxième sync sans doublon.
- bundle preuve contient manifeste + XML + pièce originale.

End-user :

- ouvrir `/pieces`.
- uploader une facture électronique.
- ouvrir `/factures-entrantes`.
- vérifier les données extraites.
- rapprocher avec une transaction.
- générer le brouillon comptable.
- approuver.
- vérifier `/ecritures`, `/tva`, `/couverture/evidence`, `/documents`.

Validation :

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run demo:reset`
- `npm run validate:mvp`
- `npm run validate:end-user`
- `npm run validate:vat`
- ajouter `npm run validate:e-invoices`
- ajouter `npm run validate:e-invoice-provider-mock`
- ajouter `npm run validate:e-invoice-pa-sandbox`
- ajouter `npm run validate:e-invoice-provider-contract`

### Assumptions

- P0 local n'est pas une conformité complète de réception légale via PA.
- P1 prépare le branchement PA, mais ne choisit pas encore un provider final.
- Les factures entrantes sont prioritaires ; factures sortantes hors scope.
- Qitus ne devient pas outil de facturation.
- Toute mutation comptable reste validée par l'utilisateur.
- Les sources structurées sont conservées comme preuve.
- Les pièces non structurées restent utilisables via le parcours justificatifs existant.

## Phase 19 — Extensions métier après beta

Objectif : exploiter les autres capacités du repo Qitus.

### Extensions prévues dans le cadrage

- Audit commissaire aux comptes.
- Simulation de contrôle fiscal.
- Upload de justificatifs Qonto.
- Import avancé des factures Stripe.
- Multi-company réel par utilisateur.
- Domaine notaire.
- Domaine syndic.
- Autres skills Qitus spécialisés.

Ces sujets ne sont pas nécessaires pour prouver la boucle MVP, mais ils sont importants pour élargir le produit.

## Backlog API complet du cadrage

Cette section garde la trace des routes prévues dans le cadrage v3, y compris celles hors MVP immédiat.

### Webhooks

- `POST /webhooks/clerk`
- `POST /webhooks/stripe`

### Company et onboarding

- `POST /api/companies`
- `GET /api/companies/:id`
- `PATCH /api/companies/:id`
- `DELETE /api/companies/:id`
- `GET /api/siren/:siren`

### Subscription

- `GET /api/subscription`
- `POST /api/subscription/checkout`
- `POST /api/subscription/portal`

### Integrations

- `GET /api/integrations`
- `POST /api/integrations`
- `PATCH /api/integrations/:id`
- `DELETE /api/integrations/:id`
- `POST /api/integrations/:id/test`
- `POST /api/integrations/:id/fetch`

### Imports

- `POST /api/imports`
- `GET /api/imports`
- `GET /api/imports/:id`
- `GET /api/imports/:id/status`
- `GET /api/imports/:id/detected-columns`
- `POST /api/imports/:id/column-mapping`
- `POST /api/imports/:id/retry`
- `POST /api/imports/:id/retry-categorization`

### Transactions

- `GET /api/transactions`
- `GET /api/transactions/:id`
- `PATCH /api/transactions/:id/categorize`

### Journal et dashboard

- `GET /api/journal-entries`
- `GET /api/journal-entries/export`
- `GET /api/dashboard/kpis`
- `GET /api/dashboard/alerts`

### Documents

- `GET /api/documents`
- `POST /api/documents/:type/generate`
- `GET /api/documents/:id/download`

### Clôture

- `GET /api/cloture`
- `POST /api/cloture/start`
- `GET /api/cloture/steps/:step`
- `POST /api/cloture/steps/:step`

### Immobilisations

- `GET /api/immobilisations`
- `POST /api/immobilisations`
- `PATCH /api/immobilisations/:id`
- `DELETE /api/immobilisations/:id`

### Chat

- `POST /api/chat/message`
- `GET /api/chat/history`

### Correction rules

- `GET /api/corrections`
- `DELETE /api/corrections/:id`

### Notifications

- `GET /api/notifications`
- `PATCH /api/notifications/read-all`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/:id/dismiss`

### Journal d'activité

- `GET /api/activity-log`
- `GET /api/activity-log/export`

### Exercices comptables

- `GET /api/fiscal-years`
- `POST /api/fiscal-years`
- `PATCH /api/fiscal-years/:id/activate`

### Portabilité RGPD

- `GET /api/exports/all`

## Points de décision restants

1. Garder le runtime documentaire en submodule Git ou en clone/fork copié dans `vendor/paperasse`.
3. Choisir SSE ou polling pour les statuts d'import.
4. Choisir Scaleway Object Storage ou autre stockage objet compatible S3.
5. Choisir le premier provider Open Banking live à intégrer après le gel Phase 16.5.
6. Décider quand activer le multi-company réel.

## Décisions tranchées

### Facture électronique

Décision : Qitus traite la **réception/exploitation comptable** des factures électroniques entrantes, sans devenir outil de facturation.

Conséquences :

- Upload local Factur-X / UBL / CII pour parser les factures fournisseurs.
- Réception automatisée derrière un `EInvoiceProviderAdapter` PA-neutral.
- Les factures créent des brouillons comptables relisibles, jamais des écritures silencieuses.
- L’approbation utilisateur seule crée une écriture `E_INVOICE`.
- Émission, numérotation, paiement, e-reporting et télétransmission restent hors scope.

### Scripts Qitus

Décision : pour la Phase 8.5, les scripts Qitus restent **CLI-only**.

Conséquences :

- Le SaaS prépare un workdir compatible Qitus.
- Les scripts sont appelés avec `execFile`.
- Les détails d'exécution restent confinés dans centre d’exécution documentaire et les renderers dédiés.
- Aucun refactor upstream n'est requis pour rendre les scripts importables avant beta.
- Un éventuel refactor importable est repoussé après stabilisation produit, plutôt Phase 11/12.

Raison : les scripts actuels lisent des fichiers et templates depuis un repo structuré. Le pattern workdir est déjà en place et plus sûr pour livrer la couverture comptable beta rapidement.

### Open Banking

Décision : l'accès bancaire live passera d'abord par un **provider Open Banking**. Qitus ne s'enregistrera pas comme AISP et n'implémentera pas les API DSP2 banque par banque avant la beta.

Conséquences :

- L'Open Banking est un Adapter de collecte, pas une nouvelle logique métier.
- `ConnectorSyncCenter` orchestre la synchronisation.
- `BankFeedNormalizer` transforme les flux provider en mouvements bancaires canoniques.
- `ImportOrchestrator` reste le point d'entrée unique vers transactions, catégorisation et écritures.
- EBICS est reporté après beta et limité en priorité aux relevés read-only, pas aux paiements.

### PDF et Puppeteer

Décision : le PDF est supporté comme **rendu dérivé optionnel**, pas comme source métier obligatoire.

Conséquences :

- La liasse fiscale doit d'abord exister comme source structurée HTML/Markdown avec cases, montants et références de calcul.
- `generate-pdfs.js` peut être appelé via CLI si Puppeteer/Chromium est disponible.
- Si Puppeteer échoue ou n'est pas disponible, la génération ne bloque pas la Phase 8.5 : le fallback structuré reste téléchargeable et inclus dans le paquet de preuve.
- En production, le support PDF dépendra d'une image worker compatible Chromium.

Raison : le PDF augmente fortement la crédibilité expert-comptable, mais la valeur métier tient d'abord à la structure fiscale, aux montants traçables et à l'audit de génération.

## Règle de développement à conserver

Avant d'ajouter un appel IA, poser la question :

> Est-ce que cette opération peut être exprimée comme une formule, une condition, une agrégation SQL, ou un lookup dans une table ?

Si oui : code déterministe.  
Si non : IA.

Cette règle protège la marge, la stabilité et la traçabilité comptable.
