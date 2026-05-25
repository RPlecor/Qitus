# Cadrage — Durcissement Produit Qitus : Confiance Par Défaut

**Auteur :** CPO Advisory  
**Date :** 2026-05-24  
**Statut :** V3 — modèle trois vitesses catégorisation IA  
**Priorité :** P0 beta  

---

## 1. Problème

Qitus affiche un état anxiogène par défaut. Un dossier comptable en cours de construction — situation normale — ressemble à un dossier en erreur. L'utilisateur qui ouvre Qitus pour la première fois voit des murs de warnings, des scores à 0%, des statuts "à vérifier" partout, et des compteurs de "manquants" qui ne descendent jamais à zéro.

Ce n'est pas un bug. C'est un choix de design implicite : **l'absence de donnée est traitée comme un problème**, alors que dans la plupart des cas, c'est un état normal (pas encore fait, pas applicable, ou légitimement à zéro).

L'impact produit est direct : l'utilisateur perd confiance, conclut que Qitus "ne marche pas", et retourne vers son processus manuel ou son EC.

## 2. Diagnostic — 10 anti-patterns systémiques

L'audit du codebase identifie 10 patterns récurrents qui produisent de l'anxiété inutile. Ils se renforcent mutuellement par cascade.

### AP-1 : Default label = "À vérifier"

**Fichier :** `ui-labels.ts`, `reconciliation-labels.ts`

Le `default` case de 12+ fonctions de labeling renvoie "À vérifier". Tout item sans statut explicite apparaît comme un problème à traiter. Fonctions concernées : `readinessStatusLabel`, `syncStatusLabel`, `workpaperStatusLabel`, `closingAdjustmentStatusLabel`, `dossierSectionStatusLabel`, `riskLabel`, `eInvoiceStatusLabel`, `fiscalYearStatusLabel`, `expertReviewSeverityLabel`, `reconciliationMatchStatusLabel`, etc.

**Principe violé :** un état inconnu n'est pas un état problématique.

### AP-2 : Absence de données = "missing" + risk "high"

**Fichier :** `accounting-coverage-center.server.ts`

La fonction `buildCoverageAreas()` tague chaque zone sans donnée comme `status: "missing"` avec `risk: "high"`. Un dossier vierge obtient un score proche de 0% et le label "Couverture EC à risque". Zones affectées : transactions, ledger, documents, FEC, tax_package, reconciliations, closing, expert_review, audit_privacy.

**Principe violé :** un dossier en construction n'est pas un dossier à risque.

### AP-3 : Gates de clôture strictes en cascade

**Fichier :** `annual-closing-center.server.ts`, `expert-dossier-readiness-workflow.server.ts`

12 étapes de clôture, chacune génère des blockers et warnings indépendants. Chaque étape non commencée = blocker. Le statut global `canClose` exige `blockers.length === 0 && steps.every(DONE || SKIPPED)`. Résultat : tout est bloqué tant que tout n'est pas fini, sans distinction entre "pas encore fait" et "problème réel".

**Principe violé :** "pas encore commencé" ≠ "bloqué".

### AP-4 : 13 sources de notification empilées

**Fichier :** `notification-sources.server.ts`

13 sources indépendantes (transactions, documents, review, TVA, reconciliation, closing, evidence, coverage, change-impact...) produisent des notifications simultanées. En fonctionnement normal (phase de travail actif), l'utilisateur voit 10-15 alertes dont plusieurs en severity BLOCKING.

**Principe violé :** le bruit noie le signal.

### AP-5 : manualDataCompleteness = "missing" sans chemin vers "complete"

**Fichier :** `tax-package-source-readiness-center.server.ts`

`manualDataCompleteness` est hardcodé à `"missing"` (ligne 38). Il n'existe aucun chemin dans le code pour atteindre `"complete"`. Conséquence : les cases de la liasse qui dépendent de données manuelles restent à compléter de façon irréductible.

