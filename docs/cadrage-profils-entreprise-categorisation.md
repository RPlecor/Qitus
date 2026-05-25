# Cadrage — Profils Entreprise, Documents Fiscaux & Politique de Catégorisation

**Auteur :** CPO Advisory  
**Date :** 2026-05-25  
**Statut :** V1  
**Dépendances :** `cadrage-durcissement-produit.md` (V3), `gap-analysis-automatisation-categorisation.md` (V1)  
**Principe directeur :** politique simplifiée (4-rule blacklist + monitoring), adaptée par profil

---

## 1. Synthèse exécutive

Ce document définit trois choses pour Qitus :

1. **Quelles données collecter à l'onboarding** (inspiré d'Indy, adapté à la promesse Qitus)
2. **Quels documents fiscaux générer par profil** (liasse, FEC, bilan, compte de résultats — le format varie selon forme juridique × régime fiscal)
3. **Quelle politique d'auto-catégorisation appliquer par tier** (la matrice 4 tiers validée précédemment, avec les règles concrètes)

La décision clé : la forme juridique et le régime fiscal déterminent *tout* — les formulaires CERFA, l'obligation (ou non) de FEC, la profondeur comptable requise, et donc le niveau de prudence de l'auto-catégorisation.

---

## 2. Benchmark Indy — Données collectées à l'onboarding

### 2.1 Flow Indy observé (33 screenshots)

L'onboarding Indy collecte les données dans cet ordre :

| Étape | Donnée | Options observées |
|-------|--------|-------------------|
| 1 | Recherche entreprise | Saisie SIREN/SIRET → lookup registre du commerce |
| 2 | Forme juridique | EI (ou auto-entreprise), SASU/SAS, EURL/SARL, SCI, SCM, Indivision |
| 3 | Régime d'imposition | Conditionné par forme (voir §2.2) |
| 4 | Type d'activité | BNC / BIC / LMNP (conditionné par régime) |
| 5 | Profession spécifique | Dropdown métier (pour BNC surtout) |
| 6 | Nature des ventes | Services / Produits physiques / Les deux |
| 7 | Assujetti TVA | Oui / Non |
| 8 | Régime TVA | Franchise / CA12 (annuel) / CA3 trimestriel / CA3 mensuel |
| 9 | Date prochaine déclaration TVA | Date picker |
| 10 | Dates exercice comptable | Début + fin |
| 11 | Date création entreprise | Date picker |
| 12 | Connexion bancaire | Via Bridge API (10+ banques majeures listées) |

### 2.2 Matrice Indy : forme juridique → régime → liasse

| Forme juridique | Régimes proposés | Liasse associée (CERFA) |
|----------------|------------------|------------------------|
| **EI / Auto-entreprise** | IR ou IS, puis BNC / BIC / LMNP | BNC → 2035 ; BIC → 2031+2033 ; LMNP → 2031+2033 |
| **SASU / SAS** | IS (2033 & 2065) / BIC (2031) / BNC (2035) | IS → 2065+2033 ; BIC → 2031+2033 ; BNC → 2035 |
| **EURL / SARL** | IS (2033 & 2065) / BIC (2031) / BNC (2035) | IS → 2065+2033 ; BIC → 2031+2033 ; BNC → 2035 |
| **SCI** | IR (2072 & 2044) / IS (2033 & 2065) | IR → 2072+2044 ; IS → 2065+2033 |
| **SCM** | Pas de choix de régime (IR par nature) | 2036 (déclaration SCM) |
| **Indivision** | LMNP / Autre | LMNP → 2031+2033 |

### 2.3 Ce qu'Indy ne collecte PAS (et que Qitus pourrait)

- **Chiffre d'affaires estimé / fourchette** — utile pour calibrer le tier de prudence
- **Présence d'un EC** — donnée cruciale pour le tier 4 Qitus
- **Secteur d'activité détaillé** — Indy collecte la profession (BNC) mais pas un code NAF/APE exploitable
- **Nombre de transactions mensuelles estimé** — utile pour dimensionner le pipeline

---

## 3. Obligations comptables et documents par profil

### 3.1 Matrice documents fiscaux par régime

