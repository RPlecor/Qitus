# Plan V3 — Auto-Catégorisation Par Profil Entreprise

**Date :** 2026-05-25  
**Statut :** V3 — version exécutable, post-revue architecturale  
**Priorité :** P0 beta  
**Objectif :** 85-90% d'auto-catégorisation avant beta ouverte  
**Effort estimé :** 8-12j (chemin critique 5-7j)

---

## 1. Contexte et arbitrages

Le plan V2 posait la bonne stratégie (catégorisation modulée par profil entreprise) mais embarquait trop de périmètre pour un bloc P0 et proposait un remplacement architectural inadapté. Cette V3 intègre les corrections issues de la revue.

### Décisions prises

| # | Sujet | V2 | V3 (décision finale) |
|---|-------|-----|---------------------|
| D-1 | Architecture policy | Remplacer `AutoApplyReliabilityPolicy` par `TieredCategorizationPolicy` | **Configurer `AutoApplyReliabilityPolicy` par tier.** La policy existante (260 lignes, validations PCG/TVA/historique/immobilisations/comptes sensibles) est conservée. Le tier paramètre le seuil de confiance et les exclusions. Pas de réécriture. |
| D-2 | Enums Prisma | Nouveaux enums `CompanyType`, `TaxRegime`, `VatRegime` | **Utiliser les champs existants** (`Company.legalForm`, `Company.incomeRegime`, `Company.vatRegime`). Créer un `CompanyProfileClassificationCenter` qui dérive le tier. Ajouter uniquement `hasAccountant`, `accountantEmail`, `revenueEstimate`. |
| D-3 | Scope P0 | 7 phases incluant documents fiscaux, liasses, RGPD | **Recentrer sur l'automatisation.** Documents fiscaux par régime → P1 (Masterplan fiscal). Catégories simplifiées micro → post-beta. RGPD onboarding → background. |
| D-4 | Blacklist vs garde-fous existants | 4-rule blacklist remplace tout | **La blacklist s'ajoute aux validations structurelles existantes.** `AutoApplyReliabilityPolicy` conserve ses contrôles (PCG validé, postable, TVA simple, pas de compte d'attente, pas de correction contradictoire, pas de compte sensible). Le tier module les seuils, il ne court-circuite pas les invariants. |
| D-5 | Score de confiance numérique | Seuils 70/85/90 | **Mapping convention : HIGH→95, MEDIUM→70, LOW→40.** Suffisant pour la beta. Score numérique natif = post-beta si nécessaire. |
| D-6 | Tier 4 sans workflow EC actif | Seuil 80%, permissif | **Fallback : Tier 4 = Tier 2 (seuil 85%) tant que le workflow de validation EC n'est pas actif.** Quand le workflow EC est livré, le seuil descend à 80% + flag "à valider par EC". |
| D-7 | Immobilisations Tier 1 micro | Règle #2 inactive (auto-apply autorisé) | **Conservé.** La précondition `isPotentialFixedAsset` dans `AutoApplyReliabilityPolicy` bloque déjà les comptes classe 2. Pour les micros sans comptes classe 2 dans leur plan, le scénario ne se produit pas. Si l'IA propose un compte classe 2 à un micro, la validation PCG le bloque en amont. |
| D-8 | Test T1-3 | Contradictoire (45% < 70% marqué AUTO_APPLIED) | **Corrigé : 45% < 70% = `REVIEW_LIGHT`.** |

### Éléments sortis du P0

| Élément | Destination | Raison |
|---------|-------------|--------|
| Documents fiscaux par régime (FEC conditionnel, bilan conditionnel, liasses) | P1 — Masterplan fiscal | N'impacte pas le pipeline de catégorisation |
| Templates 2035/2072/2042-C Pro | P1 — Masterplan fiscal | Output, pas pipeline |
| Catégories simplifiées micro (UX) | Post-beta | Le PCG standard fonctionne en attendant |
| sourceCategory bancaire | Post-beta | Complexité disproportionnée vs gain |
| RGPD onboarding | Background | Non bloquant |
| Workflow de validation EC | Post-beta | Prérequis pour Tier 4 pleinement permissif |

---

