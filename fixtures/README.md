# Fixtures — Paperasse SaaS MVP

## Structure

```
fixtures/
├── companies/                      # Contextes entreprise (équivalent company.json)
│   ├── sasu-consulting.json        # SASU prestation de services, franchise TVA
│   ├── sarl-commerce.json          # SARL commerce, TVA réel simplifié
│   └── ei-freelance.json           # EI micro-entreprise (cas limite)
│
├── bank-imports/                   # CSV bancaires bruts (formats réels par banque)
│   ├── qonto-export-2025.csv       # Format Qonto
│   ├── bnp-export-2025.csv         # Format BNP Paribas
│   ├── sg-export-2025.csv          # Format Société Générale
│   ├── boursorama-export-2025.csv  # Format Boursorama
│   └── stripe-transactions.json    # Transactions Stripe (format connecteur Paperasse)
│
├── normalized-transactions/        # Transactions après parsing/normalisation
│   └── normalized-2025-q1.json     # 26 transactions Q1 2025 normalisées
│
├── categorizations/                # Sorties attendues de la catégorisation
│   └── expected-categorizations.json   # 14 catégorisations attendues, avec résumé des cas ambigus
│
├── corrections/                    # Corrections utilisateur (apprentissage contextuel)
│   └── user-corrections.json       # Corrections post-catégorisation
│
├── journal-entries/                # Écritures comptables au format Paperasse
│   └── journal-entries-2025.json   # Extrait de 16 écritures au format Paperasse
│
├── cloture/                        # Données pour le workflow de clôture
│   └── cloture-context.json        # État consolidé : immobilisations, PCA/CCA, rapprochement, IS
│
├── chat-scenarios/                 # Scénarios de test pour le chat IA
│   └── chat-test-cases.json        # Questions + contexte + réponses attendues
│
└── expected-outputs/               # Sorties attendues (FEC, états financiers)
    ├── fec-sample.txt              # Extrait FEC 18 colonnes
    └── etats-financiers-summary.json # Résumé bilan/CR attendu
```

## Scénario de test principal

**Entreprise :** ACME Digital SASU — Consulting IT, 1 associé unique, franchise TVA (CA < 36 800 €), IS.
**Exercice :** 01/01/2025 – 31/12/2025
**Banque :** Qonto
**Paiements :** Stripe (SaaS)
**Volume :** ~250 transactions/an, ~20/mois
**Immobilisations :** 1 MacBook Pro, 1 licence logicielle
**Spécificités :** Compte courant d'associé (455), abonnements SaaS annuels (PCA)

## État actuel du jeu de fixtures

Ces fixtures sont exploitables pour cadrer et tester les premiers flux, mais elles ne constituent pas encore un golden dataset complet.

| Zone | État actuel | Usage recommandé |
|---|---:|---|
| Sociétés | 3 profils | Tests onboarding, export `company.json`, régimes fiscaux |
| CSV bancaires | 4 formats | Tests parsers Qonto, BNP, SG, Boursorama |
| Stripe | 8 charges, 1 refund, 3 payouts | Tests normalisation Stripe et rapprochement payout |
| Transactions normalisées | 26 transactions | Tests import Qonto et déduplication |
| Catégorisations attendues | 14 cas | Tests unitaires lookup/pattern/IA résiduelle |
| Corrections utilisateur | 3 corrections, 2 règles dérivées | Tests apprentissage contextuel |
| Écritures | 16 écritures | Tests `generate-fec.js`, `generate-statements.js` |
| Clôture | 1 contexte consolidé | Tests amortissements, CCA, rapprochement, IS |
| Chat | 10 scénarios | Tests réponses contextuelles |
| Outputs attendus | FEC sample + états indicatifs | Tests de format, pas encore tests comptables définitifs |

## Points à compléter avant automatisation stricte

- Étendre `normalized-2025-q1.json` ou renommer le scénario pour refléter le sous-ensemble actuel.
- Compléter `expected-categorizations.json` pour couvrir toutes les transactions normalisées, ou marquer explicitement les cas non couverts.
- Recalculer les agrégats de `ambiguous_cases_summary` une fois le périmètre final figé.
- Harmoniser les montants Stripe avec les payouts et le résumé de frais avant les tests financiers.
- Générer un journal annuel complet avant de traiter `etats-financiers-summary.json` comme une vérité comptable.
