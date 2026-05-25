# Correctif — Plan d'implémentation Auto-Catégorisation Par Profil V3

**Date :** 2026-05-25  
**Référence :** `plan-v3-auto-categorisation-par-profil.md`  
**Objet :** 6 écarts identifiés entre le plan d'implémentation et le plan V3 de référence. Corrections à intégrer avant démarrage.

---

## G-1 — Documenter les préconditions dans le code

**Sévérité :** Faible  
**Constat :** Le plan V3 (§3.2, Changement 5) demande d'ajouter un bloc de commentaires dans `auto-apply-reliability-policy.server.ts` documentant les invariants assurés en amont par `AccountingAssignmentValidationPolicy` :

- Compte PCG validé et postable
- Pas de compte d'attente
- TVA structurellement cohérente
- `confirmed` interdit pour l'IA (géré par `CategorizationTrustPolicy`)

**Correction :** Ajouter dans la section §2 (AutoApplyReliabilityPolicy Paramétrée) : « Ajouter un bloc de commentaires en tête de `classifyAiSuggestion` documentant les 4 préconditions structurelles assurées en amont. »

**Effort :** Négligeable (~5 min).

---

## G-2 — Scope des dérivations fiscales (FEC, bilan, taxFormSet)

**Sévérité :** Moyenne  
**Constat :** L'interface de `CompanyProfileClassificationCenter` liste `deriveFecRequired`, `deriveBilanRequired`, `deriveTaxFormSet`. Ces méthodes correspondent au P1 (Masterplan fiscal), explicitement sorti du P0 dans le V3 (§1, tableau "Éléments sortis du P0").

**Risque :** Si ces méthodes sont implémentées réellement en P0, c'est du scope creep sur un bloc déjà dense (8-12j).

**Correction :** Verrouiller ces 3 méthodes comme **stubs** en P0. Elles existent dans le type `CompanyProfileClassification` (pour ne pas casser l'interface à l'ajout futur) mais retournent des valeurs par défaut :

```typescript
// P0 : stubs — implémentation réelle = P1 Masterplan fiscal
function deriveFecRequired(_company: Company): boolean { return false; }
function deriveBilanRequired(_company: Company): boolean { return false; }
function deriveTaxFormSet(_company: Company): string[] { return []; }
```

Ajouter un commentaire `// TODO P1: Masterplan fiscal` sur chaque stub. Inscrire l'implémentation réelle dans la section Documentation/Roadmap.

---

## G-3 — Seuils d'alerte numériques par tier dans le MetricsCenter

**Sévérité :** Faible  
**Constat :** La section Monitoring (§6) mentionne les métriques par tier sans reprendre les seuils numériques du V3 (§3.6).

**Correction :** Ajouter les constantes suivantes dans `CategorizationAutomationMetricsCenter` :

| Métrique | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|----------|--------|--------|--------|--------|
| AUTO_APPLIED minimum attendu | 95% | 85% | 80% | 90% |
| NEEDS_REVIEW maximum toléré | 15% | 25% | 30% | — |
| Confiance IA moyenne minimum | 75% | 75% | 75% | 75% |
| Transactions > 30j sans catégorisation (global) | > 10 = notification utilisateur |

Ces seuils déclenchent des alertes, pas des actions automatiques. Le seuil de correction AUTO_APPLIED (> 5% = alerte + resserrage, < 2% = candidat élargissement) s'applique transversalement à tous les tiers.

---

## G-4 — Compléter le test plan avec les cas manquants

**Sévérité :** Moyenne  
**Constat :** ~8 cas de test du V3 ne sont pas explicitement nommés dans le plan d'implémentation. Même si les règles sous-jacentes les couvrent implicitement, l'absence de cas nommés crée un risque d'oubli à l'implémentation.

**Correction :** Ajouter les cas suivants au test plan.

**Tier 1 — compléter :**

| # | Cas | Résultat attendu |
|---|-----|-----------------|
| T1-4 | IA LOW (40), charge personnelle détectée (compte 108xxx) | `NEEDS_REVIEW` — invariant compte sensible actif même en Tier 1 |
| T1-5 | IA HIGH, opération intracommunautaire (TVA complexe) | `NEEDS_REVIEW` — invariant TVA complexe actif même en Tier 1 |

**Tier 3 — compléter :**

| # | Cas | Résultat attendu |
|---|-----|-----------------|
| T3-6 | IA HIGH, charge courante 900€ HT, ≥ 2 occurrences | `AUTO_APPLIED` — sous le seuil 1000€ de l'extension Tier 3 |

**Tier 4 — compléter :**

