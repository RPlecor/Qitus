# Annexe — Logique déterministe vs appels IA

## Optimisation de la consommation de tokens dans le MVP Paperasse

**Document à lire AVANT le début du développement.**
**Rattaché au :** Cadrage architecture backend v3
**Impact estimé :** -70 % de coût IA par utilisateur/mois

---

## 1. Principe directeur

> **Si la réponse est un nombre calculable à partir de données connues → hardcodé. Si la réponse nécessite d'interpréter du texte libre ou de porter un jugement → IA.**

80 % des mécanismes du MVP sont déterministes. L'architecture v2/v3 faisait passer inutilement par l'IA des opérations qui sont de simples formules, lookups ou agrégations SQL. Cette annexe identifie chaque opération et prescrit le mode d'exécution.

---

## 2. Matrice complète — les 8 mécanismes du MVP

### 2.1 Import + parsing CSV

| Opération | Mode | Tokens | Détail |
|---|---|---|---|
| Détection de format (encodage, séparateur, banque) | HARDCODÉ | 0 | Lecture des 5 premières lignes, heuristique sur les headers |
| Parsing des lignes | HARDCODÉ | 0 | Parser spécifique par banque (Qonto, BNP, SG, Boursorama) |
| Normalisation en Transaction | HARDCODÉ | 0 | Mapping colonnes → objet JSON standardisé |
| Détection de doublons | HARDCODÉ | 0 | `WHERE date = X AND amount = Y AND label = Z` |
| Mapping CSV manuel (GenericParser) | HARDCODÉ | 0 | L'utilisateur assigne les colonnes, le backend applique |

**Verdict : 100 % déterministe. 0 token.**

---

### 2.2 Catégorisation des transactions

C'est le mécanisme où l'optimisation a le plus d'impact. L'architecture v2 envoyait TOUTES les transactions à l'IA. En réalité, 75-85 % sont catégorisables sans IA.

#### Étape 1 — VendorLookupTable (HARDCODÉ, 0 token)

Table de correspondance `vendor → compte PCG`. Matching exact sur le champ `counterparty` de la transaction normalisée.

**Table initiale à livrer au MVP (à enrichir en continu) :**

| Pattern vendor (case-insensitive, contains) | Compte PCG | Libellé PCG | Journal |
|---|---|---|---|
| `ovh`, `aws`, `scaleway`, `hetzner`, `digitalocean`, `cloudflare` | 6135 | Locations mobilières (cloud/hosting) | BQ |
| `google workspace`, `google ireland` (hors ads) | 6135 | Locations mobilières (SaaS) | BQ |
| `notion`, `slack`, `github`, `figma`, `canva`, `anthropic`, `openai` | 6135 | Locations mobilières (SaaS) | BQ |
| `adobe`, `dropbox`, `zoom`, `microsoft 365`, `atlassian` | 6135 | Locations mobilières (SaaS) | BQ |
| `hubspot`, `mailchimp`, `sendinblue`, `brevo` | 6135 | Locations mobilières (SaaS) | BQ |
| `wetransfer`, `1password`, `lastpass`, `grammarly` | 6135 | Locations mobilières (SaaS) | BQ |
| `sncf`, `air france`, `eurostar`, `thalys`, `easyjet`, `ryanair` | 6251 | Voyages et déplacements | BQ |
| `uber` (hors eats), `bolt`, `freenow`, `blablacar` | 6251 | Voyages et déplacements | BQ |
| `booking`, `airbnb`, `accor`, `ibis` | 6256 | Missions (hébergement) | BQ |
| `axa`, `allianz`, `maif`, `mma`, `matmut`, `macif`, `generali` | 6161 | Assurances | BQ |
| `urssaf` | 6451 | Cotisations URSSAF | BQ |
| `edf`, `engie`, `totalenergies`, `direct energie` | 6061 | Fournitures non stockables (énergie) | BQ |
| `orange`, `sfr`, `bouygues telecom`, `free mobile` | 6262 | Télécommunications | BQ |
| `la poste`, `colissimo`, `ups`, `fedex`, `dhl`, `chronopost` | 6241 | Transports sur achats | BQ |
| `amazon` (montant < 500 €) | 6064 | Fournitures administratives | BQ |
| `qonto`, `boursorama`, `bnp` + pattern `frais`, `commission` | 627 | Services bancaires | BQ |
| `stripe` + pattern `fee`, `commission` | 6278 | Autres frais bancaires | BQ |
| `stripe` + pattern `payout` | 5121/5115 | Mouvement de trésorerie (PAS un revenu) | BQ |
| `greffe`, `inpi`, `cci` | 6354 | Droits d'enregistrement | BQ |
| `expert comptable`, `ec `, `fiduciaire` | 6226 | Honoraires | BQ |
| `impots.gouv`, `dgfip`, `tresor public` | 635 | Autres impôts | BQ |
| `swile`, `edenred` | 6475 | Médecine du travail et avantages | BQ |
| Pattern `loyer`, `bail`, `coworking`, `regus`, `wework` | 6132 | Locations immobilières | BQ |
| Pattern `assurance` dans le libellé | 6161 | Assurances | BQ |

