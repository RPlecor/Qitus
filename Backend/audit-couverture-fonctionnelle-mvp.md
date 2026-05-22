# Audit de couverture fonctionnelle — MVP Paperasse SaaS

**Date :** 2026-05-19
**Statut :** Diagnostic v2 — recalé après retour développeur
**Input :** Cadrage backend v3, annexe déterministe vs IA, analyse exécution étapes 1-4, prototype frontend 28 écrans, code repo Paperasse3, repo GitHub romainsimon/paperasse
**Objectif :** Vérifier que le MVP couvre le flux comptable complet d'une TPE française, de la collecte bancaire au dépôt fiscal, avec quelques checks humains d'un expert-comptable avant envoi à l'administration.

---

## 0. Grille de lecture — niveaux de couverture

Ce document distingue quatre niveaux de couverture, suite au recalage avec le développeur :

| Niveau | Signification |
|---|---|
| **Implémenté** | Fonctionnel dans Paperasse3, couvert par tests et validations locales |
| **Préparé** | Architecture en place (modèle, module, route), mais le calculateur ou la logique métier n'est pas encore complète |
| **Réutilisable** | Présent dans `vendor/paperasse` (scripts, templates, connecteurs), mais pas encore branché au SaaS |
| **À faire** | Absent du code et des assets réutilisables, nécessaire avant beta |

L'audit initial (v1) ne distinguait pas ces niveaux, ce qui surestimait la couverture de certaines étapes. Cette v2 intègre les corrections factuelles du développeur.

---

## 1. Flux comptable réel d'une TPE française — 10 étapes

Le flux comptable annuel d'une TPE française (SASU, EURL, SAS, SARL) se décompose en 10 étapes, de la collecte des transactions bancaires au dépôt des comptes annuels auprès de l'administration fiscale et du greffe.

### Exploitation courante (mensuel)

| # | Étape | Description |
|---|---|---|
| 1 | Collecte transactions bancaires | Import CSV ou API des relevés bancaires (Qonto, BNP, SG, Boursorama, Stripe) |
| 2 | Catégorisation PCG | Affectation de chaque transaction au bon compte du Plan Comptable Général |
| 3 | Écritures comptables | Génération des écritures en partie double, avec ventilation TVA si régime réel |
| 4 | Déclarations TVA périodiques | CA3 mensuelle ou CA12 annuelle simplifiée, selon le régime TVA |
| 5 | Pièces justificatives | Factures et reçus rattachés aux écritures (obligation légale) |
| 6 | Rapprochement bancaire continu | Vérification mensuelle solde comptable vs solde relevé bancaire |

### Clôture annuelle

| # | Étape | Description |
|---|---|---|
| 7 | Clôture 12 étapes | Balance, lettrage, PCA/CCA, amortissements, provisions, TVA, IS, écritures OD, états financiers, liasse, export |
| 8 | Documents officiels | FEC, bilan, compte de résultat, balance, grand livre, liasse fiscale 2033/2065, PV d'approbation, déclaration de confidentialité |

### Validation et dépôt

| # | Étape | Description |
|---|---|---|
| 9 | Revue expert-comptable | L'EC externe vérifie, valide et signe la liasse et le FEC. Séparation préparateur/validateur obligatoire. |
| 10 | Télédéclaration et dépôt greffe | impots.gouv.fr (EDI/EFI), Infogreffe, dépôt des comptes annuels. Authentification personnelle requise. |

---

## 2. Couverture du MVP — diagnostic par étape

### Étapes bien couvertes (2/10)

#### ① Collecte transactions bancaires — ✓ Couvert (import CSV)

5 parsers CSV implémentés dans le SaaS (Qonto, BNP, Société Générale, Boursorama, GenericParser avec mapping manuel). Pipeline d'import en 6 étapes avec détection de format, normalisation, déduplication, et gestion du statut `NEEDS_MAPPING` pour les CSV inconnus. Retry d'import et retry de catégorisation disponibles.

**Précision :** les connecteurs API Qonto et Stripe existent dans `vendor/paperasse/integrations/` mais ne sont **pas encore branchés** comme intégrations SaaS (pas de CRUD intégrations, pas de gestion de secrets, pas de fetch manuel). Statut : **réutilisable**, pas couvert.