| Régime | Liasse fiscale | Bilan | Compte de résultat | FEC obligatoire | Annexes |
|--------|---------------|-------|-------------------|-----------------|---------|
| **Micro-BIC / Micro-BNC** | Non (2042-C Pro uniquement) | Non | Non | **Non** | Non |
| **BNC réel (déclaration contrôlée)** | 2035 + annexes 2035-A/B | Non (pas de bilan au sens strict) | Oui (recettes-dépenses dans 2035-A) | **Oui** (si compta informatisée) | 2035-A, 2035-B |
| **BIC réel simplifié** | 2031 + 2033-A à 2033-G | Oui (simplifié, 2033-A) | Oui (simplifié, 2033-B) | **Oui** | 2033-C à 2033-G |
| **BIC réel normal** | 2031 + 2050 à 2059-G | Oui (complet, 2050/2051) | Oui (complet, 2052/2053) | **Oui** | 2054 à 2059-G |
| **IS réel simplifié** | 2065 + 2033-A à 2033-G | Oui (simplifié, 2033-A) | Oui (simplifié, 2033-B) | **Oui** | 2033-C à 2033-G |
| **IS réel normal** | 2065 + 2050 à 2059-G | Oui (complet, 2050/2051) | Oui (complet, 2052/2053) | **Oui** | 2054 à 2059-G |
| **SCI IR** | 2072 (+ 2044 par associé) | Non (comptabilité de trésorerie suffisante) | Non | **Non** (si compta manuelle) | — |
| **SCI IS** | 2065 + 2033-A à 2033-G | Oui (simplifié) | Oui (simplifié) | **Oui** | 2033-C à 2033-G |
| **LMNP réel simplifié** | 2031 + 2033-A à 2033-G | Oui (simplifié) | Oui (simplifié) | **Oui** | Amortissements (2033-C) |
| **SCM** | 2036 | Non | Non (répartition des charges) | **Non** (sauf si IS) | — |

### 3.2 Implications pour Qitus — quoi générer

**Décision structurante :** Qitus doit adapter ses outputs par profil. Ce n'est pas un "nice to have" — un micro-entrepreneur n'a pas de bilan à produire, une SCI IR n'a pas de FEC, une SASU IS a un bilan simplifié. Générer les mauvais documents = perte de confiance immédiate.

| Profil Qitus | Documents générés | Documents NON générés |
|-------------|-------------------|----------------------|
| **Micro (BIC/BNC)** | Récapitulatif recettes/dépenses, 2042-C Pro pré-rempli | Pas de bilan, pas de FEC, pas de liasse |
| **BNC réel** | 2035 + annexes, FEC, tableau recettes-dépenses | Pas de bilan classique |
| **BIC réel simplifié** | 2031, 2033-A à G, FEC, bilan simplifié, CR simplifié | Pas d'annexes régime normal |
| **IS réel simplifié** | 2065, 2033-A à G, FEC, bilan simplifié, CR simplifié | Pas d'annexes régime normal |
| **SCI IR** | 2072, aide au 2044, récapitulatif revenus fonciers | Pas de FEC (sauf compta informatisée), pas de bilan |
| **SCI IS** | 2065, 2033-A à G, FEC, bilan simplifié | — |
| **LMNP** | 2031, 2033-A à G, FEC, tableau amortissements | — |

### 3.3 FEC — point d'attention

Le FEC est obligatoire pour toute entreprise :
- Soumise à un régime réel (BIC, BNC déclaration contrôlée, IS)
- ET tenant une comptabilité informatisée