## 2. Diagnostic du bloquant actuel

L'`AutoApplyReliabilityPolicy` existante (`app/modules/accounting-reference/auto-apply-reliability-policy.server.ts`) est bien construite. Elle vérifie : source IA, confiance, PCG validé, TVA simple, pas de correction contradictoire, pas d'immobilisation, pas de compte sensible, historique fournisseur cohérent, montant cohérent.

**Les deux verrous qui bloquent l'automatisation :**

1. **Ligne 100 — Confiance IA :** `if (input.suggestion.confidence !== "HIGH") reasons.push(...)` → Toute suggestion non-HIGH est rejetée en NEEDS_REVIEW. Pour un micro-entrepreneur, c'est excessif : une confiance MEDIUM sur "Orange → Télécom" ne présente aucun risque fiscal (charges non déductibles en micro).

2. **Ligne 134 — Historique fournisseur :** `if (coherentHistory.length < MINIMUM_HISTORY_MATCHES)` → Tout fournisseur avec < 2 occurrences validées passe en REVIEW_LIGHT. Pour un nouvel utilisateur, TOUTES les transactions sont en REVIEW_LIGHT au premier import, même avec des vendor mappings fiables + IA HIGH. C'est le facteur principal du 55-70% actuel.

**Le tier résout les deux :** pour un micro, le seuil de confiance descend et l'exigence d'historique s'assouplit. Pour un IS sans EC, les deux restent stricts.

---

## 3. Architecture technique

### 3.1 CompanyProfileClassificationCenter (NOUVEAU)

Un Center qui dérive le tier et les obligations depuis les champs `Company` existants.

```typescript
// app/modules/company-profile/company-profile-classification-center.server.ts

import type { Company } from "@prisma/client";

export type CompanyTier = "TIER_1_MICRO" | "TIER_2_EI_REEL" | "TIER_3_IS_SANS_EC" | "TIER_4_AVEC_EC";

export type CompanyProfileClassification = {
  tier: CompanyTier;
  fecRequired: boolean;
  bilanRequired: boolean;
  taxFormSet: string[];
  confidenceThreshold: number;      // seuil numérique pour auto-apply
  minHistoryMatches: number;         // historique fournisseur minimum
  blacklistExtensions: string[];     // exclusions additionnelles par tier
};

export function classifyCompanyProfile(company: Company): CompanyProfileClassification {
  const tier = deriveCompanyTier(company);
  return {
    tier,
    fecRequired: deriveFecRequired(company),
    bilanRequired: deriveBilanRequired(company),
    taxFormSet: deriveTaxFormSet(company),
    ...tierConfig(tier, company),
  };
}

function deriveCompanyTier(company: Company): CompanyTier {
  if (company.legalForm === "AUTO_ENTREPRENEUR") return "TIER_1_MICRO";
  if (isMicroRegime(company.incomeRegime)) return "TIER_1_MICRO";
  if (company.hasAccountant) return "TIER_4_AVEC_EC";
  if (isISRegime(company.incomeRegime)) return "TIER_3_IS_SANS_EC";
  return "TIER_2_EI_REEL";
}

function tierConfig(tier: CompanyTier, company: Company) {
  switch (tier) {
    case "TIER_1_MICRO":
      return {
        confidenceThreshold: 40,          // LOW suffit (70→40 mapped) — pas d'impact fiscal
        minHistoryMatches: 0,              // pas besoin d'historique
        blacklistExtensions: [],           // seulement règles 1+3 (intra + perso)
      };
    case "TIER_2_EI_REEL":
      return {
        confidenceThreshold: 70,          // MEDIUM suffit (85→70 mapped)
        minHistoryMatches: 1,              // 1 occurrence suffit
        blacklistExtensions: [],           // règles 1-4
      };
    case "TIER_3_IS_SANS_EC":
      return {
        confidenceThreshold: 95,          // HIGH obligatoire (90→95 mapped)
        minHistoryMatches: 2,              // comportement actuel conservé
        blacklistExtensions: ["provision", "exceptional_charge_over_1000"],
      };
    case "TIER_4_AVEC_EC":
      // Fallback Tier 2 tant que workflow EC inactif
      return {
        confidenceThreshold: 70,          // sera abaissé à 40 quand workflow EC actif
        minHistoryMatches: 1,
        blacklistExtensions: [],
      };
  }
}
```