**Principe violé :** un statut sans chemin de résolution est un faux statut.

### AP-6 : Reconciliation "MISSING" / "Jamais lancé" par défaut

**Fichier :** `reconciliation-core.server.ts`, `reconciliation-labels.ts`

Quand aucun run de rapprochement n'existe : `status: "MISSING"`, progress 0, label "Jamais lancé". Cela cascade en coverage "missing", dossier EC "blocked", annual closing "blocker", notification "points de rapprochement".

**Principe violé :** un module non activé n'est pas un module en échec.

### AP-7 : Freshness warnings en phase de travail actif

**Fichiers :** `DocumentFreshnessCenter`, `ReconciliationFreshnessCenter`, `ClosingAdjustmentFreshnessCenter`, `VatDeclarationFreshnessCenter`

Chaque modification d'écriture déclenche des warnings de freshness ("documents à régénérer", "rapprochements à relancer", "OD à recalculer", "déclaration TVA obsolète"). Pendant la phase de travail actif, l'utilisateur modifie les écritures en continu → tous les artefacts dérivés sont systématiquement "stale" → pluie de warnings permanente.

**Principe violé :** le travail en cours n'est pas une anomalie.

### AP-8 : Evidence requirement structurel sur chaque écriture

**Fichier :** `evidence-requirement-center.server.ts`

Chaque écriture journal génère au moins une exigence de preuve. Import = `level: "required"`. Le compteur `requiredMissing` est visible dans la couverture, le dossier EC, et les notifications. Un journal de 500 écritures sans pièces = 500 items "manquants" affichés.

**Principe violé :** un compteur sans contexte est un compteur anxiogène.

### AP-9 : Catégorisation IA = "Suggestion à confirmer"

**Fichier :** `accounting-certainty-center.server.ts`

Toute catégorisation source IA affiche "Suggestion à confirmer" + "Confiance à confirmer", même quand la suggestion est correcte et la confiance élevée. L'automatisation produit des warnings au lieu de résultats validés.

**Principe violé :** un résultat fiable ne devrait pas demander confirmation.

### AP-10 : Score de couverture affiché en % dès le premier jour

**Fichier :** `accounting-coverage-center.server.ts`

Le score de couverture est calculé et affiché dès l'ouverture du dossier. `statusScore("missing") = 0`, `statusScore("partial") = 50`. Un dossier neuf = score proche de 0%, visuellement identique à un dossier catastrophique.

**Principe violé :** un score sans baseline est un score trompeur.

---

## 3. Vision cible : Confiance Par Défaut

### Philosophie

Qitus doit communiquer de la **maîtrise**, pas de l'**alarme**. L'utilisateur doit voir :
- ce qui est fait (et bien fait) ;
- ce qui reste à faire (avec un chemin clair) ;
- ce qui ne le concerne pas (masqué ou étiqueté "non applicable").

L'état par défaut d'un item n'est plus "à vérifier" mais "pas encore commencé" (neutre) ou "non applicable" (masqué).

### Trois principes de résolution

| Principe | Règle | Remplace |
|----------|-------|----------|
| **Zéro fiable** | Si Qitus peut conclure qu'une valeur est 0 de façon fiable, afficher "calculé à 0", pas "à compléter" | AP-2, AP-5 |
| **Pas-encore ≠ problème** | Un module non activé ou une étape non commencée est un état neutre, pas un blocker ni un warning | AP-1, AP-3, AP-6, AP-10 |
| **Travail-en-cours = mode silencieux** | Pendant la phase de travail actif, les alertes de freshness et les cascades de notification sont différées ou groupées | AP-4, AP-7 |

### Taxonomie universelle de résolution

Tous les modules projettent vers la même taxonomie de statut pour l'affichage utilisateur. Cette taxonomie est une **projection de présentation** (`UserFacingResolution`), pas un moteur de décision. Chaque Module métier conserve ses propres statuts internes et les traduit vers cette projection via un helper centralisé :