| # | Cas | Résultat attendu |
|---|-----|-----------------|
| T4-3 | IA HIGH, charge personnelle | `NEEDS_REVIEW` — invariant compte sensible actif, fallback Tier 2 ne contourne pas les garde-fous |

**CompanyProfileClassificationCenter — compléter :**

| # | Entrée (legalForm / incomeRegime / hasAccountant) | Tier attendu |
|---|--------------------------------------------------|-------------|
| OB-6 | SCI / "IR" / false | TIER_2_EI_REEL |
| OB-7 | SCI / "IS" / false | TIER_3_IS_SANS_EC |

Ces cas vérifient que la logique de dérivation ne traite pas les SCI comme un cas particulier mais les route correctement via `incomeRegime`.

---

## G-5 — Ajouter le plan d'exécution séquencé

**Sévérité :** Élevée  
**Constat :** Le plan d'implémentation ne contient aucun séquencement d'exécution, aucune estimation d'effort par étape, aucun chemin critique, aucune identification de parallélisation. Sans cela, le pilotage du bloc est impossible.

**Correction :** Ajouter une section « Plan d'exécution » reprenant le séquencement V3 :

| Étape | Contenu | Effort | Dépendance |
|-------|---------|--------|------------|
| **E-1** | `CompanyProfileClassificationCenter` + migration Prisma (+3 champs) | 2j | — |
| **E-2** | Modifier `AutoApplyReliabilityPolicy` : seuil confiance, historique, extensions Tier 3 (4 points de modification) | 2-3j | Après E-1 |
| **E-3** | Vendor mappings : de 33 à 100-150 patterns + validation PCG/TVA | 2-3j | Parallèle E-1 |
| **E-4** | Cross-exercice correction rules : requête multi-exercice + détection conflit | 1-2j | Parallèle E-1 |
| **E-5** | Prompt IA : injecter `legalForm` + `incomeRegime` + `companyTier` | 0.5j | Après E-1 |
| **E-6** | `CategorizationAutomationMetricsCenter` + API admin + alerte 5% | 1-2j | Après E-2 |
| **E-7** | Mise à jour docs (ROADMAP, guide utilisateur, gap analysis, RGPD) | 0.5j | Fin |

**Chemin critique :** E-1 → E-2 → E-5 = 5-6j  
**Parallèle :** E-3 + E-4 pendant E-1/E-2 = 3-5j  
**Total :** 8-12j (buffer inclus : 2-4j)

**Gains attendus par étape :**

| Étape | Impact auto-catégorisation | Cumul estimé |
|-------|---------------------------|-------------|
| Baseline actuelle | 55-70% | 55-70% |
| E-2 (policy tiered) | +15-20 pts | 70-90% |
| E-3 (vendor mappings ×3-4) | +5-10 pts | 75-95% |
| E-4 (cross-exercice) | +5 pts | 80-95% |
| E-5 (prompt contextualisé) | +2-3 pts | 82-95% |
| **Objectif beta** | | **85-90%** |

```
Jour 1-2   : E-1 (ProfileCenter + migration) + E-3 début (mappings)
Jour 3-4   : E-2 (policy tiered) + E-3 fin + E-4 (cross-exercice)
Jour 5     : E-5 (prompt IA)
Jour 6-7   : E-6 (monitoring)
Jour 8     : E-7 (docs) + tests intégration finaux
Buffer     : 2-4j
```

---

## G-6 — Expliciter les seuils Tier 4

**Sévérité :** Faible  
**Constat :** La config Tier 4 est décrite comme "seuils Tier 2" sans reprendre les valeurs numériques.

**Correction :** Dans la section config tier, expliciter :

```
Tier 4 (fallback tant que workflow EC inactif) :
  confidenceThreshold: 70
  minHistoryMatches: 1
  blacklistExtensions: []
```

Ajouter en commentaire : « Sera abaissé à confidenceThreshold: 40, minHistoryMatches: 0 quand le workflow de validation EC est actif (post-beta). »

---

## Résumé des actions

| # | Action | Effort | Priorité |
|---|--------|--------|----------|
| G-5 | Ajouter plan d'exécution séquencé | 30 min | **Bloquant** |
| G-4 | Compléter test plan (+8 cas) | 15 min | Élevée |
| G-2 | Verrouiller stubs FEC/bilan/taxFormSet | 10 min | Moyenne |
| G-1 | Ajouter commentaires préconditions | 5 min | Faible |
| G-3 | Ajouter seuils numériques MetricsCenter | 5 min | Faible |
| G-6 | Expliciter config Tier 4 | 5 min | Faible |

**Total effort correctif : ~1h.** Aucune remise en question architecturale. Le plan d'implémentation couvre ~90% du V3 — ces 6 corrections comblent les 10% restants.