#### ② Catégorisation PCG — ✓ Couvert

Pipeline en 4 étapes déterministes avant appel IA résiduel :

1. `CorrectionRule` propre à l'entreprise
2. `VendorMapping` (exact puis contains)
3. Pattern matching sur le libellé (keywords et regex)
4. Appel IA seulement pour les transactions non matchées (~15 % estimé)

VendorLookupTable avec seed actuel de ~32 mappings (le cadrage cible 100-150 entrées en Phase 5, mais le seed local actuel est plus court). Hit rate cible > 75 % à maturité. Confiance trackée (HIGH / MEDIUM / LOW). Apprentissage automatique via les corrections utilisateur.

#### ⑦ Clôture 12 étapes — ⚠ Partiellement couvert

`AnnualClosingCenter` avec 12 étapes codifiées dans `ClosingStepCatalog`. L'UI et le workflow de parcours existent. Verrouillage et réouverture d'exercice implémentés.

**Précision :** certaines étapes sont des contrôles/validations de parcours, pas encore des calculateurs comptables complets. Il n'existe pas de `ClotureCalculator` unifié couvrant TVA agrégation, IS complet et provisions. Le cadrage et l'annexe déterministe décrivent ces calculateurs comme cible, mais le code actuel n'implémente pas tous les calculs fiscaux détaillés. Les amortissements linéaires (`FixedAssetRegister`) et le rapprochement bancaire de clôture (`BankReconciliationCenter`) sont implémentés. Les étapes TVA et IS restent à compléter — ce qui dépend en amont de la ventilation TVA dans les écritures (correctif 1).

---

### Étapes partiellement couvertes (5/10)

#### ③ Écritures comptables — ⚠ Partiel

**Ce qui fonctionne :** Génération en partie double, numérotation séquentielle, journal BQ.

**Ce qui manque :** Les écritures ne contiennent pas de ventilation TVA. Chaque écriture est un simple `débit compte_charge / crédit 5121`. Pour une entreprise au régime réel (simplifié ou normal), chaque achat devrait générer trois lignes :

```
débit 6135   Notion Labs (HT)       100,00
débit 44566  TVA déductible           20,00
  crédit 5121  Banque                 120,00
```

Et chaque vente :

```
débit 5121   Banque                  1 200,00
  crédit 706   Prestations (HT)      1 000,00
  crédit 44571 TVA collectée            200,00
```

Sans les comptes 44x dans les écritures, le FEC est comptablement incomplet pour toute entreprise au réel. Seules les entreprises en franchise de base (CA < 37 500 € services) peuvent s'en passer.

Le journal BQ est le seul journal actif. Le journal OD existe pour la clôture. Les journaux AC (achats) et VE (ventes) ne sont pas implémentés.

#### ⑥ Rapprochement bancaire continu — ⚠ Partiel

Le `BankReconciliationCenter` existe mais est couplé au workflow de clôture annuelle (`AnnualClosingCenter`). Le rapprochement compare le solde comptable au solde saisi par l'utilisateur, mais uniquement en étape de clôture. Pas de rapprochement mensuel standalone. Un EC fait normalement le rapprochement chaque mois.

#### ⑧ Documents officiels — ⚠ Partiel

**Ce qui fonctionne :** FEC via `generate-fec.js`, bilan et compte de résultat via `generate-statements.js`, balance. Traçabilité `generatedBy` et `scriptVersion`. Evidence bundles avec manifest JSON.

**Ce qui manque :** La liasse fiscale (2033-A à 2033-G ou 2050-2059) est un brouillon Markdown généré par `TaxPackageDraftCenter`, pas un document structuré avec les cases CERFA numérotées. Le `TaxPackageDraftCenter` produit un fichier `.md` labellisé "Brouillon local" et "Ce document n'est pas une télétransmission EDI". Les templates HTML du repo Paperasse (`templates/2065-sd.html`, `templates/liasse-fiscale-2033.md`) existent avec des placeholders mais ne sont pas utilisés par le MVP pour produire un document vérifiable par l'EC.

Le grand livre n'a pas de génération dédiée. Le PDF (via `generate-pdfs.js` et Puppeteer) est reporté hors MVP.

#### ⑩ Télédéclaration et dépôt greffe — ⚠ Partiel (assumé)