**Taille estimée de la table au lancement : ~100-150 entrées.** Elle se construit ensuite automatiquement via les CorrectionRules utilisateurs.

**Hit rate attendu : 60-70 % des transactions** d'une TPE consulting/SaaS typique.

#### Étape 2 — Pattern matching sur le libellé (HARDCODÉ, 0 token)

Regex ou keyword matching sur le champ `label` de la transaction quand le vendor n'est pas reconnu :

| Pattern dans le libellé | Compte PCG | Confiance |
|---|---|---|
| `vir recu`, `virement recu`, `encaissement` + montant positif | 706 | HIGH |
| `carte cb` + `restaurant`, `rest `, `brasserie` | 6257 | MEDIUM |
| `carte cb` + `pharmacie`, `sante` | 6478 | MEDIUM |
| `prlv sepa` + `assurance` | 6161 | HIGH |
| `prlv sepa` + `urssaf` | 6451 | HIGH |
| `retrait dab`, `retrait gab` | 580 | HIGH |
| `frais`, `commission`, `agios` | 627 | MEDIUM |
| `remboursement` + nom d'associé (match company.managerName) | 4551 | HIGH |

**Hit rate additionnel : 10-15 %** des transactions restantes après l'étape 1.

#### Étape 3 — CorrectionRules utilisateur (HARDCODÉ, 0 token)

Déjà prévu dans l'architecture v3. Quand l'utilisateur corrige "Notion Labs → 6135", une CorrectionRule est créée et appliquée automatiquement aux futures transactions du même vendor.