| Statut | Signification | Couleur | Action utilisateur |
|--------|--------------|---------|-------------------|
| `calculated` | Valeur calculée à partir de données fiables | vert | Aucune |
| `zero_by_absence` | Zéro fiable — absence de mouvement confirmée | vert clair | Aucune (vérifiable) |
| `confirmed` | Validé par l'utilisateur, règle déterministe, correction mémorisée, ou mapping référentiel. **Jamais par IA seule.** | vert | Aucune |
| `auto_applied` | Appliqué automatiquement par Qitus (IA catégorisation + policy de fiabilité). Corrigeable à tout moment. Traçable (justification visible). Ne compte PAS comme "à valider". | vert pâle | Aucune (corrigeable) |
| `not_started` | Pas encore commencé — neutre côté utilisateur. Peut rester bloquant dans un go/no-go beta si la capacité est critique (ex : import journal, profil entreprise). | gris | Optionnel (sauf gate beta) |
| `in_progress` | Travail en cours | bleu | Continuer |
| `to_review_light` | Proposition IA haute confiance, contexte nouveau — à relire discrètement. Indicateur discret, pas warning. | bleu clair | Relire rapidement |
| `to_review` | Cas ambigu, confiance insuffisante, ou impact fiscal — vraie revue nécessaire | jaune | Relire attentivement |
| `to_complete` | Donnée réellement manquante et nécessaire | orange | Saisir/fournir |
| `not_applicable` | Hors périmètre, régime, ou profil utilisateur | gris masqué | Aucune |
| `blocked` | Impossible à calculer — problème technique ou référentiel | rouge | Résoudre |

**Règle clé :** `not_started`, `not_applicable`, `auto_applied` et `confirmed` ne comptent PAS dans les compteurs de "problèmes". Seuls `to_review`, `to_review_light`, `to_complete` et `blocked` apparaissent dans les alertes — et `to_review_light` avec un indicateur discret, pas un warning.

### Garde architecturale : présentation ≠ relaxation

Ce durcissement est une couche de **présentation de la certitude**, pas une relaxation des exigences comptables. Quatre règles structurantes :

1. **`confirmed` jamais par IA seule.** `confirmed` = validation utilisateur, règle déterministe, correction mémorisée, ou mapping référentiel validé. L'IA de catégorisation peut produire `auto_applied` (voir ci-dessous), jamais `confirmed`.
2. **Evidence jamais réduite par montant seul.** La classification des preuves vient d'un référentiel de preuve (type d'écriture × contexte comptable), pas d'un seuil en euros.
3. **Zéro jamais automatique sans justification référentielle.** Chaque `zero_by_absence` est traçable : `emptyBehavior` du référentiel + complétude de source + justification lisible.
4. **Projection UI, pas moteur de décision.** La taxonomie `UserFacingResolution` est une projection. Les Modules profonds conservent leurs statuts métier propres. Un Module de langage/résolution traduit pour l'affichage, sans décider à la place du domaine.

### Distinction IA chat / IA catégorisation transactionnelle

Qitus utilise deux IA différentes. Elles n'ont pas les mêmes droits :

| IA | Rôle | Statut max autorisé | Justification |
|----|------|---------------------|---------------|
| **IA de chat** (assistant conversationnel) | Répondre aux questions, expliquer, conseiller | **suggestion-only** — aucun statut produit | Le chat ne modifie pas les données comptables |
| **IA de catégorisation transactionnelle** | Affecter un compte PCG, un taux de TVA, un tiers à une transaction | **`auto_applied`** si la policy de fiabilité est satisfaite, sinon `to_review_light` ou `to_review` | La catégorisation modifie les données comptables, mais sur des cas courants bien bornés, l'IA est plus fiable qu'un utilisateur non-comptable |

### Modèle à trois vitesses — catégorisation transactionnelle

L'IA de catégorisation transactionnelle produit l'un de ces trois statuts, jamais `confirmed` :