Le dépôt sur impots.gouv.fr et Infogreffe reste manuel — c'est un choix assumé et documenté dans le cadrage. Mais la liasse produite n'est pas au format CERFA, ce qui oblige l'EC à ressaisir les montants. Un brouillon vérifiable case par case réduirait ce travail.

---

### Étapes absentes (3/10)

#### ④ Déclarations TVA périodiques — ✗ Absent

**Constat dans le code :** Le régime TVA est configuré au niveau de l'entreprise (`VatRegime` enum : FRANCHISE, REEL_SIMPLIFIE, REEL_NORMAL) mais n'est opérationnalisé nulle part. Aucune logique TVA dans le pipeline de catégorisation, dans le `LedgerWriter`, ni dans les routes API. Pas de comptes 44566 (TVA déductible) ni 44571 (TVA collectée) dans les écritures générées. Pas de module de déclaration CA3 mensuelle ni CA12 annuelle.

Le skill comptable Paperasse (`comptable/SKILL.md`) couvre les 6 régimes TVA, l'autoliquidation et l'intra-UE. L'étape 7 de clôture prévoit l'agrégation des comptes TVA. Mais sans comptes TVA dans les écritures, il n'y a rien à agréger.

**Impact :** Toute entreprise au réel (simplifié ou normal) a besoin de déclarations TVA périodiques. C'est un flux récurrent, pas seulement annuel.

#### ⑤ Pièces justificatives — ✗ Absent

**Constat dans le code :** Aucun champ d'attachment sur le modèle `Transaction`. Pas de stockage de factures, reçus ou justificatifs. Le champ `notes` existe mais c'est du texte libre. Les `Document` en base sont des documents de sortie (FEC, bilan, etc.), pas des pièces entrantes.

**Impact :** Un EC demande systématiquement les factures associées aux écritures. C'est une obligation légale (art. L. 123-22 du Code de commerce : toute écriture doit être appuyée par une pièce justificative). Sans justificatifs rattachés, le travail de l'EC est manuel et la conformité n'est pas assurée.

#### ⑨ Revue expert-comptable — ✗ Absent

**Constat dans le code :** Le système est mono-utilisateur via Clerk (`User` → `Company` 1:N, mais un seul utilisateur par company). Pas de rôle `ACCOUNTANT`, pas de permission différenciée, pas de workflow de revue. Le `ClosingAdjustmentProposal` enregistre un `approvedByUserId` mais c'est le même utilisateur qui prépare et valide. Pas de lien de partage, pas de page read-only pour un tiers.

**Impact :** La promesse "automatisation avec quelques checks EC" suppose que l'EC puisse interagir avec l'outil. Sans ça, le dirigeant exporte le FEC et les documents, les envoie par mail, l'EC les vérifie dans son propre logiciel, puis le dirigeant revient corriger dans Paperasse. Le gain d'automatisation est fortement réduit.

---

## 3. Correctifs recommandés

### 3 correctifs bloquants (avant beta)

#### Correctif 1 — TVA dans les écritures

**Effort estimé :** 3-5 jours

**Modifications :**

1. Ajouter `vatRate Decimal?` sur `VendorMapping` et `Categorization`
2. Le `VendorLookupTable` pré-flag le taux TVA pour les vendors connus (OVH → 20 %, formation → 0 %, etc.)
3. L'utilisateur peut ajuster le taux lors de la correction
4. Le `LedgerWriter` génère 3 lignes au lieu de 2 quand `vatRate` est renseigné et que l'entreprise est au régime réel :
   - débit compte_charge (montant HT)
   - débit 44566 TVA déductible (montant TVA)
   - crédit 5121 banque (montant TTC)
5. Logique miroir pour les crédits (ventes) :
   - débit 5121 banque (TTC)
   - crédit compte_produit (HT)
   - crédit 44571 TVA collectée (TVA)
6. Si l'entreprise est en franchise de base, pas de lignes TVA

C'est 100 % déterministe. Pas besoin d'IA.

#### Correctif 2 — Liasse fiscale remplie via templates Paperasse

**Effort estimé :** 2-3 jours

**Modifications :**