**Migration Prisma minimale :**

```prisma
model Company {
  // Champs existants conservés : legalForm, incomeRegime, vatRegime
  
  // Nouveaux champs uniquement
  hasAccountant     Boolean   @default(false)
  accountantEmail   String?
  revenueEstimate   String?   // "UNDER_77K" | "77K_TO_300K" | "OVER_300K"
}
```

3 champs ajoutés, 0 enum parallèle.

### 3.2 Modifications de AutoApplyReliabilityPolicy

L'interface publique ne change pas. L'input reçoit un paramètre supplémentaire : le `CompanyProfileClassification`.

**Changement 1 — Seuil de confiance paramétré (ligne 100) :**

```typescript
// Avant :
if (input.suggestion.confidence !== "HIGH") reasons.push("Confiance IA insuffisante.");

// Après :
const confidenceScore = mapConfidence(input.suggestion.confidence); // HIGH→95, MEDIUM→70, LOW→40
if (confidenceScore < input.profile.confidenceThreshold) {
  reasons.push("Confiance IA insuffisante pour ce profil.");
}
```

**Changement 2 — Historique fournisseur paramétré (ligne 134) :**

```typescript
// Avant :
if (coherentHistory.length < MINIMUM_HISTORY_MATCHES) lightReasons.push(...)

// Après :
if (coherentHistory.length < input.profile.minHistoryMatches) lightReasons.push(...)
```

**Changement 3 — Extensions blacklist Tier 3 (après ligne 117) :**

```typescript
if (input.profile.blacklistExtensions.includes("provision") && isProvisionAccount(input.suggestion)) {
  exclusions.push("provision");
  reasons.push("Provision — validation requise pour IS.");
}
if (input.profile.blacklistExtensions.includes("exceptional_charge_over_1000")
    && isExceptionalCharge(input.suggestion)
    && Math.abs(input.transaction?.amount ?? 0) > 1000) {
  exclusions.push("exceptional_charge");
  reasons.push("Charge exceptionnelle > 1000€ — validation requise pour IS.");
}
```

**Changement 4 — Immobilisation conditionnelle (Tier 1) :**

Pour les micros, `isPotentialFixedAsset` reste actif mais les comptes classe 2 ne sont pas dans leur plan comptable. Si l'IA propose un compte classe 2, la validation PCG le bloque en amont. Pas de modification nécessaire ici.

**Changement 5 — Préconditions explicites :**

Documenter en commentaire que les invariants suivants sont assurés AVANT l'appel à la policy (par `AccountingAssignmentValidationPolicy`) :
- Compte PCG validé et postable
- Pas de compte d'attente
- TVA structurellement cohérente
- `confirmed` interdit pour l'IA (géré par `CategorizationTrustPolicy`)

### 3.3 Vendor mappings étendu (CONSERVÉ du V2)

Étendre `vendor-mapping-definitions.ts` de 33 à 100-150 patterns. Familles :

| Famille | Exemples | Nombre estimé |
|---------|----------|--------------|
| Télécom | Orange, SFR, Bouygues, Free, OVH, Gandi | 8 |
| Banque | BNP, SG, CA, LCL, Boursorama, Revolut, N26, Wise, Qonto | 12 |
| Assurance | Allianz, MAIF, MACIF, Groupama, MMA, Matmut | 8 |
| Restauration | Deliveroo, UberEats, JustEat, McDonald's, Starbucks, Paul | 10 |
| Fournitures | Fnac, Darty, Boulanger, IKEA, Leroy Merlin, Bureau Vallée | 8 |
| Transport | TotalEnergies, Shell, BP, SNCF, Blablacar, Lime, Bolt | 10 |
| Poste | La Poste, Colissimo, Chronopost, DHL, FedEx, UPS | 8 |
| Publicité | Google Ads, Meta Ads, LinkedIn Ads | 4 |
| Juridique | Legalstart, Captain Contrat | 3 |
| SaaS | Notion, Slack, Figma, Canva, Adobe, Zoom, M365, GitHub, AWS | 15 |
| Coworking | WeWork, Morning, Wojo, Regus | 5 |
| Impôts | DGFIP, Trésor Public, CFE patterns | 5 |
| Cotisations | URSSAF, CIPAV, CNBF, CARMF, MSA | 6 |
| Énergie | EDF, Engie, TotalEnergies (gaz) | 4 |