**Micro-entreprises = pas de FEC.** SCI IR avec comptabilité manuelle = pas de FEC. Toute autre combinaison régime réel + compta informatisée (ce qui est le cas dès qu'on utilise Qitus) = FEC obligatoire.

Conséquence technique : dès qu'un utilisateur non-micro utilise Qitus, le FEC est implicitement obligatoire puisque Qitus EST un outil de comptabilité informatisée. L'article L47 A-I du LPF s'applique.

---

## 4. Mapping vers les 4 tiers Qitus

### 4.1 Matrice tier ← profil comptable

| Tier | Profils comptables | Régime | EC présent | Risque fiscal réel |
|------|-------------------|--------|------------|-------------------|
| **Tier 1 — Micro** | Micro-BIC, Micro-BNC, Auto-entrepreneur | Micro | Non (en général) | **Quasi-nul** : charges non déductibles, pas de bilan, pas de liasse, pas de FEC |
| **Tier 2 — EI/EURL réel** | EI BNC réel, EI BIC réel simplifié, EURL IR | Réel simplifié | Non (souvent) | **Faible** : charges déductibles mais montants unitaires faibles, bonne foi quasi-garantie, droit à l'erreur ESSOC |
| **Tier 3 — IS sans EC** | SASU IS, EURL IS, SCI IS — sans expert-comptable déclaré | Réel simplifié (IS) | **Non** | **Modéré** : IS = responsabilité société, bilan obligatoire, FEC auditable, redressement possible (mais bon faith + droit erreur) |
| **Tier 4 — Avec EC** | Toute forme avec EC déclaré | Tout régime réel | **Oui** | **Transféré** : l'EC valide, Qitus = outil de préparation |

### 4.2 Détection automatique du tier à l'onboarding

```
SI régime = micro → Tier 1
SINON SI ec_present = true → Tier 4
SINON SI regime_imposition = IS → Tier 3
SINON → Tier 2
```

L'utilisateur peut override manuellement (ex : un micro qui veut plus de contrôle, un IS qui travaille avec un EC non déclaré dans Qitus).

### 4.3 Politique d'auto-catégorisation par tier (rappel + détail)

La politique est la **4-rule blacklist simplifiée** validée précédemment, avec modulation par tier :

#### Blacklist commune (tous tiers)

| # | Règle | Détection | Action |
|---|-------|-----------|--------|
| 1 | **Opération intracommunautaire** | Devise étrangère OU counterparty avec TVA intra (préfixe pays ≠ FR) OU mention "intra" dans libellé | `NEEDS_REVIEW` — TVA autoliquidation requiert validation |
| 2 | **Immobilisation potentielle (≥ 500€ HT)** | Montant ≥ 500€ HT ET catégorie IA = classe 2 (immobilisations) | `REVIEW_LIGHT` — choix charge vs immobilisation |
| 3 | **Charge personnelle détectée** | Catégorie IA = "charge personnelle" OU "prélèvement exploitant" OU compte 108xxx | `NEEDS_REVIEW` — ne pas comptabiliser en charge déductible |
| 4 | **Avoir / note de crédit** | Montant négatif ET source ≠ virement entrant identifié | `REVIEW_LIGHT` — rattacher à la facture d'origine |

#### Modulation par tier

| Tier | Seuil confiance IA pour auto-apply | Blacklist active | Action si confiance < seuil |
|------|-------------------------------------|-----------------|---------------------------|
| **Tier 1 — Micro** | **≥ 70%** (quasi tout passe) | Règles 1 + 3 uniquement (pas d'immobilisation ni avoir en micro) | `AUTO_APPLY` avec flag "vérifié par IA" |
| **Tier 2 — EI réel** | **≥ 85%** | Règles 1 + 2 + 3 + 4 | `REVIEW_LIGHT` (suggestion duale) |
| **Tier 3 — IS sans EC** | **≥ 90%** | Règles 1 + 2 + 3 + 4 + extensions (voir ci-dessous) | `NEEDS_REVIEW` |
| **Tier 4 — Avec EC** | **≥ 80%** (l'EC valide de toute façon) | Règles 1 + 2 + 3 + 4 | `AUTO_APPLY` avec flag "à valider par EC" |

#### Extensions blacklist Tier 3 (IS sans EC)

| # | Règle additionnelle | Raison |
|---|---------------------|--------|
| 5 | **Provision / charge à payer** | Impact IS direct, requiert justification |
| 6 | **Charge exceptionnelle > 1000€ HT** | Inhabituel = à vérifier |

### 4.4 Justification des seuils de confiance

- **Tier 1 (70%)** : en micro, les charges ne sont pas déductibles. Une erreur de catégorisation n'a aucun impact fiscal. Le seul risque est la lecture du récapitulatif recettes/dépenses — purement informatif.
- **Tier 2 (85%)** : charges déductibles, mais risque fiscal faible (~42€ worst case par transaction mal catégorisée sur 140€ TTC). Le droit à l'erreur (ESSOC art. L.62 LPF) et la bonne foi (art. 1729 CGI) protègent. 85% = seuil pragmatique validé par l'analyse risque/bénéfice.
- **Tier 3 (90%)** : IS = la société est le contribuable. Un redressement impacte la société, pas un individu protégé par le droit à l'erreur de la même façon. Plus de prudence justifiée.
- **Tier 4 (80%)** : l'EC valide tout. Qitus peut être plus permissif car le filet de sécurité humain expert existe. L'objectif est de maximiser le volume auto-catégorisé pour réduire le temps EC.

---

## 5. Onboarding Qitus — Données à collecter

### 5.1 Types juridiques supportés en V1

**Benchmark Indy :** EI (ou auto-entreprise) / SASU-SAS / EURL-SARL / SCI / SCM / Indivision (6 types)

**Qitus V1 :** 6 types, mais pas les mêmes. La distinction micro vs EI réel est explicite dès le premier écran. SCM et Indivision sont exclus (marchés trop niche). LMNP est un type à part entière (cas d'usage distinct : le LMNP ne se considère pas comme un entrepreneur, son job-to-be-done c'est "gérer la compta de mon appartement").

| Type affiché à l'utilisateur | Mapping interne | Tier par défaut | Régimes proposés |
|------------------------------|----------------|-----------------|------------------|
| Auto-entrepreneur / Micro-entreprise | `MICRO` | Tier 1 | Micro-BIC / Micro-BNC |
| Entreprise individuelle (régime réel) | `EI_REEL` | Tier 2 | BNC réel (2035) / BIC réel simplifié (2031+2033) |
| SASU / SAS | `SAS` | Tier 3 | IS réel simplifié (2065+2033) — par défaut |
| EURL / SARL | `SARL` | Tier 2 (EURL IR) ou Tier 3 (IS) | IR BIC (2031) / IR BNC (2035) / IS (2065+2033) |
| SCI | `SCI` | Tier 2 (IR) ou Tier 3 (IS) | IR (2072+2044) / IS (2065+2033) |
| LMNP | `LMNP` | Tier 2 | BIC réel simplifié (2031+2033) — amortissements obligatoires |

**Types exclus V1 (ajout post-beta si demande) :**

| Type | Raison d'exclusion |
|------|-------------------|
| SCM (Société Civile de Moyens) | Ultra-niche (cabinets médicaux/avocats mutualisant des charges), comptabilité atypique (2036, répartition de charges sans résultat propre) |
| Indivision | Le LMNP en indivision utilise les mêmes formulaires (2031+2033) — l'indivision est un habillage juridique, pas un régime fiscal distinct |

**Pourquoi séparer Micro vs EI réel (contrairement à Indy) :** les obligations comptables sont radicalement différentes. Un micro n'a ni liasse, ni FEC, ni bilan. Un EI au réel a tout. Les fusionner dans un bucket "EI (ou auto-entreprise)" comme Indy oblige à détecter la différence à l'étape suivante — mieux vaut être explicite dès le choix initial pour que le tier et l'UX s'adaptent immédiatement.

**Pourquoi LMNP comme type distinct (et pas un sous-régime de EI) :** 80% des LMNP ne se considèrent pas comme entrepreneurs. Leur vocabulaire, leurs besoins (amortissements, revenus locatifs) et leur parcours utilisateur sont spécifiques. C'est un signal PMF : si l'onboarding parle de "votre entreprise" à un propriétaire LMNP, il décroche.

### 5.2 Flow onboarding proposé

| Étape | Donnée | Objectif Qitus | Obligatoire |
|-------|--------|---------------|-------------|
| 1 | **SIREN/SIRET** | Lookup registre (API Sirene ou Pappers) → pré-remplir forme juridique, NAF, adresse | Oui |
| 2 | **Type juridique** | Pré-rempli par lookup, confirmable. Les 6 options ci-dessus | Oui |
| 3 | **Régime d'imposition** | Conditionné par type (voir tableau ci-dessus). Avec n° CERFA affiché | Oui |
| 4 | **Régime TVA** | Franchise / Réel simplifié (CA12) / Réel normal (CA3 trim/mens). Non affiché si micro en franchise | Oui |
| 5 | **Nature de l'activité** | Services / Produits physiques / Mixte | Oui |
| 6 | **Dates exercice** | Début + fin exercice en cours | Oui |
| 7 | **Travaillez-vous avec un EC ?** | Oui/Non → détermine Tier 4. Si oui : email EC (invitation future) | Oui |
| 8 | **Connexion bancaire** | Via Bridge ou équivalent | Oui (pour catégorisation) |
| 9 | **CA estimé (fourchette)** | < 77 700€ / 77 700–300 000€ / > 300 000€ | Optionnel (affinage tier) |

### 5.3 Données dérivées automatiquement

À partir des réponses onboarding, Qitus dérive :

| Donnée dérivée | Règle |
|---------------|-------|
| `companyTier` | Algorithme §4.2 |
| `taxFormSet` | Mapping §3.1 (forme × régime → CERFA) |
| `fecRequired` | `true` sauf micro ET SCI IR compta manuelle |
| `bilanRequired` | `true` sauf micro, BNC réel, SCI IR |
| `autoApplyThreshold` | Seuil confiance IA du tier |
| `blacklistRules` | Set de règles actives du tier |
| `vatRegime` | Franchise / CA12 / CA3 |

### 5.4 Différences clés vs Indy

| Aspect | Indy | Qitus |
|--------|------|-------|
| Profession spécifique (dropdown BNC) | Oui, très détaillé | Non en V1 — pas d'impact sur les liasses. Ajout futur possible pour affiner les vendor mappings par métier |
| Présence EC | Non collecté | **Oui — structurant** pour le tier et la promesse produit |
| CA estimé | Non collecté | Optionnel — affinage du tier (un micro à 70K€ n'est pas un micro à 5K€) |
| SCM | Oui | **Non en V1** — marché trop niche |
| Indivision | Oui | **Non en V1** — marché trop niche |
| Date prochaine déclaration TVA | Oui | **Oui** — utile pour les rappels |

---

## 6. Impact sur le plan de catégorisation (PCG)

### 6.1 Le PCG est-il le même pour tous les profils ?

**Oui et non.**

Le Plan Comptable Général (PCG) est universel — les numéros de compte sont les mêmes. Mais :

- **Micro** : pas de PCG au sens strict. Qitus utilise des catégories simplifiées (recettes / achats / frais / etc.) sans numéro de compte. La catégorisation IA peut mapper directement sur ces catégories sans passer par le PCG.
- **BNC réel** : PCG adapté BNC (nomenclature 2035). Comptes spécifiques : 6226 (honoraires rétrocédés), 6231 (documentation technique), etc.
- **BIC / IS** : PCG standard. C'est le cas de base de Qitus aujourd'hui.
- **SCI IR** : pas de PCG. Catégories foncières : loyers, charges copropriété, travaux, intérêts emprunt, assurance, taxe foncière.
- **LMNP** : PCG simplifié BIC + gestion des amortissements.

### 6.2 Conséquence pour l'IA de catégorisation

Le modèle IA doit recevoir le contexte du profil dans son prompt :

```
Profil : {forme_juridique} / {regime_imposition}
Plan de comptes applicable : {pcg_variant}
```

Sans cette info, l'IA propose des comptes BIC à un BNC, ou des comptes PCG à un micro — ce qui génère du bruit et des corrections inutiles.

### 6.3 Adoption de la catégorisation Indy ?

**Non recommandé en l'état.** Indy utilise des catégories propriétaires simplifiées qui ne sont pas des comptes PCG. Leur approche fonctionne parce qu'Indy gère la traduction catégorie → CERFA en interne. Qitus expose le PCG à l'utilisateur (et surtout à l'EC en Tier 4), donc la catégorisation doit rester en comptes PCG.

En revanche, pour le **Tier 1 (micro)**, Qitus pourrait adopter une couche de catégories simplifiées "à la Indy" (Achats, Frais de déplacement, Télécom, Logiciels, etc.) avec un mapping interne vers le PCG — l'utilisateur micro ne voit jamais le numéro de compte.

---

## 7. Monitoring et alertes

### 7.1 Métriques par tier

| Métrique | Seuil d'alerte | Action |
|----------|---------------|--------|
| Taux de correction utilisateur (toutes catégorisations auto-appliquées corrigées dans les 7j) | > 5% | Revue des vendor mappings + retrain prompt IA |
| Taux de NEEDS_REVIEW (transactions en attente manuelle) | > 15% (Tier 1), > 25% (Tier 2), > 30% (Tier 3) | Enrichir les rules/vendor mappings |
| Taux de confiance IA moyen | < 75% (global) | Investiguer qualité des libellés bancaires |
| Transactions > 30j sans catégorisation | > 10 | Notification utilisateur + suggestion batch |

### 7.2 Dashboard interne (post-beta)

Un dashboard simple (Metabase ou équivalent) par cohorte de tiers :
- Distribution des confiances IA par tier
- Top 20 vendors non mappés par fréquence
- Taux auto-apply réel vs théorique par tier
- Corrections les plus fréquentes (source d'apprentissage)

---

## 8. Séquencement d'implémentation

### Phase 1 — Onboarding profil (3-4j)

- Ajout champs Prisma : `companyType`, `taxRegime`, `vatRegime`, `hasAccountant`, `companyTier` (enum)
- Migration Prisma
- UI onboarding (Polaris multi-step form)
- Algorithme de dérivation du tier (§4.2)
- Dérivation du `taxFormSet` (§3.1)

### Phase 2 — Politique par tier dans le pipeline (2-3j)

- Modifier `CategorizationTrustPolicy` : remplacer le `reviewRequired: true` universel par la logique tier (§4.3)
- Ajouter les 4 règles blacklist dans le pipeline
- Ajouter les 2 règles étendues pour Tier 3
- Tests Vitest : 1 test par tier × 1 test par règle blacklist = ~20 tests

### Phase 3 — Adaptation outputs par profil (5-8j)

- Conditionner la génération de documents par `taxFormSet`
- Adapter le module FEC : ne pas générer si `fecRequired = false`
- Adapter le module bilan : ne pas générer si `bilanRequired = false`
- Créer les templates CERFA manquants (2035, 2072 — si pas déjà présents)

### Phase 4 — Catégorisation contextualisée (2-3j)

- Injecter le profil dans le prompt IA (§6.2)
- Créer le variant PCG simplifié pour micro (catégories sans numéro de compte)
- Adapter les vendor mappings par profil (certains mappings n'ont de sens qu'en BIC, pas en BNC)

**Total estimé : 12-18j** (vs la "usine à gaz" initiale à 53-80j)

---

## 9. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Mauvais mapping CERFA → mauvais formulaire généré | Faible | Fort (perte de confiance) | Tests automatisés par profil, validation par EC beta-testeur |
| Seuil confiance trop bas Tier 1 → catégorisations aberrantes | Moyenne | Faible (pas d'impact fiscal micro) | Monitoring taux de correction + ajustement seuil |
| Utilisateur se trompe de régime à l'onboarding | Moyenne | Fort | Lookup SIREN pré-remplit le régime, demander confirmation, permettre modification ultérieure |
| Tier 3 trop strict → UX dégradée pour SASU sans EC | Faible | Moyen | A/B test seuils 85% vs 90% en beta |

---

## 10. Open decisions

| # | Question | Recommandation | Décideur |
|---|----------|---------------|----------|
| OD-1 | Faut-il supporter SCM et Indivision en V1 ? | **Non** — marché trop niche, ajouter post-beta si demande | RP |
| OD-2 | Faut-il supporter le régime réel normal (2050-2059) en V1 ? | **Non** — viser réel simplifié uniquement. Le réel normal concerne les entreprises > 840K€ CA (BIC) qui ont forcément un EC | RP |
| OD-3 | Catégories simplifiées pour micro — liste définitive ? | À valider avec 3-5 micro-entrepreneurs beta-testeurs | RP + beta |
| OD-4 | Bridge vs autre provider pour connexion bancaire ? | Benchmarker Bridge, Powens (ex-Budget Insight), Plaid | RP |
| OD-5 | Le lookup SIREN utilise quelle API ? | API Sirene (INSEE) gratuite, ou Pappers (payant mais plus riche) | RP |

---

## 11. Annexe — Correspondance CERFA complète

### Sociétés soumises à l'IS

| Formulaire | Objet | Régime |
|-----------|-------|--------|
| **2065** | Déclaration de résultat IS | Tous IS |
| **2033-A** | Bilan simplifié | Réel simplifié |
| **2033-B** | Compte de résultat simplifié | Réel simplifié |
| **2033-C** | Immobilisations, amortissements, plus-values | Réel simplifié |
| **2033-D** | Relevé des provisions, déficits reportables | Réel simplifié |
| **2033-E** | Détermination de la valeur ajoutée | Réel simplifié |
| **2033-F** | Composition du capital social | Réel simplifié |
| **2033-G** | Filiales et participations | Réel simplifié |

### Entreprises BIC (IR)

| Formulaire | Objet |
|-----------|-------|
| **2031** | Déclaration de résultat BIC |
| **2033-A à G** | Mêmes annexes que IS réel simplifié |

### Professions libérales BNC

| Formulaire | Objet |
|-----------|-------|
| **2035** | Déclaration de résultat BNC |
| **2035-A** | Compte de résultat fiscal (recettes-dépenses) |
| **2035-B** | Plus-values, exonérations |

### SCI

| Formulaire | Objet | Régime |
|-----------|-------|--------|
| **2072** | Déclaration de résultat SCI | IR |
| **2044** | Revenus fonciers (par associé) | IR |
| **2065 + 2033** | Déclaration IS + annexes | IS |

### LMNP

| Formulaire | Objet |
|-----------|-------|
| **2031** | Déclaration BIC |
| **2033-A à G** | Annexes réel simplifié (dont amortissements 2033-C) |

### Micro-entreprise

| Formulaire | Objet |
|-----------|-------|
| **2042-C Pro** | Déclaration complémentaire revenus non salariés |
| *(Aucune liasse)* | Pas de liasse fiscale |