1. Brancher l'adapter Paperasse pour remplir les templates `2065-sd.html` et `liasse-fiscale-2033.md` du repo avec les montants calculés par le `ClotureCalculator` et les agrégations journal
2. Utiliser `generate-pdfs.js` pour convertir en PDF (nécessite Puppeteer côté worker)
3. Stocker comme `Document` avec type `LIASSE` et `generatedBy: 'script:generate-pdfs'`
4. La liasse reste un brouillon de travail (pas une télétransmission EDI), mais elle est vérifiable case par case par l'EC

C'est du REUSE pur — les templates et le script existent déjà.

#### Correctif 3 — Lien de partage EC

**Effort estimé :** 3-4 jours

**Modifications :**

1. Modèle `ShareLink` : token unique, expiration, companyId, permissions (read-only)
2. Route `/shared/:token` qui affiche une vue read-only du dashboard, des écritures, des documents et de la clôture
3. Bouton "Validé par l'expert-comptable" avec saisie du nom de l'EC et horodatage
4. Enregistrement dans `ActivityLog` comme preuve de validation
5. Le dirigeant génère le lien depuis la page profil ou clôture, l'envoie à son EC

Pas besoin de multi-rôles ni de portail EC dédié au MVP.

**Total effort correctifs bloquants : ~8-12 jours**

### 3 correctifs haute priorité (phases suivantes)

| Correctif | Effort | Phase | Détail |
|---|---|---|---|
| Upload justificatifs par transaction | ~2j | Phase 3-4 | Champ attachment sur Transaction, stockage S3/local, visualisation dans le détail transaction |
| Journaux AC/VE configurables | ~1j | Phase 3-4 | Paramètre journal par type d'opération au lieu de hardcoder "BQ" |
| Rapprochement bancaire mensuel | ~2j | Phase 5+ | Découpler `BankReconciliationCenter` du closing, période paramétrable (mois/trimestre) |

---

## 4. Diagnostic global

### Ce qui est solide

L'architecture modulaire est robuste : 30 modules serveur, adapter Paperasse fonctionnel, pipeline de catégorisation 4 étapes, workflow de clôture 12 étapes avec UI et verrouillage, evidence bundles, traçabilité des scripts, dashboard consistency. Le choix déterministe-first est le bon — il protège la marge, la stabilité et la traçabilité comptable. La démo locale est complète de bout en bout (dashboard → imports → transactions → correction → règles → écritures → contrôle → OD → documents → audit → clôture → archive). Le code est bien au-delà d'un prototype.

### Ce qui est décalé

Le MVP a sur-investi dans l'auditabilité interne (preuves, contrôles, cohérence, evidence bundles, accounting review, closing adjustments) et sous-investi dans trois fondamentaux comptables que l'EC attend :

1. Des écritures avec TVA
2. Une liasse fiscale vérifiable
3. Un moyen de valider

### Verdict

Le produit couvre la boucle complète **import → catégorisation → écritures → documents → contrôle → OD → clôture → archive** en local. Il ne couvre **pas encore** les fondamentaux comptables qu'un EC attend pour valider un dossier au régime réel : écritures avec TVA, liasse vérifiable, moyen de revue. Les 3 correctifs bloquants (~8-12 jours) ne remettent pas en cause l'architecture — c'est de l'enrichissement du `LedgerWriter`, du branchement de templates réutilisables depuis `vendor/paperasse`, et d'une feature de partage simple. Après ça, la promesse "automatisation quasi-complète avec checks EC avant dépôt fiscal" tient.

**Note v2 :** le seed VendorMapping actuel est de ~32 entrées, pas 100-150. L'objectif 100-150 est en Phase 5. Les connecteurs Qonto/Stripe sont réutilisables mais pas encore branchés (Phase 4). Les étapes de clôture TVA et IS dépendent en amont de la ventilation TVA dans les écritures.

### Cible de marché MVP

En l'état (même sans correctifs), le MVP fonctionne pour une **micro-SASU en franchise de base** (CA < 37 500 € services) qui gère sa compta seule sans EC. C'est un segment réel mais étroit.

Avec les 3 correctifs, le MVP fonctionne pour une **SASU/EURL au régime réel simplifié** avec un EC externe — c'est le segment cible principal et le plus large.

---

*Document de référence pour la priorisation du backlog MVP Paperasse SaaS. Rattaché au cadrage architecture backend v3 et à l'annexe déterministe vs IA.*