Validation systématique : compte PCG existant + TVA cohérente. Tout mapping avec compte sensible (classe 2, 15, 16, 44, 67-69, 77-79) = exclu de l'auto-apply.

### 3.4 Correction rules cross-exercice (CONSERVÉ du V2)

Modifier la lecture des `CorrectionRule` pour inclure les exercices antérieurs de la même `Company` :

- Règles de l'exercice courant = prioritaires
- Règles actives des exercices antérieurs = utilisables si non contradictoires
- Conflit (même fournisseur, comptes différents entre N et N-1) = `REVIEW_LIGHT`, pas d'auto-apply
- Pas de migration Prisma : requête Prisma `where: { companyId, fiscalYear: { not: current } }`

### 3.5 Prompt IA contextualisé

Ajouter au prompt de catégorisation :

```
Profil entreprise : {legalForm} / {incomeRegime}
Tier : {companyTier}
```

Impact : l'IA adapte ses propositions de comptes. Un BNC recevra des suggestions 2035-compatibles, un micro des charges simples, un IS des comptes adaptés au PCG standard.

Effort : 0.5j — ajout de 2 lignes au template de prompt.

### 3.6 CategorizationAutomationMetricsCenter (CONSERVÉ)

| Métrique | Granularité | Seuil d'alerte |
|----------|------------|---------------|
| Taux `AUTO_APPLIED` | Par tier | Tier 1 < 95%, Tier 2 < 85%, Tier 3 < 80%, Tier 4 < 90% |
| Taux `NEEDS_REVIEW` | Par tier | Tier 1 > 15%, Tier 2 > 25%, Tier 3 > 30% |
| Taux correction des AUTO_APPLIED | Par tier | **> 5% = alerte + resserrage** |
| Confiance IA moyenne | Par tier | < 75% = investiguer qualité libellés |
| Transactions > 30j sans catégorisation | Global | > 10 = notification utilisateur |

API interne : `GET /api/categorization/automation-metrics`

Règles beta :
- Correction > 5% = alerte immédiate, resserrage du `confidenceThreshold` du tier concerné
- Correction < 2% = candidat à élargissement post-beta

---

## 4. UX et traçabilité

### Affichage transactions AUTO_APPLIED

- Hors compteurs "à valider"
- Justification courte : `Orange — Télécommunications — catégorisé automatiquement, corrigeable.`
- Tier 4 (quand actif) : `Orange — Télécommunications — catégorisé automatiquement, à valider par votre EC.`

### Activité

- `transaction.auto_applied` — catégorisation automatique appliquée
- `transaction.review_light` — suggestion duale proposée
- `transaction.user_corrected_auto_applied` — correction d'une auto-application

### Mise à jour docs

- `ROADMAP.md` : Phase 5 = "Auto-catégorisation par profil"
- `gap-analysis-automatisation-categorisation.md` : annoter "Phase A supersédée par plan-v3, Phases B/C restent roadmap post-beta"
- `qitus-guide-utilisateur.md` : remplacer "l'IA ne crée jamais d'écriture" par "Qitus catégorise automatiquement selon votre profil, toujours corrigeable"

---

## 5. Test plan

### Tests unitaires — AutoApplyReliabilityPolicy par tier

**Tier 1 — Micro :**

| # | Cas | Résultat attendu |
|---|-----|-----------------|
| T1-1 | IA HIGH (95), charge courante, pas d'historique | `AUTO_APPLIED` (95 ≥ 40, minHistory=0) |
| T1-2 | IA MEDIUM (70), charge courante, pas d'historique | `AUTO_APPLIED` (70 ≥ 40, minHistory=0) |
| T1-3 | IA LOW (40), charge courante | `AUTO_APPLIED` (40 ≥ 40, minHistory=0) |
| T1-4 | IA LOW (40), charge perso détectée | `NEEDS_REVIEW` (invariant : compte sensible 108xxx) |
| T1-5 | IA HIGH, intracommunautaire (devise USD) | `NEEDS_REVIEW` (invariant : TVA complexe) |