**`auto_applied`** — appliqué automatiquement, sans action requise, corrigeable.

La catégorisation est appliquée si et seulement si **toutes** les conditions de la policy de fiabilité sont réunies :

- Compte PCG valide et non ambigu ;
- TVA simple (taux standard, exonéré) ou non applicable — jamais sur autoliquidation, intracommunautaire, TVA sur encaissements ;
- Fournisseur reconnu (≥2 occurrences avec même catégorisation) ou historique cohérent ;
- Montant cohérent avec l'historique du fournisseur ;
- Pas d'immobilisation potentielle (montant + nature) ;
- Pas de charge mixte pro/perso détectée ;
- Pas de provision, OD, écriture d'inventaire, ou fiscalité sensible ;
- Pas de correction utilisateur antérieure contradictoire sur ce fournisseur/ce type ;
- Confiance IA ≥ HIGH.

L'affichage montre la justification : *"Orange — Télécommunications (626100) — fournisseur récurrent — même compte que vos 4 dernières factures Orange"*.

Les transactions `auto_applied` ne comptent PAS dans les compteurs "à valider". Elles apparaissent dans la liste des écritures comme catégorisées, avec un indicateur discret "Appliqué automatiquement" et la possibilité de corriger en un clic.

**`to_review_light`** — proposition haute confiance, contexte nouveau, à relire rapidement.

