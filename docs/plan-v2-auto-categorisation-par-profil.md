# Plan V2 — Auto-Catégorisation Par Profil Entreprise

**Auteur :** CPO Advisory  
**Date :** 2026-05-25  
**Statut :** V2 — remplace le Bloc P0 Phase A initial  
**Priorité :** P0 beta  
**Référence cadrage :** `cadrage-profils-entreprise-categorisation.md`  
**Référence gap analysis :** `gap-analysis-automatisation-categorisation.md`

---

## Historique des décisions

| Date | Décision | Impact |
|------|----------|--------|
| 2026-05-24 | Analyse gap Qitus 55-70% vs Indy 90%. Plan Phase A/B/C sur 26-39j | Plan initial |
| 2026-05-24 | Challenge "usine à gaz" : risque fiscal ~42€ par transaction, bonne foi quasi-garantie (art. 1729 CGI, ESSOC L.62 LPF) | Abandon de la policy 9 conditions + 3 sous-policies |
| 2026-05-24 | Adoption de la 4-rule blacklist + monitoring (2-3j vs 8-12j) | Simplification radicale |
| 2026-05-24 | Matrice 4 tiers par profil entreprise : Micro / EI réel / IS sans EC / Avec EC | Politique modulée au lieu d'uniforme |
| 2026-05-25 | Cadrage profils : 6 types juridiques V1, documents fiscaux par régime, onboarding, PCG contextualisé | Extension du scope au-delà de la catégorisation pure |
| 2026-05-25 | Plan V2 consolidé : fusion cadrage + éléments conservés du plan initial | Ce document |

---

## Summary

Remplacer le Bloc P0 Phase A initial (policy uniforme à 9 conditions, 53-80j) par une approche par profil entreprise (policy 4-rule blacklist modulée par tier, 17-24j).