**Hit rate additionnel : 5-10 %** (croissant avec l'usage).

#### Étape 4 — Appel IA (RÉSIDUEL, tokens)

**Seulement les transactions non matchées** après les 3 étapes déterministes. Typiquement :

- Libellés opaques : "VIR SEPA 789456123", "CB 1501 PARIS"
- Vendeurs jamais vus et sans pattern reconnaissable
- Amazon > 500 € (immobilisation ou charge ? → jugement)
- Transactions mixtes (transport + repas)
- Première occurrence d'un fournisseur sans pattern

**Estimation : 15-25 % des transactions seulement** passent par l'IA.

#### Résumé pipeline catégorisation optimisé

```
200 transactions importées
│
├─ VendorLookupTable    → 130 catégorisées (65 %)     0 token
├─ PatternMatcher       →  25 catégorisées (12 %)     0 token
├─ CorrectionRules      →  15 catégorisées (8 %)      0 token
├─ Appel IA (résiduel)  →  30 catégorisées (15 %)     ~0,18 €
│
└─ Total tokens : ~0,18 € au lieu de ~0,90 €          -80 %
```

---

### 2.3 Génération des écritures comptables

| Opération | Mode | Tokens | Détail |
|---|---|---|---|
| Création écriture partie double | HARDCODÉ | 0 | `{debit: account_X, credit: "5121", amount}` — mécanique |
| Numérotation séquentielle | HARDCODÉ | 0 | `MAX(num) + 1` |
| Choix du journal (BQ/AC/VE/OD) | HARDCODÉ | 0 | Déterminé par le type de transaction et la source |
| Formatage du libellé | HARDCODÉ | 0 | `counterparty + " — " + label_normalisé` |

**Verdict : 100 % déterministe. 0 token.**

---

### 2.4 Dashboard / KPIs

| Opération | Mode | Tokens | Détail |
|---|---|---|---|
| CA cumulé | HARDCODÉ | 0 | `SUM(credit - debit) WHERE account LIKE '70%'` |
| Charges cumulées | HARDCODÉ | 0 | `SUM(debit - credit) WHERE account LIKE '6%'` |
| Résultat courant | HARDCODÉ | 0 | CA - Charges |
| Trésorerie | HARDCODÉ | 0 | `SUM(debit - credit) WHERE account = '5121'` |
| Tendance N/N-1 | HARDCODÉ | 0 | Comparaison avec les données de l'exercice précédent |

**Verdict : 100 % déterministe. 0 token.**

---

### 2.5 Clôture annuelle — étape par étape

| Étape | Mode | Tokens | Détail |
|---|---|---|---|
| 1. Vérification balance | HARDCODÉ | 0 | `SUM(debit)` = `SUM(credit)` → SQL. Détection soldes anormaux = liste de règles (compte 401 au débit = anormal). |
| 2. Rapprochement bancaire | HARDCODÉ | 0 | Comparer 2 nombres (solde comptable vs solde saisi par l'utilisateur). |
| 3. Lettrage tiers | HARDCODÉ (90 %) | Résiduel | Match montant + date sur comptes 401/411. Les cas ambigus (montants éclatés, dates décalées) → IA. |
| 4. PCA/CCA | HARDCODÉ | 0 | **Si l'utilisateur flag** les charges annuelles (checkbox "charge annuelle" sur la catégorisation) : prorata = `montant × jours_exercice_suivant / jours_total`. Formule pure. |
| 5. Amortissements | HARDCODÉ | 0 | Linéaire = `montant / durée × (jours / 365)`. Dégressif = `VNC × coeff × (jours / 365)`. Formules. |
| 6. Provisions | **IA** | ~0,14 € | Évaluer un risque = jugement. "Ce litige client justifie-t-il une provision ?" → seul cas où l'IA est indispensable. |
| 7. TVA annuelle | HARDCODÉ | 0 | `SUM(44571) - SUM(44566)`. Agrégation SQL. |
| 8. Calcul IS | HARDCODÉ | 0 | `if (résultat ≤ 42500) → 15 % sinon 25 % sur surplus`. Le taux réduit PME = 3 conditions vérifiables en SQL. |
| 9. Écritures de clôture | HARDCODÉ | 0 | Écritures mécaniques une fois les montants des étapes 4-8 connus. |
| 10. États financiers | HARDCODÉ | 0 | Script `generate-statements.js` (REUSE repo). |
| 11. Liasse fiscale | HARDCODÉ | 0 | Remplissage de templates avec les montants calculés. |
| 12. Export & archivage | HARDCODÉ | 0 | Scripts `generate-fec.js` + `generate-pdfs.js` (REUSE repo). |

**Verdict : 11/12 étapes déterministes. 1 seule (provisions) nécessite l'IA — et beaucoup de TPE n'ont aucune provision à constater.**

**Note sur l'étape 4 (PCA/CCA) :** Dans l'architecture v2, la détection des charges annuelles était prévue comme "IA-assistée". En réalité, si on ajoute un champ `isAnnual: boolean` sur la catégorisation (que l'utilisateur coche au moment de la correction ou que le VendorLookupTable pré-flag pour les vendeurs connus comme annuels — AXA, Figma annual, etc.), le calcul du prorata devient entièrement déterministe. Recommandation : ajouter ce champ.

---

### 2.6 Génération de documents

| Opération | Mode | Tokens | Détail |
|---|---|---|---|
| Génération FEC | HARDCODÉ | 0 | Script `generate-fec.js` (REUSE) |
| Génération bilan / CR / balance | HARDCODÉ | 0 | Script `generate-statements.js` (REUSE) |
| Génération PDFs | HARDCODÉ | 0 | Script `generate-pdfs.js` + templates HTML (REUSE) |
| Liasse fiscale (remplissage) | HARDCODÉ | 0 | Montants calculés → placeholders dans les templates |
| Grand livre | HARDCODÉ | 0 | Agrégation SQL par compte, trié par date |

**Verdict : 100 % déterministe. 0 token.**

---

### 2.7 Chat IA

| Opération | Mode | Tokens | Détail |
|---|---|---|---|
| Réponse à une question comptable | **IA** | ~0,08 € /msg | Langage naturel → IA obligatoire |
| Contexte entreprise injecté dans le prompt | HARDCODÉ | 0 | PaperasseAdapter.toCompanyJson() + KPIs (SQL) |
| Historique conversation | HARDCODÉ | 0 | Stocké en BDD, injecté dans le prompt |

**Verdict : 100 % IA pour la génération de réponse. Le contexte injecté est calculé côté backend (0 token supplémentaire).**

**Optimisation possible (non prioritaire MVP) :** Mettre en cache Redis les réponses aux questions fréquentes et identiques (ex : "C'est quoi le compte 6135 ?" → toujours la même réponse). Hit rate estimé faible (~5 %) mais coût d'implémentation quasi nul.

---

### 2.8 Alertes / Notifications

| Opération | Mode | Tokens | Détail |
|---|---|---|---|
| Alerte seuil TVA franchise | HARDCODÉ | 0 | `if (ca_cumule > company.vatThreshold * 0.87)` |
| Alerte dépassement seuil TVA | HARDCODÉ | 0 | `if (ca_cumule > company.vatThreshold)` |
| Échéance fiscale | HARDCODÉ | 0 | Calendrier fiscal (dates fixes) + régime TVA → filtre |
| Acompte IS | HARDCODÉ | 0 | 4 dates fixes (15/03, 15/06, 15/09, 15/12) si IS |
| Transactions à vérifier | HARDCODÉ | 0 | `COUNT(*) WHERE confidence = 'LOW'` |
| Import terminé | HARDCODÉ | 0 | Event BullMQ |
| Coût IA élevé | HARDCODÉ | 0 | `if (aiCostCentsThisMonth > threshold)` |
| Fraîcheur données réglementaires | HARDCODÉ | 0 | `update_data.py --check` (REUSE repo) |

**Verdict : 100 % déterministe. 0 token.**

---

## 3. Budget tokens optimisé vs architecture v2

### Par opération

| Opération | v2 (tout IA) | v3 optimisé | Économie |
|---|---|---|---|
| Catégorisation 200 tx/mois | 10 appels → 0,90 € | 2 appels (30 tx) → 0,18 € | **-80 %** |
| Clôture complète | 15-20 appels → 2-4 € | 1-3 appels (provisions + lettrage ambigu) → 0,15-0,45 € | **-85 %** |
| Chat 10 msg/mois | 10 appels → 0,80 € | 10 appels → 0,80 € | 0 % |
| Dashboard, alertes, documents | 0 (déjà hardcodé en v2) | 0 | 0 % |
| **Total mois utilisateur** | **~1,70 – 5,70 €** | **~0,50 – 1,50 €** | **-70 %** |

### Impact sur la marge par tier

| Tier | Prix (HT/mois) | Coût IA v2 | Coût IA optimisé | Marge IA v2 | Marge IA optimisée |
|---|---|---|---|---|---|
| Solo (19 €) | 19 € | ~1,70 € | ~0,50 € | 91 % | **97 %** |
| Entreprise (49 €) | 49 € | ~3,50 € | ~1,00 € | 93 % | **98 %** |
| Entreprise+ (99 €) | 99 € | ~5,70 € | ~1,50 € | 94 % | **98 %** |

Le coût IA devient négligeable. Le risque de marge négative identifié dans le cadrage MVP (risque #2) est très fortement mitigé.

---

## 4. Composants à construire

### 4.1 VendorLookupTable

```typescript
interface VendorLookupTable {
  // Lookup exact sur le counterparty (case-insensitive, contains)
  findByVendor(counterparty: string): PCGMapping | null;

  // Pattern matching sur le libellé (regex/keywords)
  findByPattern(label: string): PCGMapping | null;

  // Enrichissement via CorrectionRules
  learnFromCorrection(counterparty: string, account: string, label?: string): void;

  // Monitoring du hit rate
  getHitRate(): { total: number; matched: number; percent: number };
}

interface PCGMapping {
  accountDebit: string;
  accountCredit: string;      // "5121" par défaut pour les débits bancaires
  journal: string;            // "BQ" par défaut
  ecritureLabel?: string;     // Template de libellé
  confidence: 'HIGH';
  source: 'vendor_lookup' | 'pattern_match' | 'correction_rule';
  isAnnualCharge?: boolean;   // Flag pour PCA/CCA automatique
}
```

**Stockage :** Table Prisma `VendorMapping` + chargement en mémoire (Map) au démarrage du worker. Refresh à chaque correction utilisateur.

```prisma
model VendorMapping {
  id              String    @id @default(cuid())
  companyId       String?   // null = mapping global (table de base), string = mapping spécifique company
  pattern         String    // Le vendor ou pattern à matcher
  matchType       MatchType // VENDOR_EXACT | VENDOR_CONTAINS | LABEL_REGEX | LABEL_KEYWORD
  accountDebit    String
  accountCredit   String    @default("5121")
  journal         String    @default("BQ")
  ecritureLabel   String?
  isAnnualCharge  Boolean   @default(false)
  hitCount        Int       @default(0)   // Compteur d'utilisation pour monitoring
  source          String    // "seed" | "correction" | "admin"
  active          Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([companyId, pattern])
  @@index([matchType])
}

enum MatchType {
  VENDOR_EXACT
  VENDOR_CONTAINS
  LABEL_REGEX
  LABEL_KEYWORD
}
```

**Logique de matching (ordre de priorité) :**

1. CorrectionRule de la company (spécifique à l'entreprise, prioritaire)
2. VendorMapping de la company (si l'utilisateur a personnalisé)
3. VendorMapping global `VENDOR_EXACT` (match exact du counterparty)
4. VendorMapping global `VENDOR_CONTAINS` (counterparty contient le pattern)
5. VendorMapping global `LABEL_KEYWORD` (libellé contient le mot-clé)
6. VendorMapping global `LABEL_REGEX` (libellé match la regex)
7. → Non trouvé → passe à l'IA

**Seed data :** La table §2.2 de cette annexe constitue le jeu de données initial (~100-150 entrées). À livrer en migration Prisma seed.

### 4.2 PatternMatcher

Inclus dans le VendorLookupTable (matchType `LABEL_KEYWORD` et `LABEL_REGEX`). Pas un composant séparé — c'est la même table avec un type de matching différent.

### 4.3 ClotureCalculator

```typescript
interface ClotureCalculator {
  // Étape 1 — vérification balance
  checkBalance(fiscalYearId: string): Promise<BalanceCheck>;

  // Étape 2 — rapprochement
  reconcile(soldeComptable: number, soldeReleve: number): ReconciliationResult;

  // Étape 4 — PCA/CCA (si flagged isAnnual)
  calculatePCA(params: {
    amount: number;
    paymentDate: Date;
    periodStart: Date;
    periodEnd: Date;
    fiscalYearEnd: Date;
  }): PCAResult;

  // Étape 5 — amortissements
  calculateDepreciation(params: {
    amountHt: number;
    acquisitionDate: Date;
    usefulLifeYears: number;
    method: 'LINEAR' | 'DEGRESSIVE';
    fiscalYearStart: Date;
    fiscalYearEnd: Date;
  }): DepreciationResult;

  // Étape 7 — TVA
  calculateVAT(fiscalYearId: string): Promise<VATResult>;

  // Étape 8 — IS
  calculateIS(params: {
    resultatFiscal: number;
    company: Company;      // Pour vérifier éligibilité taux réduit PME
    fiscalYearDurationMonths: number;
  }): ISResult;
}
```

**Formules de référence :**

```typescript
// Amortissement linéaire avec prorata 1ère année
function linearDepreciation(amountHt: number, years: number, startDate: Date, yearEnd: Date): number {
  const daysInYear = 365;
  const daysSinceAcquisition = Math.min(
    differenceInDays(yearEnd, startDate) + 1,
    daysInYear
  );
  return Math.round((amountHt / years) * (daysSinceAcquisition / daysInYear) * 100) / 100;
}

// IS avec taux réduit PME
function calculateIS(resultatFiscal: number, eligibleTauxReduit: boolean): number {
  if (resultatFiscal <= 0) return 0;
  if (eligibleTauxReduit) {
    const tranche1 = Math.min(resultatFiscal, 42500);
    const tranche2 = Math.max(0, resultatFiscal - 42500);
    return Math.round((tranche1 * 0.15 + tranche2 * 0.25) * 100) / 100;
  }
  return Math.round(resultatFiscal * 0.25 * 100) / 100;
}

// Éligibilité taux réduit PME (art. 219-I-b CGI)
function isEligibleTauxReduit(company: Company): boolean {
  return (
    company.corporateTax === 'IS' &&
    company.capital !== null &&
    company.capital > 0 &&
    // CA HT < 10 M€ (à vérifier sur l'exercice en cours)
    // Capital entièrement libéré
    // Détenu à 75%+ par des personnes physiques
    true // Les 3 conditions sont vérifiées par le backend
  );
}

// PCA / CCA prorata temporis
function calculatePCA(amount: number, periodEnd: Date, fiscalYearEnd: Date, totalDays: number): number {
  const daysNextExercise = Math.max(0, differenceInDays(periodEnd, fiscalYearEnd));
  return Math.round((amount * daysNextExercise / totalDays) * 100) / 100;
}
```

### 4.4 Modification du champ Categorization

Ajout du flag `isAnnualCharge` pour le mécanisme PCA/CCA déterministe :

```prisma
model Categorization {
  // ... champs existants v3 ...

  isAnnualCharge  Boolean   @default(false)  // Flag pour PCA/CCA automatique (annexe token-optim)
}
```

Ce flag est posé :
- Automatiquement par le VendorLookupTable (si `isAnnualCharge: true` dans le mapping)
- Manuellement par l'utilisateur lors de la correction (checkbox "Charge annuelle")

---

## 5. Modification du pipeline d'import

Le pipeline v3 (§5.2 du cadrage) doit être modifié pour intégrer les étapes déterministes avant l'appel IA.

### Pipeline v3 (avant cette annexe)

```
1. detect_format        → HARDCODÉ
2. parse_and_normalize  → HARDCODÉ
2b. needs_mapping       → HARDCODÉ
3. apply_correction_rules → HARDCODÉ
4. ai_categorize        → IA (TOUTES les transactions non matchées par corrections)
5. generate_journal_entries → HARDCODÉ
```

### Pipeline v3 optimisé (après cette annexe)

```
1. detect_format            → HARDCODÉ
2. parse_and_normalize      → HARDCODÉ
2b. needs_mapping           → HARDCODÉ (si GenericParser)
3. vendor_lookup            → HARDCODÉ (VendorLookupTable — ~65 % matchés)
4. pattern_match            → HARDCODÉ (PatternMatcher — ~12 % matchés)
5. apply_correction_rules   → HARDCODÉ (CorrectionRules — ~8 % matchés)
6. ai_categorize            → IA (RÉSIDUEL — ~15 % seulement)
7. generate_journal_entries → HARDCODÉ
```

**L'étape 6 (IA) ne reçoit que les transactions non matchées par les étapes 3-5.** Le prompt système reste identique (skill comptable + PCG + contexte), mais le batch est 5-6x plus petit.

---

## 6. Modification du service Clôture

### Clôture v3 (avant cette annexe)

| Étape | Mode v3 |
|---|---|
| 1-3 | Backend orchestre, IA analyse |
| 4 (PCA/CCA) | IA détecte et calcule |
| 5 (Amortissements) | IA calcule |
| 6 (Provisions) | IA juge |
| 7 (TVA) | IA calcule |
| 8 (IS) | IA calcule |
| 9-12 | Backend + scripts REUSE |

### Clôture optimisée (après cette annexe)

| Étape | Mode optimisé | Tokens |
|---|---|---|
| 1 (Balance) | `ClotureCalculator.checkBalance()` — SQL | 0 |
| 2 (Rapprochement) | `ClotureCalculator.reconcile()` — soustraction | 0 |
| 3 (Lettrage) | SQL matching montant/date ; IA uniquement cas ambigus | ~0-0,14 € |
| 4 (PCA/CCA) | `ClotureCalculator.calculatePCA()` — formule, si `isAnnualCharge` flaggé | 0 |
| 5 (Amortissements) | `ClotureCalculator.calculateDepreciation()` — formule | 0 |
| 6 (Provisions) | **IA** — seul cas de jugement | ~0,14 € |
| 7 (TVA) | `ClotureCalculator.calculateVAT()` — SQL | 0 |
| 8 (IS) | `ClotureCalculator.calculateIS()` — formule | 0 |
| 9-12 | Scripts REUSE (inchangé) | 0 |

**Coût clôture optimisé : ~0,15-0,45 € au lieu de 2-4 €.**

---

## 7. Métriques de monitoring

L'architecte doit instrumenter les composants pour mesurer l'efficacité de l'optimisation :

```
# Hit rate du VendorLookupTable
paperasse_lookup_hits_total{match_type}     # vendor_exact, vendor_contains, label_keyword, label_regex
paperasse_lookup_misses_total               # Transactions passées à l'IA
paperasse_lookup_hit_rate                   # hits / (hits + misses) — objectif > 75 %

# Coût IA réel vs budget
paperasse_ai_calls_saved_total              # Appels évités grâce au lookup
paperasse_ai_cost_saved_cents               # Euros économisés

# Enrichissement de la table
paperasse_vendor_mappings_total{source}     # seed, correction, admin
paperasse_correction_rules_created_total
```

**Alerte si le hit rate tombe sous 60 %** → la VendorLookupTable a besoin d'être enrichie (nouveaux patterns).

---

## 8. Résumé pour l'architecte

### Ce qui change concrètement dans le code

| Composant | Action | Priorité |
|---|---|---|
| `VendorLookupTable` | **Nouveau composant** — table Prisma `VendorMapping` + service TS + seed data ~150 entrées | Critique (avant tout dev IA) |
| `ClotureCalculator` | **Nouveau composant** — 6 fonctions de calcul pur (amortissement, IS, PCA, TVA, balance, rapprochement) | Haute |
| Pipeline import (étapes 3-6) | **Réordonner** — lookup → pattern → corrections → IA (résiduel) | Critique |
| `Categorization` model | **Ajout champ** `isAnnualCharge Boolean` | Haute |
| Service Clôture | **Remplacer** les appels IA sur les étapes 1-2, 4-5, 7-8 par des appels au ClotureCalculator | Haute |
| Monitoring | **Ajouter** les métriques Prometheus pour le hit rate et le coût IA économisé | Moyenne |

### Ce qui NE change PAS

- Le skill comptable SKILL.md reste le prompt système pour l'IA (inchangé)
- Le PaperasseAdapter reste le pont BDD ↔ scripts (inchangé)
- Les scripts REUSE restent identiques (inchangé)
- Le chat IA reste 100 % IA (inchangé)
- Les endpoints API v3 restent les mêmes (aucun ajout/suppression)

### La règle à appliquer pendant le développement

Avant de coder un appel à l'API Anthropic, l'architecte doit se poser cette question :

> **"Est-ce que cette opération peut être exprimée comme une formule, une condition, une agrégation SQL, ou un lookup dans une table ?"**
>
> Si oui → fonction TypeScript déterministe.
> Si non → appel IA.
>
> **En cas de doute :** commencer par la version déterministe. On peut toujours ajouter un appel IA plus tard si la qualité est insuffisante. L'inverse (remplacer l'IA par du code) est plus coûteux.

---

*Annexe au cadrage architecture backend v3 — Paperasse SaaS MVP. Document de référence pour l'optimisation des coûts IA avant le début du développement.*