Conditions : confiance HIGH mais au moins une condition de la policy non remplie (fournisseur nouveau, première occurrence d'un type de charge, montant inhabituellement élevé pour ce fournisseur). Indicateur discret, pas warning. L'utilisateur voit "À valider rapidement" avec la justification IA.

**`to_review`** — cas ambigu ou à impact fiscal, vraie revue nécessaire.

Conditions : confiance MEDIUM/LOW, ou cas à impact fiscal indépendamment de la confiance (TVA complexe, immobilisation potentielle, charge mixte, provision, intracommunautaire). Warning visible. L'utilisateur voit "À vérifier" avec la raison du doute.

### Moat Qitus sur la catégorisation

Le modèle Indy applique aussi automatiquement, mais sans transparence : l'utilisateur ne sait pas pourquoi l'IA a catégorisé ainsi, ni quelles règles ont été appliquées. Le moat Qitus est triple :

1. **Explication** — chaque `auto_applied` affiche sa justification (fournisseur, historique, compte PCG, règle).
2. **Référentiel** — la catégorisation est rattachée au PCG et aux règles comptables, pas à un modèle opaque.
3. **Traçabilité** — le dossier EC et la piste d'audit conservent la source de chaque catégorisation (IA auto, IA + validation utilisateur, règle déterministe, saisie manuelle).
4. **Correction** — toute `auto_applied` est corrigeable en un clic, et la correction alimente le référentiel.

---

## 4. Plan de durcissement par module

### Phase 1 — Fondations (prerequis pour tout le reste)

| Chantier | Module | Description | Effort | Risque |
|----------|--------|-------------|--------|--------|
| F-1 | `ui-labels.ts` | Remplacer tous les `default: "À vérifier"` par des labels contextuels (`not_started`, `not_applicable`). Créer un `ResolutionLabel` générique aligné sur la taxonomie universelle. | 2j | Bas |
| F-2 | `product-language` | Créer un dictionnaire centralisé des messages utilisateur par statut de résolution. Chaque module pioche dedans au lieu d'inventer ses labels. | 2j | Bas |
| F-3 | Types partagés | Créer un type `UserFacingResolution` (projection UI uniquement) et un helper `projectResolution()`. Chaque module métier conserve ses statuts propres (TVA, clôture, liasse, rapprochement…) et les projette vers ce type pour l'affichage. `UserFacingResolution` n'est PAS un moteur de décision — les règles métier restent dans les Modules profonds. | 1j | Bas |

### Phase 2 — Liasse CERFA (déjà cadré)

| Chantier | Module | Description | Effort | Risque |
|----------|--------|-------------|--------|--------|
| L-0 | `tax-package-reference` | Gouvernance du tagging CERFA : exporter toutes les cases 2033/2050, valider `emptyBehavior` et `calculationFamily` case par case, conserver une justification de revue. Aucun faux zéro ne doit être introduit par un tag non validé. | 2-4j + revue comptable | Élevé |
| L-1 | `tax-package` | `TaxPackageCaseResolutionPolicy` — taxonomie 5 statuts, `emptyBehavior` par case, `TaxPackageSourceReadinessCenter`. | 8-12j | Moyen |
| L-2 | `tax-package` | Fix `manualDataCompleteness` — chemin vers `"complete"` quand l'utilisateur a saisi les données manuelles. | 1j | Bas |

*Réf : plan "Durcir La Liasse CERFA" — déjà validé. Le chantier L-0 est un gate P0 : le dev vérifie la mécanique, mais la justesse des tags CERFA doit être revue par Qitus, un expert-comptable, ou une source officielle exploitable.*

Règles de revue L-0 :

- une case de compte de résultat peut être `zero_if_no_movement` seulement si le journal est exportable ;
- une case de bilan peut être `zero_if_balance_source_complete` seulement si Qitus sait que la balance est complète ;
- une case fiscale, déclarative, d'affectation, de déficit, de crédit ou d'annexe reste `manual_if_absent` si la source manque ;
- une case hors régime ou hors forme juridique peut être `not_applicable_if_absent` si le périmètre est explicitement établi ;
- toute case incertaine reste `à compléter`, jamais zéro automatique.

Le manifeste CERFA doit conserver la décision de résolution : statut, `isZeroByAbsence`, complétude de source, justification lisible, comportement référentiel utilisé et source de calcul ou raison d'absence.

### Phase 3 — Couverture & dossier EC

| Chantier | Module | Description | Effort | Risque |
|----------|--------|-------------|--------|--------|
| C-1 | `accounting-coverage` | Distinguer "missing" (absence de donnée requise) de "not_started" (module non activé). Un dossier neuf = `not_started` partout, score non affiché. Le score n'apparaît qu'après le premier import/action. | 3-5j | Moyen |
| C-2 | `accounting-coverage` | Reformuler les risk labels : "Couverture EC à risque" → "Couverture EC en construction" si `not_started`, garder "à risque" uniquement si `partial` + écart réel identifié. | 1j | Bas |
| C-3 | `expert-dossier` | Le dossier EC en mode "construction" ne bloque pas. `blocked` réservé aux vrais blocages (erreur référentiel, incohérence, contrôle non levable). Les sections `not_started` sont neutres. | 3-5j | Moyen |
| C-4 | `expert-dossier` | Readiness workflow : séparer les "blocking items" (vrais problèmes) des "pending items" (pas encore fait). Seuls les blocking items empêchent l'export final. | 2-3j | Moyen |

### Phase 4 — Clôture annuelle

| Chantier | Module | Description | Effort | Risque |
|----------|--------|-------------|--------|--------|
| CL-1 | `annual-closing` | Les 12 étapes adoptent un statut à 3 niveaux : `not_started` (neutre), `in_progress` (ok), `done` / `skipped`, `blocked` (vrai problème). Supprimer les blockers sur étapes non commencées. | 5-8j | Élevé |
| CL-2 | `annual-closing` | `canClose` ne regarde que les étapes requises pour le régime/profil. Les étapes non applicables = `not_applicable`, pas comptées. | 2-3j | Moyen |
| CL-3 | `closing-adjustments`, `closing-workpapers` | Freshness warnings groupés : un seul résumé "X éléments à rafraîchir après vos modifications" au lieu de N warnings individuels. Mode silencieux pendant la phase de travail actif (dernière modification < 1h = on ne prévient pas). | 3-5j | Moyen |

### Phase 5 — Notifications & alertes

| Chantier | Module | Description | Effort | Risque |
|----------|--------|-------------|--------|--------|
| N-1 | `notifications` | Throttling : ne pas afficher plus de 5 notifications simultanées. Prioriser par severity. Grouper les notifications de même type ("3 documents à régénérer" au lieu de 3 notifications séparées). | 3-5j | Moyen |
| N-2 | `notifications` | Mode "travail en cours" : quand l'utilisateur est actif (modifications récentes), les notifications freshness sont différées. Elles apparaissent à la prochaine session ou après 2h d'inactivité. | 2-3j | Bas |
| N-3 | `notifications` | Supprimer `severity: "BLOCKING"` pour les items `not_started`. Seuls les vrais blocages (erreur, incohérence, data corrompue) sont BLOCKING. | 1-2j | Bas |

### Phase 6 — Certitude comptable & Evidence

| Chantier | Module | Description | Effort | Risque |
|----------|--------|-------------|--------|--------|
| CE-1 | `accounting-certainty` | **Modèle à trois vitesses.** Implémenter `AutoApplyReliabilityPolicy` : si toutes les conditions de fiabilité sont réunies → `auto_applied` (pas d'action requise, justification visible, corrigeable). Si confiance HIGH mais policy partielle → `to_review_light` (indicateur discret). Si confiance MEDIUM/LOW ou impact fiscal → `to_review` (warning). `confirmed` jamais par IA — réservé à validation utilisateur, règle déterministe, correction mémorisée, mapping référentiel. Afficher la justification pour chaque catégorisation (`auto_applied` inclus). | 5-8j | Moyen |
| CE-2 | `evidence` | Refondre la classification des preuves sur un **référentiel de preuve** (pas une préférence d'affichage). Trois niveaux : `blocking_proof` (bloque une action précise — clôture, export), `coverage_gap` (à compléter pour renforcer le dossier EC), `recommended_evidence` (utile mais non bloquant). La classification vient du type d'écriture et du contexte comptable, jamais du montant seul. Ne jamais réduire une preuve à `recommended` uniquement parce que le montant est petit. | 3-5j | Élevé |
| CE-3 | `evidence` | Compteur contextuel : "12 pièces à fournir pour la clôture" (actionnable) au lieu de "487 écritures sans justificatif" (paralysant). | 1-2j | Bas |

### Phase 7 — Reconciliation & modules périphériques

| Chantier | Module | Description | Effort | Risque |
|----------|--------|-------------|--------|--------|
| R-1 | `reconciliations` | Status "MISSING" / "Jamais lancé" → `not_started` (neutre). Ne cascade plus en blockers dans coverage/dossier/closing tant que l'utilisateur n'a pas activé le module. | 2-3j | Bas |
| R-2 | `bank-reconciliation` | Même traitement : non configuré = `not_started`, pas blocker de clôture. Devient blocker uniquement si l'utilisateur a un compte bancaire connecté mais n'a pas lancé le rapprochement. | 2-3j | Moyen |
| R-3 | `connectors`, `open-banking` | "Non configuré" → "Disponible" (invitation) au lieu de warning. Le connecteur non activé ne produit aucune alerte. | 1j | Bas |

---

## 5. Séquencement recommandé

```
Phase 1 (Fondations)         ████  5j
Phase 2 (Liasse CERFA)       ████████████  9-13j
Phase 3 (Couverture/Dossier) ████████████  9-14j
Phase 4 (Clôture annuelle)   ██████████████  10-16j
Phase 5 (Notifications)      ████████  6-10j
Phase 6 (Certitude/Evidence) ███████████  9-15j
Phase 7 (Reconciliation)     ██████  5-7j
                              ─────────────────────
                              Total : 53-80 jours-dev
```

**Phases 1 + 2 sont P0 beta** — sans elles, la liasse est inutilisable et la première impression est catastrophique.

**Phase 3 est P0 beta** — la couverture et le dossier EC sont les deux écrans que l'utilisateur voit en premier.

**Phase 6 partielle est P0 limité** — CE-1 (modèle trois vitesses avec `AutoApplyReliabilityPolicy`) et CE-3 (compteur contextuel evidence) sont nécessaires pour la beta. Sans `auto_applied`, chaque transaction demande une action utilisateur → Qitus perd face à Indy sur l'expérience "sans EC". Le référentiel de preuve CE-2 reste P1.

**Phases 4, 5, 7 et CE-2 sont P1** — importantes mais la beta peut démarrer avec le comportement actuel si les phases 1-3 + P0 limité Phase 6 sont faites.

**Dépendances :**
- Phase 1 (Fondations) bloque toutes les autres — la taxonomie universelle et les labels doivent exister avant que les modules les adoptent.
- Phase 2 (Liasse) est indépendante des phases 3-7.
- Phases 3-7 sont parallélisables entre elles après Phase 1.

---

## 6. Métriques de succès

| Métrique | Avant durcissement | Cible après | Comment mesurer |
|----------|-------------------|-------------|-----------------|
| Warnings sur dossier neuf | 10-15 | 0-2 | Créer un dossier vide, compter les notifications |
| Score de couverture dossier neuf | ~0% affiché | Non affiché ou "En construction" | Vérifier l'affichage |
| **Cases CERFA avec résolution justifiée** | ~20-30% (seules les calculées) | **100%** — chaque case a une résolution traçable | `validate:tax-package-cerfa` |
| **`zero_by_absence` avec justification auditée** | 0% (statut inexistant) | **100%** — chaque zéro par absence a son `emptyBehavior` + source | Manifeste CERFA |
| **Cases manuelles devenues zéro sans source** | Non mesuré | **0** — aucune case manuelle ne bascule en zéro automatique | Test de non-régression |
| Notifications simultanées en phase de travail | 10-15 | ≤5 groupées | Modifier 10 écritures, compter |
| Catégorisations IA par vitesse | 100% `to_review` | `auto_applied` (cas courants policy OK) + `to_review_light` (HIGH, policy partielle) + `to_review` (MEDIUM/LOW ou fiscal) | Compter par statut |
| Transactions nécessitant action utilisateur | ~100% (toutes "à confirmer") | <30% (seuls `to_review` + `to_review_light`) | Ratio auto_applied / total |
| `auto_applied` avec justification traçable | N/A | **100%** — chaque auto_applied a fournisseur + compte + règle + historique | Audit piste catégorisation |

---

## 7. Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| **Faux négatif comptable** — un zéro fiable qui n'en est pas un | Élevé — erreur dans la liasse/déclaration | Tagging du référentiel validé par sachant comptable. Tests de non-régression. Flag `isZeroByAbsence` traçable. |
| **Scope creep** — chaque module ouvre des sous-chantiers | Moyen — 77j deviennent 120j | Cadre strict par phase. Pas de refonte UX au-delà du statut/label. |
| **Régression sur les vrais warnings** — en voulant calmer le bruit, on masque un vrai problème | Élevé — l'utilisateur rate une erreur | Conserver `blocked` et `to_complete` avec la même visibilité qu'aujourd'hui. Ne toucher qu'aux `not_started` et `zero_by_absence`. |
| **Incohérence inter-modules** — chaque module adopte la taxonomie à sa sauce | Moyen — UX fragmentée | Phase 1 (Fondations) impose la projection `UserFacingResolution`. Code review systématique. |
| **Relaxation comptable déguisée en UX** — réduire l'anxiété en affaiblissant les exigences comptables | Élevé — perte de crédibilité "rules-first" | `confirmed` jamais par IA seule. `auto_applied` uniquement si policy de fiabilité complète (9 conditions). Evidence jamais réduite par montant seul. Zéro jamais automatique sans justification référentielle. Chaque `auto_applied` traçable et corrigeable. |
| **Policy de fiabilité trop permissive** — `auto_applied` sur des cas qui auraient dû être `to_review` | Élevé — erreur comptable silencieuse | La policy est stricte : toute condition non remplie = fallback vers `to_review_light` ou `to_review`. Pas d'immobilisation, pas de TVA complexe, pas de charge mixte, pas de correction contradictoire. Monitoring du taux de correction utilisateur sur les `auto_applied` — si >5%, resserrer la policy. |
| **Taxonomie universelle qui écrase les règles métier** — `UserFacingResolution` devient moteur de décision | Élevé — appauvrissement des domaines | La taxonomie reste une projection UI. Chaque Module profond conserve ses statuts métier propres. Un Module de langage/résolution traduit pour l'affichage, sans décider à la place du domaine. |

---

## 8. Décisions à prendre

1. **~~Seuil de confiance IA pour auto-confirmation~~** → **TRANCHÉ — modèle à trois vitesses.** L'IA de catégorisation transactionnelle peut produire `auto_applied` (pas d'action requise) si la `AutoApplyReliabilityPolicy` est entièrement satisfaite. `confirmed` reste interdit pour l'IA — réservé aux quatre chemins validés : action utilisateur, règle déterministe, correction mémorisée, mapping référentiel. L'IA de chat reste suggestion-only et ne produit aucun statut comptable. Voir section 3 "Modèle à trois vitesses" pour la policy complète.

2. **Référentiel de preuve (CE-2).** La classification evidence ne se fait plus par montant ou récurrence mais par un **référentiel de preuve** à construire. Trois niveaux : `blocking_proof` (bloque clôture/export), `coverage_gap` (renforce le dossier), `recommended_evidence` (utile, non bloquant). Le référentiel définit quel type d'écriture × quel contexte comptable → quel niveau de preuve. À construire avec la doctrine comptable Qitus. Question ouverte : qui produit ce référentiel — RP seul, ou avec revue EC ?

3. **Timing du mode silencieux notifications (N-2).** Proposition : freshness warnings différés si dernière modification < 2h. Alternative : différés jusqu'à la prochaine session. Le seuil impacte la réactivité perçue.

4. **Score de couverture : masquer ou reformuler ? (C-1).** Option A : ne pas afficher de score tant que le dossier n'a pas atteint un seuil minimal d'activité (premier import). Option B : afficher avec un label "en construction" et une barre de progression orientée positivement. Recommandation : Option A — un score à 0% fait plus de mal qu'un espace vide.

5. **Clôture : étapes non applicables auto-détectées ou manuelles ? (CL-2).** Est-ce que Qitus détecte automatiquement les étapes non applicables (ex : pas de compte bancaire → rapprochement = N/A), ou l'utilisateur les marque manuellement ? Recommandation : auto-détection sur les critères objectifs (profil, connecteurs), skip manuel pour le reste.

---

## 9. Lien avec le positionnement produit

Ce durcissement n'est pas un polish cosmétique. C'est une condition de crédibilité.

Le positionnement Qitus est "rules-first, fiable, vérifiable". Si le produit affiche des murs de warnings sur un dossier sain, il contredit son propre positionnement. L'utilisateur cible (indépendant, TPE) est déjà stressé par la comptabilité — lui envoyer 15 alertes dès l'ouverture, c'est confirmer que la compta c'est compliqué et que l'outil ne maîtrise rien.

Le durcissement transforme Qitus de "checklist anxiogène" en "copilote comptable qui sait ce qu'il fait et montre ce qui reste".

Sur la catégorisation, le positionnement est clair : Qitus fait comme Indy (application automatique des cas courants, pas besoin d'EC pour les charges récurrentes) mais avec le moat "rules-first" (explication visible, référentiel PCG, traçabilité, correction). L'utilisateur ne passe pas son temps à cliquer "valider" sur 300 suggestions évidentes. Il voit ses transactions catégorisées, comprend pourquoi, et intervient uniquement quand c'est justifié.