**Tier 2 — EI réel :**

| # | Cas | Résultat attendu |
|---|-----|-----------------|
| T2-1 | IA HIGH (95), charge courante, 1 occurrence historique | `AUTO_APPLIED` |
| T2-2 | IA MEDIUM (70), charge courante, 1 occurrence | `AUTO_APPLIED` (70 ≥ 70, minHistory=1) |
| T2-3 | IA MEDIUM (70), charge courante, 0 occurrence | `REVIEW_LIGHT` (historique < 1) |
| T2-4 | IA LOW (40), charge courante | `NEEDS_REVIEW` (40 < 70) |
| T2-5 | IA HIGH, immobilisation ≥ 500€ | `NEEDS_REVIEW` (invariant : isPotentialFixedAsset) |
| T2-6 | IA HIGH, correction contradictoire | `NEEDS_REVIEW` (invariant conservé) |

**Tier 3 — IS sans EC :**

| # | Cas | Résultat attendu |
|---|-----|-----------------|
| T3-1 | IA HIGH (95), charge courante, ≥ 2 occurrences | `AUTO_APPLIED` |
| T3-2 | IA HIGH (95), charge courante, 1 occurrence | `REVIEW_LIGHT` (historique < 2) |
| T3-3 | IA MEDIUM (70), charge courante | `NEEDS_REVIEW` (70 < 95) |
| T3-4 | IA HIGH, provision (compte 15xx) | `NEEDS_REVIEW` (extension Tier 3) |
| T3-5 | IA HIGH, charge exceptionnelle > 1000€ HT | `NEEDS_REVIEW` (extension Tier 3) |
| T3-6 | IA HIGH, charge courante 900€ HT | `AUTO_APPLIED` (< seuil 1000€) |

**Tier 4 — Avec EC (fallback Tier 2 tant que workflow EC inactif) :**

| # | Cas | Résultat attendu |
|---|-----|-----------------|
| T4-1 | IA HIGH (95), charge courante, 1 occurrence | `AUTO_APPLIED` (mêmes seuils Tier 2) |
| T4-2 | IA MEDIUM (70), charge courante, 0 occurrence | `REVIEW_LIGHT` (mêmes seuils Tier 2) |
| T4-3 | IA HIGH, charge perso | `NEEDS_REVIEW` (invariant) |

### Tests unitaires — CompanyProfileClassificationCenter

| # | Entrée (legalForm / incomeRegime / hasAccountant) | Tier attendu |
|---|--------------------------------------------------|-------------|
| OB-1 | AUTO_ENTREPRENEUR / null / false | TIER_1_MICRO |
| OB-2 | EI / "micro-BNC" / false | TIER_1_MICRO |
| OB-3 | EI / "BNC réel" / false | TIER_2_EI_REEL |
| OB-4 | SASU / "IS" / false | TIER_3_IS_SANS_EC |
| OB-5 | SARL / "IS" / true | TIER_4_AVEC_EC |
| OB-6 | SCI / "IR" / false | TIER_2_EI_REEL |
| OB-7 | SCI / "IS" / false | TIER_3_IS_SANS_EC |
| OB-8 | EI / "BIC réel simplifié" / true | TIER_4_AVEC_EC |

### Tests intégration

| # | Scénario | Résultat attendu |
|---|----------|-----------------|
| INT-1 | Import 50 transactions, profil Micro, vendor mappings étendus | ≥ 95% AUTO_APPLIED |
| INT-2 | Import 50 transactions, profil EI réel BNC, fournisseurs nouveaux, IA MEDIUM | Mix AUTO_APPLIED (si historique ≥ 1) + REVIEW_LIGHT |
| INT-3 | Import 50 transactions, profil IS sans EC | Comportement proche de l'actuel (seuils conservés) |
| INT-4 | Correction d'un AUTO_APPLIED → règle mémorisée, métrique incrémentée | OK |
| INT-5 | Dashboard : AUTO_APPLIED hors compteurs "à valider" | OK |
| INT-6 | Cross-exercice : règle N-1 non contradictoire appliquée | OK |
| INT-7 | Cross-exercice : conflit N vs N-1 | REVIEW_LIGHT |