**Objectif beta :** 85-90% d'auto-catégorisation, modulé par tier :
- Tier 1 (Micro) : 95%+ (quasi tout auto-appliqué, charges non déductibles)
- Tier 2 (EI réel) : 85-90%
- Tier 3 (IS sans EC) : 80-85% (plus prudent)
- Tier 4 (Avec EC) : 90%+ (permissif car l'EC valide)

**Principes conservés du plan initial :**
- `confirmed` reste interdit pour l'IA seule
- Toute catégorisation auto-appliquée = tracée, corrigeable, mesurée
- Correction > 5% = alerte et resserrage

**Ce qui change :**
- Plus de green/gray_capped/red — remplacé par le tier
- Plus de seuils repas 80€ / marchand mixte 150€ — supprimés
- Plus de `BankCategorySignalPolicy` — reportée post-beta
- Le seuil de confiance IA varie par tier (70%→90%) au lieu d'un seuil unique

---

## Key Changes

### 1. Onboarding Profil Entreprise (NOUVEAU)

**Migration Prisma :**

```
model Company {
  // Champs existants...
  
  // Nouveaux champs onboarding
  companyType       CompanyType       // MICRO, EI_REEL, SAS, SARL, SCI, LMNP
  taxRegime         TaxRegime         // MICRO_BIC, MICRO_BNC, BNC_REEL, BIC_REEL_SIMPLIFIE, IS_REEL_SIMPLIFIE, SCI_IR, SCI_IS, LMNP_REEL
  vatRegime         VatRegime         // FRANCHISE, CA12, CA3_TRIM, CA3_MENS
  hasAccountant     Boolean           @default(false)
  accountantEmail   String?
  companyTier       CompanyTier       // TIER_1_MICRO, TIER_2_EI_REEL, TIER_3_IS_SANS_EC, TIER_4_AVEC_EC
  taxFormSet        String[]          // ["2065", "2033-A", "2033-B", ...] — dérivé automatiquement
  fecRequired       Boolean           // dérivé : true sauf micro et SCI IR compta manuelle
  bilanRequired     Boolean           // dérivé : true sauf micro, BNC réel, SCI IR
  revenueEstimate   RevenueRange?     // UNDER_77K, 77K_TO_300K, OVER_300K — optionnel
}

enum CompanyType {
  MICRO
  EI_REEL
  SAS
  SARL
  SCI
  LMNP
}

enum CompanyTier {
  TIER_1_MICRO
  TIER_2_EI_REEL
  TIER_3_IS_SANS_EC
  TIER_4_AVEC_EC
}

enum TaxRegime {
  MICRO_BIC
  MICRO_BNC
  BNC_REEL
  BIC_REEL_SIMPLIFIE
  IS_REEL_SIMPLIFIE
  SCI_IR
  SCI_IS
  LMNP_REEL
}

enum VatRegime {
  FRANCHISE
  CA12
  CA3_TRIM
  CA3_MENS
}

enum RevenueRange {
  UNDER_77K
  FROM_77K_TO_300K
  OVER_300K
}
```

**Algorithme de dérivation du tier :**

```typescript
function deriveCompanyTier(company: {
  companyType: CompanyType;
  taxRegime: TaxRegime;
  hasAccountant: boolean;
}): CompanyTier {
  if (company.companyType === "MICRO") return "TIER_1_MICRO";
  if (company.hasAccountant) return "TIER_4_AVEC_EC";
  if (["IS_REEL_SIMPLIFIE", "SCI_IS"].includes(company.taxRegime)) return "TIER_3_IS_SANS_EC";
  return "TIER_2_EI_REEL";
}
```

**Dérivation du taxFormSet :**

```typescript
const TAX_FORM_MAP: Record<TaxRegime, string[]> = {
  MICRO_BIC: ["2042-C-Pro"],
  MICRO_BNC: ["2042-C-Pro"],
  BNC_REEL: ["2035", "2035-A", "2035-B"],
  BIC_REEL_SIMPLIFIE: ["2031", "2033-A", "2033-B", "2033-C", "2033-D", "2033-E", "2033-F", "2033-G"],
  IS_REEL_SIMPLIFIE: ["2065", "2033-A", "2033-B", "2033-C", "2033-D", "2033-E", "2033-F", "2033-G"],
  SCI_IR: ["2072", "2044"],
  SCI_IS: ["2065", "2033-A", "2033-B", "2033-C", "2033-D", "2033-E", "2033-F", "2033-G"],
  LMNP_REEL: ["2031", "2033-A", "2033-B", "2033-C", "2033-D", "2033-E", "2033-F", "2033-G"],
};
```

**UI onboarding :** multi-step form Polaris, 9 étapes (voir cadrage §5.2). Lookup SIREN via API Sirene (INSEE) pour pré-remplissage.

### 2. Policy Par Tier — Remplace AutoApplyReliabilityPolicy (MODIFIÉ)

**Supprimé :**
- `AutoApplyReliabilityPolicy` (9 conditions)
- `CategorizationRiskZonePolicy` (green/gray_capped/red)
- `BankCategorySignalPolicy`
- Seuils repas 80€ TTC, marchand mixte 150€ TTC
- Types `CategorizationRiskZone`, `BankCategorySignal`

**Remplacé par : `TieredCategorizationPolicy`**

La policy prend en entrée le `companyTier` et la suggestion IA, et décide de la résolution.

**Blacklist commune (toutes transactions, tous tiers) :**

| # | Règle | Détection | Action |
|---|-------|-----------|--------|
| 1 | Opération intracommunautaire | Devise ≠ EUR OU TVA intra (préfixe pays ≠ FR) OU mention "intra" | `NEEDS_REVIEW` |
| 2 | Immobilisation potentielle ≥ 500€ HT | Montant ≥ 500€ HT ET catégorie IA = classe 2 | `REVIEW_LIGHT` |
| 3 | Charge personnelle détectée | Catégorie IA = charge perso OU compte 108xxx | `NEEDS_REVIEW` |
| 4 | Avoir / note de crédit | Montant négatif ET source ≠ virement entrant | `REVIEW_LIGHT` |

**Extensions Tier 3 uniquement :**

| # | Règle | Action |
|---|-------|--------|
| 5 | Provision / charge à payer | `NEEDS_REVIEW` |
| 6 | Charge exceptionnelle > 1000€ HT | `NEEDS_REVIEW` |

**Modulation par tier :**

| Tier | Seuil confiance IA | Blacklist active | Si confiance < seuil |
|------|---------------------|-----------------|---------------------|
| Tier 1 — Micro | ≥ 70% | Règles 1 + 3 | `AUTO_APPLY` + flag "vérifié par IA" |
| Tier 2 — EI réel | ≥ 85% | Règles 1-4 | `REVIEW_LIGHT` (suggestion duale) |
| Tier 3 — IS sans EC | ≥ 90% | Règles 1-6 | `NEEDS_REVIEW` |
| Tier 4 — Avec EC | ≥ 80% | Règles 1-4 | `AUTO_APPLY` + flag "à valider par EC" |

**Config centralisée (conservée du plan initial) :**

```
AUTO_APPLY_FIXED_ASSET_THRESHOLD_EUR=500
AUTO_APPLY_CORRECTION_ALERT_RATE=0.05
AUTO_APPLY_EXCEPTIONAL_CHARGE_THRESHOLD_EUR=1000  # Tier 3 uniquement
```

### 3. Vendor Mappings & Mémoire Inter-Exercice (CONSERVÉ)

**Étendre `vendor-mapping-definitions` à 100-150 patterns.** Inchangé par rapport au plan initial.

Familles prioritaires :
- Télécom : Orange, SFR, Bouygues, Free, OVH, Gandi
- Banque : BNP, SG, CA, LCL, Boursorama, Revolut, N26, Wise, Qonto
- Assurance : Allianz, MAIF, MACIF, Groupama, MMA, Matmut
- Restauration : Deliveroo, UberEats, JustEat, McDonald's, Starbucks, Paul
- Fournitures : Fnac, Darty, Boulanger, IKEA, Leroy Merlin, Bureau Vallée
- Transport : TotalEnergies, Shell, BP, SNCF, Blablacar, Lime, Bolt
- Poste : La Poste, Colissimo, Chronopost, DHL, FedEx, UPS
- Publicité : Google Ads, Meta Ads, LinkedIn Ads
- Juridique : Legalstart, Captain Contrat
- SaaS : Notion, Slack, Figma, Canva, Adobe, Zoom, Microsoft 365
- Coworking : WeWork, Morning, Wojo, Regus
- Impôts/taxes : DGFIP, Trésor Public, CFE patterns

**Validation des mappings :** compte PCG existant, TVA cohérente. Aucun mapping sensible auto-appliqué sans justification.

**Correction rules cross-exercice (CONSERVÉ) :**
- Règles de l'exercice courant prioritaires
- Règles actives des exercices de la même entreprise utilisables si non contradictoires
- Conflit inter-exercice = pas d'auto-application, passage en `REVIEW_LIGHT`
- Pas de migration Prisma : lecture directe des CorrectionRule des autres exercices de la même Company

### 4. Adaptation Outputs Par Profil (NOUVEAU)

**Conditionner la génération de documents par `taxFormSet` :**

| Module Qitus | Condition d'activation |
|-------------|----------------------|
| Génération FEC | `fecRequired === true` |
| Génération bilan | `bilanRequired === true` |
| Génération compte de résultat | `bilanRequired === true` (couplé) |
| Templates liasse fiscale | Selon `taxFormSet` (2033 vs 2035 vs 2072) |
| Module TVA | `vatRegime !== FRANCHISE` |
| Module amortissements | `companyType === LMNP` OU `taxRegime` ∈ {BIC, IS} |

**Templates CERFA à vérifier/créer :**
- 2035 + 2035-A/B (BNC) — à vérifier si présent dans le repo
- 2072 + 2044 (SCI IR) — à vérifier si présent dans le repo
- 2042-C Pro (Micro) — récapitulatif simplifié
- 2033-A à G + 2065 (IS/BIC réel simplifié) — probablement déjà supporté

### 5. Catégorisation IA Contextualisée (NOUVEAU)

**Injecter le profil dans le prompt IA :**

Le prompt de catégorisation doit recevoir :
```
Profil entreprise : {companyType} / {taxRegime}
Plan de comptes applicable : {pcg_variant}
Tier : {companyTier}
```

**Variants PCG :**

| Profil | PCG / plan de comptes |
|--------|----------------------|
| Micro | Catégories simplifiées (8-12 catégories en langage naturel). Mapping PCG silencieux en base |
| BNC réel | PCG adapté BNC (nomenclature 2035). Comptes spécifiques : 6226, 6231, etc. |
| BIC / IS | PCG standard (cas de base actuel) |
| SCI IR | Catégories foncières (loyers, charges copro, travaux, intérêts, assurance, taxe foncière) |
| LMNP | PCG simplifié BIC + comptes amortissements |

**Catégories simplifiées Tier 1 (Micro) — proposition initiale :**

| Catégorie affichée | Compte PCG interne | Icône |
|--------------------|--------------------|-------|
| Achats marchandises | 607 | 📦 |
| Frais de déplacement | 6251 | 🚗 |
| Télécom & Internet | 6262 | 📱 |
| Logiciels & abonnements | 6135 | 💻 |
| Assurance | 6163 | 🛡️ |
| Cotisations sociales (URSSAF) | 6451 | 📋 |
| Frais bancaires | 627 | 🏦 |
| Fournitures | 6063 | 🖊️ |
| Loyer & charges | 613 | 🏢 |
| Honoraires | 6226 | 👤 |
| Restauration | 6256 | 🍽️ |
| Divers | 6288 | 📎 |

Liste à valider avec beta-testeurs micro (OD-3).

### 6. UX, Traçabilité & Monitoring (CONSERVÉ + FUSIONNÉ)

**UX — conservé du plan initial :**

- Transactions `AUTO_APPLIED` hors compteurs "à valider"
- Justification courte visible : `Appliqué automatiquement — [justification]. Corrigeable.`
- Exemple : `Orange — Télécommunications — catégorisé automatiquement, corrigeable.`
- Pour Tier 4 : `Orange — Télécommunications — catégorisé automatiquement, à valider par votre EC.`

**Activité — conservé du plan initial :**

- `transaction.auto_applied` — catégorisation automatique appliquée
- `transaction.review_light` — suggestion duale proposée
- `transaction.user_corrected_auto_applied` — correction d'une auto-application
- `transaction.ec_validated` (NOUVEAU — Tier 4) — EC a validé la catégorisation

**Monitoring — fusionné cadrage §7 + plan initial §4 :**

`CategorizationAutomationMetricsCenter` :

| Métrique | Granularité | Seuil d'alerte |
|----------|------------|---------------|
| Taux `auto_applied` | Par tier | < 95% (Tier 1), < 85% (Tier 2), < 80% (Tier 3), < 90% (Tier 4) |
| Taux `review_light` | Par tier | — (informatif) |
| Taux `needs_review` | Par tier | > 15% (Tier 1), > 25% (Tier 2), > 30% (Tier 3) |
| Hit rate CorrectionRule | Global | — (informatif) |
| Hit rate VendorMapping | Global | — (informatif) |
| Hit rate IA | Par tier | — (informatif) |
| Taux correction des AUTO_APPLIED | Par tier | **> 5% = alerte + resserrage policy** |
| Confiance IA moyenne | Par tier | < 75% = investiguer qualité libellés |
| Transactions > 30j sans catégorisation | Global | > 10 = notification utilisateur |

**Règles beta — conservé :**
- Correction > 5% = alerte et resserrage policy immédiat
- Correction < 2% = policy candidate à élargir post-beta (pas dans ce plan)

**API interne — conservé :**
- `GET /api/categorization/automation-metrics`

### 7. Mise À Jour Docs (CONSERVÉ)

- `ROADMAP.md` : Phase 5 = "Auto-catégorisation par profil entreprise"
- `gap-analysis-automatisation-categorisation.md` : marquer comme supersédé par ce plan V2 pour la Phase A. Phases B/C restent valides comme roadmap post-beta.
- `qitus-guide-utilisateur.md` : remplacer "l'IA ne crée jamais d'écriture" par "Qitus catégorise automatiquement selon votre profil, toujours corrigeable"
- `cadrage-rgpd-qitus.md` : documenter la collecte onboarding (SIREN, forme juridique, régime) — base légale = exécution du contrat (art. 6.1.b RGPD)

---

## Public Interfaces / Types

**Nouveaux types :**
- `CompanyType` (enum, voir §1)
- `CompanyTier` (enum, voir §1)
- `TaxRegime` (enum, voir §1)
- `VatRegime` (enum, voir §1)
- `RevenueRange` (enum, voir §1)
- `CategorizationAutomationMetrics` (conservé)
- `TieredCategorizationPolicy` (remplace `AutoApplyReliabilityPolicy`)

**Types supprimés :**
- `CategorizationRiskZone` (green/gray_capped/red) — remplacé par tier
- `BankCategorySignal` — reporté post-beta

**Config centralisée :**
- `AUTO_APPLY_FIXED_ASSET_THRESHOLD_EUR=500`
- `AUTO_APPLY_CORRECTION_ALERT_RATE=0.05`
- `AUTO_APPLY_EXCEPTIONAL_CHARGE_THRESHOLD_EUR=1000`

**Config supprimée :**
- `AUTO_APPLY_MEAL_MAX_EUR` — supprimé
- `AUTO_APPLY_MIXED_VENDOR_MAX_EUR` — supprimé

---

## Test Plan V2

### Unit tests — TieredCategorizationPolicy

**Tier 1 — Micro (seuil 70%) :**

| # | Cas | Entrée | Résultat attendu |
|---|-----|--------|-----------------|
| T1-1 | IA HIGH, charge courante | confidence=92%, compte=6262 | `AUTO_APPLIED` |
| T1-2 | IA MEDIUM, charge courante | confidence=75%, compte=6063 | `AUTO_APPLIED` (≥70%) |
| T1-3 | IA LOW | confidence=45%, compte=6288 | `AUTO_APPLIED` (≥70% pas atteint) → quand même `AUTO_APPLIED` car 45% < 70% → `REVIEW_LIGHT` |
| T1-4 | Charge perso détectée (blacklist #3) | confidence=95%, compte=108 | `NEEDS_REVIEW` |
| T1-5 | Intracommunautaire (blacklist #1) | confidence=95%, devise=USD | `NEEDS_REVIEW` |
| T1-6 | Immobilisation ≥ 500€ (blacklist #2) | confidence=95%, montant=800€, classe 2 | `AUTO_APPLIED` (règle 2 inactive en Tier 1) |
| T1-7 | Avoir (blacklist #4) | montant=-50€ | `AUTO_APPLIED` (règle 4 inactive en Tier 1) |

**Tier 2 — EI réel (seuil 85%) :**

| # | Cas | Entrée | Résultat attendu |
|---|-----|--------|-----------------|
| T2-1 | IA HIGH, charge courante | confidence=92%, compte=6262 | `AUTO_APPLIED` |
| T2-2 | IA confiance 80% (< seuil) | confidence=80%, compte=6063 | `REVIEW_LIGHT` (suggestion duale) |
| T2-3 | Immobilisation ≥ 500€ HT | confidence=95%, montant=800€ HT, classe 2 | `REVIEW_LIGHT` (blacklist #2 active) |
| T2-4 | Avoir | montant=-120€ | `REVIEW_LIGHT` (blacklist #4 active) |
| T2-5 | Charge perso | confidence=95%, compte=108 | `NEEDS_REVIEW` |
| T2-6 | Intracommunautaire | confidence=95%, devise=GBP | `NEEDS_REVIEW` |

**Tier 3 — IS sans EC (seuil 90%) :**

| # | Cas | Entrée | Résultat attendu |
|---|-----|--------|-----------------|
| T3-1 | IA HIGH, charge courante | confidence=95%, compte=6262 | `AUTO_APPLIED` |
| T3-2 | IA confiance 87% (< seuil) | confidence=87%, compte=6135 | `NEEDS_REVIEW` |
| T3-3 | Provision détectée (extension #5) | confidence=95%, compte=15xx | `NEEDS_REVIEW` |
| T3-4 | Charge exceptionnelle > 1000€ HT (extension #6) | confidence=95%, montant=2500€ HT | `NEEDS_REVIEW` |
| T3-5 | Charge courante 900€ HT (< 1000€) | confidence=95%, montant=900€ HT, compte=606 | `AUTO_APPLIED` |

**Tier 4 — Avec EC (seuil 80%) :**

| # | Cas | Entrée | Résultat attendu |
|---|-----|--------|-----------------|
| T4-1 | IA HIGH, charge courante | confidence=92%, compte=6262 | `AUTO_APPLIED` + flag "à valider par EC" |
| T4-2 | IA confiance 75% (< seuil) | confidence=75%, compte=6288 | `AUTO_APPLIED` + flag "à valider par EC" — attendu? Non → `REVIEW_LIGHT` car < 80% |
| T4-3 | Immobilisation ≥ 500€ | confidence=95%, montant=1200€ HT, classe 2 | `REVIEW_LIGHT` |
| T4-4 | Charge perso | confidence=95%, compte=108 | `NEEDS_REVIEW` |

### Unit tests — Blacklist rules

| # | Règle | Cas positif (déclenche) | Cas négatif (ne déclenche pas) |
|---|-------|------------------------|-------------------------------|
| BL-1 | Intracommunautaire | devise=USD ; TVA intra DE ; libellé contient "intra" | devise=EUR, TVA FR, pas de mention |
| BL-2 | Immobilisation ≥ 500€ HT | montant=600€ HT + catégorie IA classe 2 | montant=600€ HT + catégorie IA classe 6 ; montant=400€ HT + classe 2 |
| BL-3 | Charge perso | catégorie="charge personnelle" ; compte=10800 | catégorie="fournitures bureau" |
| BL-4 | Avoir | montant=-150€, source≠virement entrant | montant=-150€, source=virement entrant ; montant=+150€ |
| BL-5 | Provision (Tier 3) | compte=15xx ou 48xx | compte=606x |
| BL-6 | Charge exceptionnelle > 1000€ (Tier 3) | montant=1500€ HT, catégorie IA=671 | montant=800€ HT ; montant=1500€ mais catégorie=606 (charge courante) |

### Unit tests — Vendor mappings

| # | Cas | Entrée | Résultat attendu |
|---|-----|--------|-----------------|
| VM-1 | Mapping existant valide | counterparty="ORANGE SA" | Compte 6262, confiance HIGH, pas d'IA appelée |
| VM-2 | Mapping PCG inexistant | mapping pointe vers compte supprimé | Erreur de validation, fallback sur IA |
| VM-3 | Mapping TVA incohérente | mapping télécom avec TVA 5.5% | Erreur de validation |

### Unit tests — Cross-exercice

| # | Cas | Résultat attendu |
|---|-----|-----------------|
| CE-1 | Règle exercice courant existe | Appliquer règle courante |
| CE-2 | Pas de règle courante, règle exercice N-1 existe, non contradictoire | Appliquer règle N-1 |
| CE-3 | Règle N vs règle N-1 contradictoires (comptes différents) | `REVIEW_LIGHT`, pas d'auto-apply |
| CE-4 | Règle N-1 existe, exercice courant a un plan comptable différent, compte N-1 inexistant | Ignorer règle N-1, fallback IA |

### Unit tests — Onboarding dérivation

| # | Entrée | Tier attendu | taxFormSet attendu |
|---|--------|-------------|-------------------|
| OB-1 | companyType=MICRO | TIER_1_MICRO | ["2042-C-Pro"] |
| OB-2 | companyType=EI_REEL, taxRegime=BNC_REEL, hasAccountant=false | TIER_2_EI_REEL | ["2035", "2035-A", "2035-B"] |
| OB-3 | companyType=SAS, taxRegime=IS_REEL_SIMPLIFIE, hasAccountant=false | TIER_3_IS_SANS_EC | ["2065", "2033-A"..."2033-G"] |
| OB-4 | companyType=SARL, taxRegime=IS_REEL_SIMPLIFIE, hasAccountant=true | TIER_4_AVEC_EC | ["2065", "2033-A"..."2033-G"] |
| OB-5 | companyType=SCI, taxRegime=SCI_IR, hasAccountant=false | TIER_2_EI_REEL | ["2072", "2044"] |
| OB-6 | companyType=LMNP, taxRegime=LMNP_REEL, hasAccountant=false | TIER_2_EI_REEL | ["2031", "2033-A"..."2033-G"] |

### Integration tests

| # | Scénario | Résultat attendu |
|---|----------|-----------------|
| INT-1 | Import transactions pour un Micro avec nouveaux mappings télécom/transport | Écritures auto-appliquées, aucune en NEEDS_REVIEW sauf perso/intra |
| INT-2 | Import transactions pour un EI réel BNC avec IA confiance 80% | Transactions en REVIEW_LIGHT (< seuil 85%) |
| INT-3 | Import transactions pour un IS sans EC avec provision détectée | Transaction provision en NEEDS_REVIEW |
| INT-4 | Import transactions pour un profil avec EC, IA confiance 82% | Auto-appliqué avec flag "à valider par EC" |
| INT-5 | Correction d'un AUTO_APPLIED | Règle mémorisée, activité tracée, métrique correction incrémentée |
| INT-6 | Dashboard transactions Tier 1 | AUTO_APPLIED hors compteurs "à valider" |
| INT-7 | Génération FEC pour un Micro | Pas de FEC généré (fecRequired=false) |
| INT-8 | Génération bilan pour un BNC réel | Pas de bilan généré (bilanRequired=false) |

### Validation scripts

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run validate:categorization-coverage` (conservé)
- `npm run validate:onboarding-derivation` (NOUVEAU — vérifie que chaque combinaison type×régime produit un tier et un taxFormSet valides)

---

## Séquencement

| Phase | Contenu | Effort | Dépendances |
|-------|---------|--------|-------------|
| **Phase 1** | Onboarding profil : migration Prisma, UI multi-step, dérivation tier + taxFormSet | 3-4j | — |
| **Phase 2** | TieredCategorizationPolicy : remplacer CategorizationTrustPolicy, 4 règles blacklist, modulation par tier | 2-3j | Phase 1 (besoin du tier) |
| **Phase 3** | Vendor mappings 100-150 + correction rules cross-exercice | 3-4j | — (parallélisable avec Phase 1) |
| **Phase 4** | Adaptation outputs : conditionner FEC, bilan, liasse par taxFormSet. Vérifier/créer templates 2035, 2072 | 5-8j | Phase 1 |
| **Phase 5** | Catégorisation contextualisée : profil dans prompt IA, variant PCG micro, catégories simplifiées | 2-3j | Phase 1 + Phase 2 |
| **Phase 6** | UX, traçabilité, monitoring : justifications, activité, MetricsCenter, API admin | 2-3j | Phase 2 |
| **Phase 7** | Mise à jour docs : ROADMAP, guide utilisateur, RGPD | 1j | Toutes |
| **Total** | | **17-24j** | |

**Chemin critique :** Phase 1 → Phase 2 → Phase 5 (8-10j). Les phases 3, 4, 6 sont parallélisables.

**Comparaison avec le plan initial :**

| | Plan initial | Plan V2 |
|-|-------------|---------|
| Effort total | 53-80j (Phase A seule : 8-12j + policy : ?) | 17-24j |
| Complexité policy | 9 conditions + 3 sous-policies + 3 seuils | 4 règles blacklist + 1 seuil par tier |
| Différenciation par profil | Non | Oui (6 types × 4 tiers) |
| Documents adaptés par régime | Non | Oui |
| Tests | ~15 cas (ancienne policy) | ~35 cas (couvrent les 4 tiers) |

---

## Assumptions

- Les 6 types juridiques V1 couvrent ~95% du marché cible. SCM et Indivision ajoutés post-beta si demande.
- Le régime réel normal (2050-2059) n'est pas supporté en V1 — les entreprises > 840K€ CA BIC ont un EC.
- Le seuil 500€ HT pour immobilisation reste un seuil produit conservateur (tolérance administrative BOFiP).
- Le cross-exercice des CorrectionRule se fait sans migration Prisma.
- Les catégories simplifiées Tier 1 sont une proposition à valider avec beta-testeurs.
- Phase B/C du gap analysis (récurrence, détection revenus, suggestions LOW) restent roadmap post-beta.
- La sourceCategory bancaire (signal Bridge/Powens) est reportée post-beta.

---

## Éléments explicitement abandonnés (vs plan initial)

| Élément | Raison |
|---------|--------|
| `CategorizationRiskZone` (green/gray_capped/red) | Remplacé par le concept de tier — plus simple, même couverture |
| `BankCategorySignalPolicy` | Complexité disproportionnée vs gain. Signal bancaire = post-beta |
| Seuil repas 80€ TTC | Le tier module la prudence, pas la nature de la dépense |
| Seuil marchand mixte 150€ TTC | Idem |
| Zone grise plafonnée comme concept | Le tier fait le travail : en micro tout passe (pas d'impact fiscal), en IS sans EC tout est strict |