### Validation

```bash
npm run typecheck
npm test
npm run build
npm run validate:categorization-coverage
```

---

## 6. Plan d'exécution

| Étape | Contenu | Effort | Parallélisable |
|-------|---------|--------|---------------|
| **E-1** | `CompanyProfileClassificationCenter` : dérivation tier depuis champs existants. Migration Prisma (+3 champs). | 2j | — |
| **E-2** | Modifier `AutoApplyReliabilityPolicy` : seuil confiance paramétré, historique paramétré, extensions Tier 3. Pas de réécriture — 4 points de modification dans le fichier existant. | 2-3j | Après E-1 |
| **E-3** | Vendor mappings : de 33 à 100-150 patterns + validation PCG/TVA | 2-3j | Parallèle E-1 |
| **E-4** | Cross-exercice correction rules : requête multi-exercice + détection conflit | 1-2j | Parallèle E-1 |
| **E-5** | Prompt IA : injecter `legalForm` + `incomeRegime` + `companyTier` | 0.5j | Après E-1 |
| **E-6** | `CategorizationAutomationMetricsCenter` + API admin + alerte 5% | 1-2j | Après E-2 |
| **E-7** | Mise à jour docs (ROADMAP, guide utilisateur, gap analysis) | 0.5j | Fin |

**Chemin critique : E-1 → E-2 → E-5 = 5-6j**

**Parallèle : E-3 + E-4 pendant E-1/E-2 = 3-5j**

**Total : 8-12j**

```
Jour 1-2   : E-1 (ProfileCenter + migration) + E-3 début (mappings)
Jour 3-4   : E-2 (policy tiered) + E-3 fin + E-4 (cross-exercice)
Jour 5     : E-5 (prompt IA)
Jour 6-7   : E-6 (monitoring)
Jour 8     : E-7 (docs) + tests intégration finaux
Buffer     : 2-4j
```

### Gain attendu par étape

| Étape | Impact auto-catégorisation | Cumul |
|-------|---------------------------|-------|
| Baseline actuelle | 55-70% | 55-70% |
| E-2 (policy tiered — Tier 1/2 débloqués) | +15-20 pts | 70-90% |
| E-3 (vendor mappings ×3-4) | +5-10 pts | 75-95% |
| E-4 (cross-exercice) | +5 pts (users matures) | 80-95% |
| E-5 (prompt contextualisé) | +2-3 pts (réduction erreurs) | 82-95% |
| **Objectif beta** | | **85-90%** |

---

## 7. Ce qui reste après le P0

| Élément | Phase | Effort estimé |
|---------|-------|--------------|
| Documents fiscaux par régime (FEC/bilan conditionnels) | P1 Masterplan fiscal | 5-8j |
| Templates liasses 2035/2072/2042-C Pro | P1 Masterplan fiscal | 3-5j |
| Catégories simplifiées micro (UX sans PCG) | Post-beta | 2-3j |
| sourceCategory bancaire | Post-beta | 2-3j |
| Workflow validation EC (Tier 4 pleinement permissif) | Post-beta | 5-8j |
| Récurrence / détection revenus / suggestions LOW (Phase B/C gap analysis) | Post-beta | 10-15j |

---

## 8. Références

| Document | Rôle |
|----------|------|
| `cadrage-profils-entreprise-categorisation.md` | Cadrage stratégique : types juridiques, matrice CERFA, onboarding |
| `gap-analysis-automatisation-categorisation.md` | Analyse de l'écart Qitus vs Indy, cadre fiscal, Phases B/C |
| `cadrage-durcissement-produit.md` (V3) | Anti-patterns UX, modèle trois vitesses |
| `auto-apply-reliability-policy.server.ts` | Fichier modifié (4 points de changement) |
| `categorization-trust-policy.server.ts` | Consommateur de la policy — interface inchangée |
