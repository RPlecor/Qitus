# Cadrage architecture backend — Paperasse SaaS MVP (v3)

## Document de référence pour l'architecte backend

**Version :** 3.0 — Mai 2026
**Statut :** Corrigé post-audit repo Paperasse + audit croisé 28 écrans frontend
**Input :** Cadrage MVP produit + Prototype frontend HTML v2 (28 écrans mergés) + Audit repo github.com/romainsimon/paperasse
**Livrable attendu de l'architecte :** Spécifications techniques détaillées + Plan d'implémentation

---

## Changements vs v2

La v2 corrigeait l'intégration du repo Paperasse (Build vs Reuse, adapter pattern). La v3 corrige les **trous identifiés par l'audit croisé des 28 écrans du prototype frontend** vs les endpoints API de la v2.

**9 endpoints ajoutés, 1 champ modèle ajouté :**

| Ajout | Écran concerné | Raison |
|---|---|---|
| `GET /api/imports/:id/detected-columns` | Mapping CSV (#11) | Le GenericParser détecte les colonnes mais aucun endpoint ne les expose |
| `POST /api/imports/:id/retry` | Historique imports (#12) | Pas de moyen de réessayer un import échoué |
| `POST /api/imports/:id/retry-categorization` | Erreur IA (#14) | Relancer les batches IA échoués sans re-parser le CSV |
| `PATCH /api/notifications/read-all` | Notifications (#25) | Bouton "Tout marquer comme lu" dans le proto |
| `GET /api/activity-log` | Audit trail (#26) | Le modèle et le middleware existaient, pas l'endpoint de lecture |
| `GET /api/activity-log/export` | Audit trail (#26) | Bouton "Exporter CSV" dans le proto |
| `GET /api/fiscal-years` | Multi-exercice (#27) | Lister les exercices de la company |
| `POST /api/fiscal-years` | Multi-exercice (#27) | "Créer un nouvel exercice" dans le dropdown du proto |
| `PATCH /api/fiscal-years/:id/activate` | Multi-exercice (#27) | Switcher l'exercice actif |
| `GET /api/exports/all` | RGPD (§8.3) | Mentionné dans le texte RGPD mais absent des routes |
| `Integration.lastFetchCount Int?` | Connecteurs (#20) | Le proto affiche "12 transactions" pour le dernier fetch |

---

## Changements vs v1

Cette version corrige la v1 sur un point structurant : **le repo Paperasse fournit 6 couches de logique métier déjà codée** (scripts Node.js, connecteurs API, templates HTML, données de référence, mécanisme de fraîcheur réglementaire) que la v1 prévoyait de reconstruire. La v2 s'appuie sur un **adapter pattern** pour réutiliser ces assets au lieu de les réécrire.

**Principes directeurs v2 :**

1. **Ne pas réécrire ce qui fonctionne.** Les scripts `generate-fec.js`, `generate-statements.js`, `generate-pdfs.js` ont 93/93 evals passing. Les appeler, pas les recoder.
2. **L'IA exécute la logique métier, le backend orchestre.** Les calculs (IS, amortissements, PCA/CCA) sont dans le skill Markdown. Le backend gère l'état, la persistance et la validation — pas les règles comptables.
3. **L'adapter est le composant critique.** Il convertit les données Prisma (PostgreSQL) en formats Paperasse (`company.json`, `journal-entries.json`) pour alimenter les scripts existants.

---

## 1. Contexte et périmètre

### 1.1 Ce que le repo Paperasse fournit (inventaire exhaustif)

#### 1.1.1 Scripts Node.js exécutables (logique déterministe)

| Script | Input | Output | Statut |
|---|---|---|---|
| `scripts/generate-statements.js` | `data/journal-entries.json` + `company.json` | Bilan, Compte de résultat, Balance (JSON) | Fonctionnel, 93/93 evals |
| `scripts/generate-fec.js` | `data/journal-entries.json` + `company.json` | FEC 18 colonnes .txt (art. L. 47 A-I LPF) | Fonctionnel |
| `scripts/generate-pdfs.js` | JSON générés + `company.json` + templates HTML | PDFs A4 professionnels | Fonctionnel |
| `scripts/update_data.py` | `data/sources.json` | PCG et nomenclature liasse mis à jour | Fonctionnel |
| `integrations/qonto/fetch.js` | `company.json` (config Qonto) + `.env` (API key) | `data/transactions/*.json` | Fonctionnel |
| `integrations/stripe/fetch.js` | `company.json` (config Stripe) + `.env` (API key) | `data/transactions/*.json` | Fonctionnel |

#### 1.1.2 Données de référence

| Fichier | Contenu | Source | Usage backend |
|---|---|---|---|
| `data/pcg_YYYY.json` | Plan Comptable Général 800+ comptes | data.gouv.fr (Arrhes/PCG) | Injecté dans le prompt IA (sous-ensemble) + autocomplete UI |
| `data/nomenclature-liasse-fiscale.csv` | Clés/libellés des cases de la liasse | data.gouv.fr | Input du script de liasse fiscale |
| `data/sources.json` | Tracking de fraîcheur des données | Interne repo | Lu par `update_data.py` pour vérifier la fraîcheur |

#### 1.1.3 Templates avec placeholders

| Template | Format | Placeholders | Usage |
|---|---|---|---|
| `templates/declaration-confidentialite.html` | HTML → PDF | `{{company.name}}`, `{{company.siren}}`, etc. | Rempli par `generate-pdfs.js` |
| `templates/2065-sd.html` | HTML → PDF | Champs IS pré-remplis | Rempli par `generate-pdfs.js` |
| `templates/approbation-comptes.md` | Markdown | Adapté forme juridique | Converti en PDF |
| `templates/liasse-fiscale-2033.md` | Markdown | Cases 2033-A à 2033-D | Rempli par l'IA + script PDF |
| `templates/depot-greffe-checklist.md` | Markdown | Checklist complète | Export tel quel |

#### 1.1.4 Skills IA (Markdown) — logique métier encodée

| Skill | Logique métier incluse | Impact architecture |
|---|---|---|
| `comptable/SKILL.md` | Mapping vendor→PCG, TVA (6 régimes), IS (taux réduit PME/normal), écritures partie double, cut-off PCA/CCA, amortissements (linéaire/dégressif/prorata), rapprochement bancaire, calendrier fiscal | L'IA fait le calcul. Le backend ne hardcode PAS ces règles. |
| `comptable/references/cloture-workflow.md` | 12 étapes de clôture avec prérequis, actions, résultats attendus | L'IA exécute chaque étape. Le backend orchestre et persiste. |
| `controleur-fiscal/SKILL.md` | 8 axes de vérification DGFIP, chefs de redressement | V1 — L'IA simule le contrôle. |
| `commissaire-aux-comptes/SKILL.md` | 7 phases NEP, validation FEC/bilan/CR/liasse, opinion motivée | V1 — L'IA audite les comptes. |
| `notaire/SKILL.md` | Frais notaire, plus-value, succession, donation, SCI, PACS | V2 |

#### 1.1.5 Contrats de données (formats standard du repo)

**`company.json`** — Structure du contexte entreprise. Le schéma Prisma `Company` doit pouvoir exporter un objet compatible.

```json
{
  "name": "ACME Digital",
  "legal_form": "SASU",
  "siren": "912345678",
  "siret": "91234567800015",
  "naf_code": "6202A",
  "capital": 1000,
  "address": { "street": "...", "postal_code": "...", "city": "..." },
  "president": { "name": "...", "role": "Présidente" },
  "fiscal_year": { "start": "2025-01-01", "end": "2025-12-31" },
  "tax_regime": { "corporate_tax": "IS", "vat_regime": "franchise_en_base" },
  "bank_accounts": [{ "id": "...", "bank": "Qonto", "pcg_account": "5121" }],
  "stripe_accounts": [{ "id": "...", "name": "...", "env_key": "STRIPE_SECRET" }],
  "qonto": { "enabled": true }
}
```

**`data/journal-entries.json`** — Format d'entrée des 3 scripts de génération :

```json
[{
  "num": 1,
  "date": "2025-03-06",
  "journal": "BQ",
  "ref": "QTO-001",
  "label": "Achat fournitures Amazon",
  "lines": [
    { "account": "606", "debit": 45.99, "credit": 0 },
    { "account": "5121", "debit": 0, "credit": 45.99 }
  ]
}]
```

#### 1.1.6 Mécanisme de fraîcheur réglementaire

Déjà implémenté dans le repo :

1. `last_updated` dans le frontmatter de chaque skill → avertissement si > 6 mois
2. `data/sources.json` → dates de dernière récupération des données
3. `scripts/update_data.py --check` → vérifie sans modifier, `--force` → re-télécharge
4. Le skill `comptable` vérifie les taux en ligne quand il a un doute (BOFiP, impots.gouv.fr)

Le backend doit exécuter `update_data.py` en cron quotidien, pas reconstruire ce mécanisme.

### 1.2 Matrice Build vs Reuse

| Composant | Build | Reuse | Hybrid | Détail |
|---|---|---|---|---|
| Parsers CSV bancaires (Qonto/BNP/SG/Boursorama) | ✓ | | | N'existe pas dans le repo. À construire. |
| Normalisation transactions | ✓ | | | Mais s'aligner sur le format `data/transactions/` du repo. |
| Catégorisation IA (prompt → PCG) | | ✓ | | Skill `comptable` injecté tel quel comme prompt système. |
| Calcul IS | | | ✓ | L'IA calcule via le skill. Le backend valide le montant (double-check arithmétique). |
| Calcul amortissements | | | ✓ | Idem — IA calcule, backend valide et persiste. |
| Calcul PCA/CCA (prorata temporis) | | | ✓ | Idem. |
| Workflow clôture (orchestration) | ✓ | | | État, progression, persistence, UI. Le backend orchestre. |
| Workflow clôture (logique métier par étape) | | ✓ | | L'IA exécute via `cloture-workflow.md`. |
| Génération FEC | | ✓ | | `generate-fec.js` appelé via adapter. |
| Génération états financiers | | ✓ | | `generate-statements.js` appelé via adapter. |
| Génération PDFs | | ✓ | | `generate-pdfs.js` + templates HTML. |
| Connecteur Qonto | | ✓ | | `integrations/qonto/fetch.js` intégré au pipeline d'import. |
| Connecteur Stripe | | ✓ | | `integrations/stripe/fetch.js` intégré au pipeline d'import. |
| PCG data (800+ comptes) | | ✓ | | `data/pcg_YYYY.json` lu depuis le filesystem. |
| Nomenclature liasse fiscale | | ✓ | | `data/nomenclature-liasse-fiscale.csv` lu depuis le filesystem. |
| Templates liasse/2065/PV/déclaration | | ✓ | | `templates/` remplis par les scripts existants. |
| Fraîcheur réglementaire | | ✓ | | `update_data.py` en cron quotidien. |
| Calendrier fiscal / échéances | | ✓ | | Le skill `comptable` gère dynamiquement. |
| Auth (Clerk) | ✓ | | | N'existe pas dans le repo. |
| Subscription / Billing (Stripe) | ✓ | | | N'existe pas dans le repo. |
| Multi-tenancy / BDD | ✓ | | | Le repo est single-user filesystem. |
| API REST / SSE | ✓ | | | N'existe pas dans le repo. |
| Chat IA (infra web) | ✓ | | | Le skill fonctionne mais pas via API web. |
| Rate limiting / Cost tracking | ✓ | | | N'existe pas dans le repo. |
| Audit trail / Notifications | ✓ | | | N'existe pas dans le repo. |

### 1.3 Analyse du prototype frontend — écrans identifiés

| # | Écran | Route frontend | Endpoints backend |
|---|---|---|---|
| 1 | Onboarding — Identité | `/onboarding/identity` | `POST /api/companies` (SIREN lookup + création) |
| 2 | Onboarding — Régime fiscal | `/onboarding/fiscal` | `PATCH /api/companies/:id` |
| 3 | Onboarding — Exercice | `/onboarding/exercise` | `PATCH /api/companies/:id` |
| 4 | Onboarding succès | `/onboarding/done` | Aucun (redirection) |
| 5 | Import — état vide | `/dashboard` (conditionnel) | `GET /api/imports` (retourne vide) |
| 6 | Import — traitement | `/imports/:id/processing` | `GET /api/imports/:id/status` (SSE) |
| 7 | Dashboard | `/dashboard` | `GET /api/dashboard/kpis`, `GET /api/transactions?limit=6` |
| 8 | Transactions (liste) | `/transactions` | `GET /api/transactions` (paginé, filtré) |
| 9 | Correction transaction | `/transactions/:id/review` | `GET .../suggestions`, `PATCH .../categorize` |
| 10 | Écritures comptables | `/ecritures` | `GET /api/journal-entries` (paginé, filtré) |
| 11 | Documents | `/documents` | `GET /api/documents`, `POST .../generate` |
| 12 | Clôture annuelle | `/cloture` | `GET /api/cloture/status`, `POST .../steps/:step` |
| 13 | Profil entreprise | `/profil` | `GET/PATCH/DELETE /api/companies/:id` |
| 14 | Chat IA (panneau) | Composant global | `POST /api/chat/message` (SSE streaming) |

### 1.4 Éléments manquants dans le prototype frontend

> **Statut v3 : tous les 12 gaps sont désormais couverts** par les endpoints API. Les 9 endpoints et 1 champ modèle ajoutés en v3 comblent les trous identifiés lors de l'audit croisé des 28 écrans.

| # | Écran manquant | Impact backend | Criticité | Couverture API v3 |
|---|---|---|---|---|
| 1 | **Authentification** | Auth Clerk | Critique | ✅ Clerk managed |
| 2 | **Gestion abonnement** | Stripe Billing, webhooks | Critique | ✅ `/api/subscription/*` |
| 3 | **Historique imports** | `GET /api/imports` | Haute | ✅ + `retry` (v3) |
| 4 | **Gestion immobilisations** | CRUD `/api/immobilisations` | Haute | ✅ |
| 5 | **Détail étape clôture** | `/api/cloture/steps/:step` | Haute | ✅ |
| 6 | **États d'erreur** | Error handling, retry | Haute | ✅ + `retry-categorization` (v3) |
| 7 | **Mapping CSV manuel** | `/api/imports/:id/column-mapping` | Haute | ✅ + `detected-columns` (v3) |
| 8 | **Config connecteurs** | CRUD `/api/integrations` | Moyenne | ✅ + `lastFetchCount` (v3) |
| 9 | **Notifications** | Table + SSE/polling | Moyenne | ✅ + `read-all` (v3) |
| 10 | **Audit trail** | `activity_log` | Moyenne | ✅ `GET /api/activity-log` + `/export` (v3) |
| 11 | **Rapprochement bancaire** | Step clôture interactif | Moyenne | ✅ |
| 12 | **Multi-exercice** | Filtre `fiscal_year_id` | Basse (V1) | ✅ `GET/POST /api/fiscal-years` (v3) |

---

## 2. Stack technique

| Couche | Technologie | Version | Justification |
|---|---|---|---|
| Runtime | Node.js | 20 LTS | Scripts Paperasse existants en JS — compatibilité directe |
| Langage | TypeScript | 5.x | Type safety, cohérence ShopPilote |
| Framework web | Remix | v2+ | Cohérence ShopPilote, SSR pour landing |
| ORM | Prisma | 5.x | Migrations, type-safe queries |
| Base de données | PostgreSQL | 16 | Données structurées, JSON columns |
| Queue / Jobs | BullMQ | 5.x | Import, catégorisation, docs (async) |
| Cache / Broker | Redis | 7.x | Queue BullMQ + cache prompt + rate limiting |
| IA / LLM | Anthropic API (Claude Sonnet) | claude-sonnet-4-20250514 | Skills Paperasse conçus pour Claude |
| Auth | Clerk | Latest | Onboarding rapide, SSO futur |
| File storage | Scaleway Object Storage | — | Souveraineté FR |
| Hébergement | Render | — | Cohérence ShopPilote |
| Monitoring | Sentry + Prometheus | — | Errors + metrics |
| Repo Paperasse | Fork Git (MIT) | master | Scripts, skills, data, templates — mis à jour via git pull |

---

## 3. Composant critique : PaperasseAdapter

### 3.1 Rôle

Le PaperasseAdapter est le **pont entre le monde BDD du SaaS (Prisma/PostgreSQL) et le monde filesystem du repo Paperasse**. Sans lui, les scripts existants ne peuvent pas fonctionner.

### 3.2 Interface

```typescript
interface PaperasseAdapter {
  // ═══ BDD → Paperasse (pour alimenter les scripts) ═══

  // Exporte une Company Prisma au format company.json du repo
  toCompanyJson(company: CompanyWithRelations): PaperasseCompanyJson;

  // Exporte les écritures Prisma au format journal-entries.json
  toJournalEntriesJson(entries: JournalEntryWithLines[]): PaperasseJournalEntry[];

  // Exporte les immobilisations pour le calcul amortissement
  toImmobilisationsJson(immos: Immobilisation[]): PaperasseImmobilisation[];

  // ═══ Paperasse → BDD (pour ingérer les résultats des scripts/connecteurs) ═══

  // Convertit les transactions Qonto/Stripe fetch en format Prisma
  fromTransactionsJson(data: PaperasseTransaction[]): CreateTransactionInput[];

  // Convertit les écritures générées par l'IA en format Prisma
  fromAIJournalEntries(data: AICategorizationResult[]): CreateJournalEntryInput[];

  // ═══ Filesystem helpers (pour préparer l'environnement des scripts) ═══

  // Crée un répertoire temporaire avec company.json + journal-entries.json
  // pour exécuter les scripts Paperasse
  prepareWorkDir(
    company: CompanyWithRelations,
    entries: JournalEntryWithLines[]
  ): Promise<string>; // retourne le chemin du répertoire

  // Nettoie le répertoire temporaire après exécution
  cleanupWorkDir(workDir: string): Promise<void>;
}
```

### 3.3 Flux d'exécution des scripts Paperasse

```
Backend reçoit une requête "Générer le FEC"
  │
  ├── 1. Charge Company + JournalEntries depuis PostgreSQL (Prisma)
  │
  ├── 2. PaperasseAdapter.prepareWorkDir()
  │      → Crée /tmp/paperasse-{uuid}/
  │      → Écrit company.json (via toCompanyJson)
  │      → Écrit data/journal-entries.json (via toJournalEntriesJson)
  │      → Copie data/pcg_YYYY.json depuis le fork
  │      → Copie templates/ depuis le fork
  │
  ├── 3. Exécute le script :
  │      child_process.execFile('node', ['scripts/generate-fec.js'], {
  │        cwd: workDir,
  │        env: { ...process.env, PAPERASSE_DATA_DIR: workDir + '/data' }
  │      })
  │
  ├── 4. Récupère le fichier généré (ex: workDir/output/fec-2025.txt)
  │
  ├── 5. Upload sur S3 → crée enregistrement Document en BDD
  │
  └── 6. PaperasseAdapter.cleanupWorkDir()
```

### 3.4 Variante : import comme module Node.js

Si les scripts Paperasse exportent leurs fonctions (à vérifier lors de l'audit du fork), l'adapter peut les importer directement :

```typescript
// Si generate-fec.js exporte une fonction
import { generateFEC } from '@paperasse/scripts/generate-fec';

const fecContent = generateFEC(companyJson, journalEntriesJson);
// → Pas besoin de workDir ni de child_process
```

L'architecte doit auditer les scripts pour déterminer s'ils sont importables ou seulement exécutables en CLI. Si CLI-only, le pattern workDir est le fallback.

---

## 4. Modèle de données

### 4.1 Schéma Prisma (entities principales)

```prisma
// ══════════════════════════════════════
// AUTH & TENANCY
// ══════════════════════════════════════

model User {
  id            String    @id @default(cuid())
  clerkId       String    @unique
  email         String    @unique
  name          String?
  companies     Company[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Company {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Identité
  name            String
  legalForm       LegalForm
  siren           String    @unique
  siret           String?
  nafCode         String?
  nafLabel        String?
  rcs             String?
  capital         Int?
  addressStreet   String?
  addressPostal   String?
  addressCity     String?

  // Dirigeant
  managerName     String?
  managerRole     String?

  // Fiscal
  corporateTax    TaxType       // IS | IR
  vatRegime       VatRegime     // FRANCHISE | REEL_SIMPLIFIE | REEL_NORMAL
  vatThreshold    Int?
  incomeRegime    String?       // BIC | BNC | BA (si IR)

  // État
  onboardingComplete  Boolean   @default(false)
  status              CompanyStatus @default(ACTIVE)

  // Relations
  fiscalYears     FiscalYear[]
  bankAccounts    BankAccount[]
  integrations    Integration[]
  subscriptions   Subscription[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model FiscalYear {
  id            String    @id @default(cuid())
  companyId     String
  company       Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  startDate     DateTime
  endDate       DateTime
  status        FiscalYearStatus  // OPEN | CLOSING | CLOSED
  closedAt      DateTime?

  imports          Import[]
  transactions     Transaction[]
  journalEntries   JournalEntry[]
  categorizations  Categorization[]
  corrections      CorrectionRule[]
  immobilisations  Immobilisation[]
  clotureState     ClotureState?
  documents        Document[]
  chatSessions     ChatSession[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([companyId, startDate, endDate])
}

// ══════════════════════════════════════
// INTEGRATIONS (Qonto, Stripe)
// ══════════════════════════════════════

model Integration {
  id          String    @id @default(cuid())
  companyId   String
  company     Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)

  type        IntegrationType   // QONTO | STRIPE
  name        String            // "Compte principal", "Mon SaaS"
  config      Json              // Chiffré : { qonto_id, stripe_account_id, etc. }
  // Les secrets API (QONTO_API_SECRET, STRIPE_SECRET) sont stockés
  // chiffrés AES-256-GCM avec une clé par company, PAS en clair dans la config.
  encryptedSecret String
  lastFetchAt DateTime?
  lastFetchCount Int?          // Nombre de transactions du dernier fetch (v3)
  status      IntegrationStatus // ACTIVE | ERROR | DISCONNECTED

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

// ══════════════════════════════════════
// BANK & IMPORT
// ══════════════════════════════════════

model BankAccount {
  id          String    @id @default(cuid())
  companyId   String
  company     Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  bank        String
  iban        String?
  label       String
  pcgAccount  String    @default("5121")
  imports     Import[]
  createdAt   DateTime  @default(now())
}

model Import {
  id              String    @id @default(cuid())
  fiscalYearId    String
  fiscalYear      FiscalYear @relation(fields: [fiscalYearId], references: [id])
  bankAccountId   String?
  bankAccount     BankAccount? @relation(fields: [bankAccountId], references: [id])

  sourceType      ImportSource   // CSV_UPLOAD | QONTO_API | STRIPE_API
  originalFilename String?
  s3Key           String?
  fileFormat      String?         // qonto | bnp | sg | boursorama | generic
  fileEncoding    String?
  fileSeparator   String?

  status          ImportStatus    // PENDING | PARSING | CATEGORIZING | REVIEW | DONE | ERROR
  totalRows       Int?
  parsedRows      Int?
  categorizedRows Int?
  reviewRows      Int?
  errorMessage    String?

  startedAt       DateTime?
  completedAt     DateTime?
  durationMs      Int?

  transactions    Transaction[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// ══════════════════════════════════════
// TRANSACTIONS & CATEGORIZATION
// ══════════════════════════════════════

model Transaction {
  id              String    @id @default(cuid())
  fiscalYearId    String
  fiscalYear      FiscalYear @relation(fields: [fiscalYearId], references: [id])
  importId        String
  import          Import    @relation(fields: [importId], references: [id])

  sourceId        String?
  date            DateTime
  label           String
  counterparty    String?
  amount          Decimal
  currency        String          @default("EUR")
  type            TransactionType // DEBIT | CREDIT
  sourceRef       String?
  sourceCategory  String?
  notes           String?

  categorization  Categorization?
  journalEntryId  String?
  journalEntry    JournalEntry?   @relation(fields: [journalEntryId], references: [id])

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([fiscalYearId, date])
  @@index([importId])
}

model Categorization {
  id              String    @id @default(cuid())
  fiscalYearId    String
  fiscalYear      FiscalYear @relation(fields: [fiscalYearId], references: [id])
  transactionId   String    @unique
  transaction     Transaction @relation(fields: [transactionId], references: [id])

  accountDebit    String?
  accountCredit   String?
  journal         String?
  ecritureLabel   String?
  confidence      Confidence      // HIGH | MEDIUM | LOW
  aiRationale     String?

  alternatives    Json?           // [{account, label, confidence_pct}]

  status          CategorizationStatus // AI_PROPOSED | USER_CONFIRMED | USER_CORRECTED | MANUAL
  confirmedAt     DateTime?

  originalAccountDebit  String?
  originalAccountCredit String?
  correctionNote        String?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([fiscalYearId, status])
}

model CorrectionRule {
  id              String    @id @default(cuid())
  fiscalYearId    String
  fiscalYear      FiscalYear @relation(fields: [fiscalYearId], references: [id])

  counterparty    String
  preferredAccount String
  condition       String?
  active          Boolean         @default(true)
  sourceTransactionId String?
  note            String?

  createdAt       DateTime  @default(now())
}

// ══════════════════════════════════════
// JOURNAL & ÉCRITURES
// ══════════════════════════════════════

model JournalEntry {
  id              String    @id @default(cuid())
  fiscalYearId    String
  fiscalYear      FiscalYear @relation(fields: [fiscalYearId], references: [id])

  num             Int
  date            DateTime
  journal         String          // BQ | AC | VE | OD
  ref             String?
  label           String
  source          EntrySource     // IMPORT | CLOTURE | MANUAL

  lines           JournalLine[]
  transactions    Transaction[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([fiscalYearId, num])
  @@index([fiscalYearId, journal])
  @@index([fiscalYearId, date])
}

model JournalLine {
  id              String    @id @default(cuid())
  journalEntryId  String
  journalEntry    JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)

  account         String
  accountLabel    String?
  debit           Decimal         @default(0)
  credit          Decimal         @default(0)
  auxAccount      String?
  auxLabel        String?

  @@index([journalEntryId])
}

// ══════════════════════════════════════
// CLÔTURE
// ══════════════════════════════════════

model ClotureState {
  id              String    @id @default(cuid())
  fiscalYearId    String    @unique
  fiscalYear      FiscalYear @relation(fields: [fiscalYearId], references: [id])

  currentStep     Int       @default(0)
  status          ClotureStatus

  // État par étape — structure variable, validé côté application
  stepsState      Json      @default("{}")

  // Résultats calculés (persistés après validation backend)
  resultatComptable Decimal?
  resultatFiscal    Decimal?
  impotCalcule      Decimal?

  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Immobilisation {
  id              String    @id @default(cuid())
  fiscalYearId    String
  fiscalYear      FiscalYear @relation(fields: [fiscalYearId], references: [id])

  label           String
  account         String
  acquisitionDate DateTime
  amountHt        Decimal
  method          DepreciationMethod
  usefulLifeYears Int
  annualDepreciation  Decimal?
  depreciationCurrentYear Decimal?
  netBookValue        Decimal?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// ══════════════════════════════════════
// DOCUMENTS
// ══════════════════════════════════════

model Document {
  id              String    @id @default(cuid())
  fiscalYearId    String
  fiscalYear      FiscalYear @relation(fields: [fiscalYearId], references: [id])

  type            DocumentType    // FEC | BALANCE | BILAN | COMPTE_RESULTAT | LIASSE | GRAND_LIVRE
  format          String          // txt | pdf | csv
  s3Key           String
  filename        String
  sizeBytes       Int?
  entriesCount    Int?

  // Traçabilité de la génération
  generatedBy     String          // "script:generate-fec" | "script:generate-pdfs" | "script:generate-statements"
  scriptVersion   String?         // Hash du commit du fork Paperasse utilisé
  generatedAt     DateTime  @default(now())
  createdAt       DateTime  @default(now())
}

// ══════════════════════════════════════
// CHAT
// ══════════════════════════════════════

model ChatSession {
  id              String    @id @default(cuid())
  fiscalYearId    String
  fiscalYear      FiscalYear @relation(fields: [fiscalYearId], references: [id])
  messages        ChatMessage[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model ChatMessage {
  id              String    @id @default(cuid())
  sessionId       String
  session         ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role            String          // "user" | "assistant"
  content         String
  tokensInput     Int?
  tokensOutput    Int?
  costCents       Int?
  durationMs      Int?
  createdAt       DateTime  @default(now())
}

// ══════════════════════════════════════
// BILLING
// ══════════════════════════════════════

model Subscription {
  id              String    @id @default(cuid())
  companyId       String
  company         Company   @relation(fields: [companyId], references: [id])

  tier            SubscriptionTier
  stripeCustomerId    String?
  stripeSubscriptionId String?
  status          SubscriptionStatus
  trialEndsAt     DateTime?
  currentPeriodEnd DateTime?

  aiRequestsThisMonth  Int   @default(0)
  aiCostCentsThisMonth Int   @default(0)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// ══════════════════════════════════════
// AUDIT & NOTIFICATIONS
// ══════════════════════════════════════

model ActivityLog {
  id          String    @id @default(cuid())
  companyId   String
  userId      String?
  action      String
  entityType  String?
  entityId    String?
  metadata    Json?
  createdAt   DateTime  @default(now())
  @@index([companyId, createdAt])
}

model Notification {
  id          String    @id @default(cuid())
  companyId   String
  type        String
  title       String
  message     String
  severity    String
  readAt      DateTime?
  dismissedAt DateTime?
  createdAt   DateTime  @default(now())
  @@index([companyId, readAt])
}

// ══════════════════════════════════════
// ENUMS
// ══════════════════════════════════════

enum LegalForm { AUTO_ENTREPRENEUR EI EURL SASU SARL SAS SA SCI AUTRE }
enum TaxType { IS IR }
enum VatRegime { FRANCHISE REEL_SIMPLIFIE REEL_NORMAL }
enum CompanyStatus { ACTIVE SUSPENDED DELETED }
enum FiscalYearStatus { OPEN CLOSING CLOSED }
enum IntegrationType { QONTO STRIPE }
enum IntegrationStatus { ACTIVE ERROR DISCONNECTED }
enum ImportSource { CSV_UPLOAD QONTO_API STRIPE_API }
enum ImportStatus { PENDING PARSING NEEDS_MAPPING CATEGORIZING REVIEW DONE ERROR }
enum TransactionType { DEBIT CREDIT }
enum Confidence { HIGH MEDIUM LOW }
enum CategorizationStatus { AI_PROPOSED USER_CONFIRMED USER_CORRECTED MANUAL }
enum EntrySource { IMPORT CLOTURE MANUAL }
enum ClotureStatus { NOT_STARTED IN_PROGRESS COMPLETED }
enum DepreciationMethod { LINEAR DEGRESSIVE }
enum DocumentType { FEC BALANCE BILAN COMPTE_RESULTAT LIASSE GRAND_LIVRE PV_COMPTES DECLARATION_CONFIDENTIALITE CHECKLIST_GREFFE }
enum SubscriptionTier { SOLO ENTREPRISE ENTREPRISE_PLUS }
enum SubscriptionStatus { TRIAL ACTIVE PAST_DUE CANCELED }
```

### 4.2 Notes sur le schéma

- **Multi-tenancy** : isolation par `companyId`. Middleware systématique.
- **Decimal pour les montants** : jamais Float. Erreurs d'arrondi = erreurs comptables.
- **`Document.generatedBy`** : trace quel script Paperasse a généré le document.
- **`Document.scriptVersion`** : hash du commit du fork — pour la traçabilité (quel version des règles comptables a produit ce FEC).
- **`Integration`** : modèle les connecteurs Qonto/Stripe avec secrets chiffrés. Permet de déclencher les fetch scripts du repo.
- **`ImportStatus.NEEDS_MAPPING`** : nouveau statut (absent de la v1) pour le cas GenericParser.

---

## 5. Architecture des services

### 5.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (React / Remix)                         │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API LAYER (Remix)                               │
│  Auth Middleware → Company Middleware → Subscription Middleware → Routes  │
└────────┬──────────┬──────────┬──────────┬──────────┬────────────────────┘
         │          │          │          │          │
         ▼          ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐
│ SERVICE  │ │ SERVICE  │ │  SERVICE   │ │ SERVICE  │ │ SERVICE  │
│  IMPORT  │ │   IA     │ │DOCUMENTS   │ │ CLÔTURE  │ │  CHAT    │
│          │ │          │ │(REUSE)     │ │(HYBRID)  │ │          │
│ BUILD:   │ │ REUSE:   │ │            │ │          │ │ REUSE:   │
│ - CSV    │ │ - Skill  │ │ REUSE:     │ │ BUILD:   │ │ - Skill  │
│   parsers│ │   compta │ │ - generate │ │ - Orches │ │   compta │
│ - Norma- │ │   ble MD │ │   -fec.js  │ │   tration│ │   ble MD │
│   lizer  │ │ - Skill  │ │ - generate │ │ - State  │ │          │
│          │ │   correc │ │   -state-  │ │ - Persis │ │ BUILD:   │
│ REUSE:   │ │   tions  │ │   ments.js │ │   tence  │ │ - Stream │
│ - Qonto  │ │          │ │ - generate │ │          │ │   SSE    │
│   fetch  │ │ BUILD:   │ │   -pdfs.js │ │ REUSE:   │ │ - Cost   │
│ - Stripe │ │ - Prompt │ │ - templates│ │ - cloture│ │   track  │
│   fetch  │ │   compo- │ │            │ │   -work- │ │          │
│          │ │   sition │ │ BUILD:     │ │   flow.md│ │          │
│          │ │ - Batch  │ │ - Adapter  │ │ - Skill  │ │          │
│          │ │ - Cost   │ │ - S3 up-   │ │   compta │ │          │
│          │ │   track  │ │   load     │ │   ble MD │ │          │
└──────────┘ └──────────┘ └────────────┘ └──────────┘ └──────────┘
         │          │          │          │          │
         ▼          ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       PAPERASSE ADAPTER                                  │
│  toCompanyJson() │ toJournalEntriesJson() │ fromTransactionsJson()       │
│  prepareWorkDir() │ cleanupWorkDir()                                     │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌──────────────┐   ┌───────────────────┐   ┌──────────────┐
│  Fork repo   │   │    PostgreSQL     │   │  S3 (SCW)    │
│  Paperasse   │   │    (Prisma)       │   │  Files       │
│  /paperasse  │   │                   │   │              │
│              │   │                   │   │              │
│  scripts/    │   │                   │   │              │
│  data/       │   │                   │   │              │
│  templates/  │   │                   │   │              │
│  skills/     │   │                   │   │              │
│  integra-    │   │                   │   │              │
│  tions/      │   │                   │   │              │
└──────────────┘   └───────────────────┘   └──────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       SERVICES EXTERNES                                  │
│  Anthropic API │ Clerk Auth │ Stripe Billing │ API Qonto │ API Stripe   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Service Import — pipeline (6 étapes BullMQ)

Le service le plus complexe. 6 étapes séquentielles (v1 en avait 5 — ajout du step NEEDS_MAPPING).

**Source CSV (BUILD) :**

| Étape | Action | Build/Reuse |
|---|---|---|
| 1. `detect_format` | Lit 5 premières lignes, détecte encodage/séparateur/banque | BUILD |
| 2. `parse_and_normalize` | Parse avec le parser spécifique, normalise en Transaction | BUILD |
| 2b. `needs_mapping` (si format inconnu) | Renvoie les colonnes détectées, attend le mapping utilisateur | BUILD |
| 3. `apply_correction_rules` | Match CorrectionRules sur counterparty, pré-catégorise | BUILD |
| 4. `ai_categorize` | Batch 15-25 tx par appel Claude, skill `comptable` comme prompt | REUSE skill |
| 5. `generate_journal_entries` | Crée les JournalEntry + JournalLines en partie double | BUILD |

**Source Qonto API (REUSE) :**

| Étape | Action | Build/Reuse |
|---|---|---|
| 1. `fetch_qonto` | Exécute `integrations/qonto/fetch.js` avec les credentials déchiffrés | REUSE script |
| 2. `normalize_qonto` | PaperasseAdapter.fromTransactionsJson() | BUILD adapter |
| 3-5 | Identique au CSV (correction rules, IA categorize, journal entries) | Idem |

**Source Stripe API (REUSE) :**

| Étape | Action | Build/Reuse |
|---|---|---|
| 1. `fetch_stripe` | Exécute `integrations/stripe/fetch.js` avec les credentials déchiffrés | REUSE script |
| 2. `normalize_stripe` | PaperasseAdapter.fromTransactionsJson() | BUILD adapter |
| 3-5 | Identique au CSV | Idem |

**Parsers CSV (BUILD) :**

| Parser | Headers caractéristiques | Particularités |
|---|---|---|
| QontoParser | `ID de l'opération;...;Sens;Contrepartie` | Colonne Sens, contrepartie séparée |
| BnpParser | `Date opération;...;Montant(EUR)` | Montant signé, dates DD/MM/YYYY |
| SgParser | `Date;Libellé opération;Détail;Montant` | Libellé + détail séparés |
| BoursoramaParser | `dateOp;dateVal;label;amount` | Point décimal, YYYY-MM-DD |
| GenericParser | Fallback → `NEEDS_MAPPING` | Détection heuristique → mapping manuel UI |

### 5.3 Service Documents — quasi-intégralement REUSE

| Job BullMQ | Script Paperasse | Build/Reuse | Notes |
|---|---|---|---|
| `generate_fec` | `scripts/generate-fec.js` | **REUSE** | Adapter prépare le workDir, script génère le .txt |
| `generate_statements` | `scripts/generate-statements.js` | **REUSE** | Génère Bilan, CR, Balance en JSON |
| `generate_pdfs` | `scripts/generate-pdfs.js` | **REUSE** | Utilise les templates HTML du repo |
| `generate_balance_pdf` | Inclus dans `generate-pdfs.js` | **REUSE** | |
| `generate_grand_livre_pdf` | Inclus dans `generate-pdfs.js` | **REUSE** | |
| `generate_liasse` | Templates `liasse-fiscale-2033.md` | **REUSE** | L'IA remplit le template, le script PDF le convertit |
| `upload_to_s3` | — | **BUILD** | Upload résultats sur S3 + enregistrement Document en BDD |

**Flux complet :**

```
Requête "Générer FEC"
  → PaperasseAdapter.prepareWorkDir(company, journalEntries)
  → exec('node scripts/generate-fec.js', { cwd: workDir })
  → Lire workDir/output/fec-2025.txt
  → S3.upload(fec-2025.txt)
  → prisma.document.create({ type: FEC, s3Key, generatedBy: 'script:generate-fec' })
  → PaperasseAdapter.cleanupWorkDir()
```

### 5.4 Service Clôture — HYBRID (backend orchestre, IA exécute)

**Principe :** Le backend ne hardcode PAS les règles comptables (IS, amortissements, PCA). Le skill `comptable` + `cloture-workflow.md` contiennent toute la logique. Le backend :
- Gère l'état du workflow (quelle étape, quel statut)
- Persiste les résultats de chaque étape
- Collecte les inputs utilisateur (solde bancaire, immobilisations, provisions)
- Appelle l'IA avec le bon contexte pour chaque étape
- Valide les résultats (double-check arithmétique sur les montants critiques)
- Déclenche les scripts de génération à la fin (étapes 10-12)

| Étape | Backend fait | IA fait (via skill) | Script Paperasse |
|---|---|---|---|
| 1. Vérification balance | Charge toutes les JournalLines, vérifie ΣDébit = ΣCrédit | Analyse les soldes anormaux, signale les anomalies | — |
| 2. Rapprochement bancaire | Collecte le solde réel saisi par l'utilisateur, calcule l'écart | — (calcul trivial côté backend) | — |
| 3. Lettrage tiers | Charge les comptes 401/411, cherche les matchs montant/date | Propose les lettrages ambigus | — |
| 4. Régularisations PCA/CCA | Collecte la validation utilisateur | Détecte les charges annuelles, calcule le prorata temporis, propose les écritures OD | — |
| 5. Amortissements | Charge les immobilisations saisies par l'utilisateur | Calcule les dotations (linéaire/dégressif/prorata), propose les écritures OD | — |
| 6. Provisions | Collecte les risques/litiges déclarés par l'utilisateur | Évalue les montants, propose les écritures OD | — |
| 7. TVA annuelle | — (pas d'input) | Calcule TVA collectée - TVA déductible, vérifie cohérence | — |
| 8. Calcul IS/IR | — | Calcule le résultat fiscal + IS (taux réduit PME si éligible), propose l'écriture 695/444 | — |
| 9. Écritures de clôture | Persiste toutes les écritures OD générées aux étapes 4-8 | Génère l'affectation du résultat | — |
| 10. États financiers | Déclenche le script | — | `generate-statements.js` |
| 11. Liasse fiscale | Déclenche le script | Remplit le template avec les montants calculés | `generate-pdfs.js` |
| 12. Export & archivage | Déclenche le script + S3 upload | — | `generate-fec.js` + `generate-pdfs.js` |

**Double-check backend (validation arithmétique) :**

Après chaque étape IA qui produit des montants, le backend vérifie :
- Étape 5 : dotation amortissement = montant_HT × (jours/365) / durée_vie. Si l'IA renvoie un montant qui dévie de plus de 1 € du calcul backend, alerte.
- Étape 8 : IS = résultat_fiscal × 15% (si < 42 500 €) + (résultat_fiscal - 42 500) × 25%. Vérification arithmétique stricte.
- Étape 10 : Total Actif = Total Passif. Si déséquilibre, blocage.

Ce double-check est simple à coder (quelques formules arithmétiques) et apporte un filet de sécurité sans dupliquer la logique métier complète.

### 5.5 Service Chat — REUSE skill + BUILD infra

| Composant | Build/Reuse |
|---|---|
| Prompt système (skill `comptable` complet) | **REUSE** — injecté tel quel |
| Contexte entreprise dans le prompt | **BUILD** — PaperasseAdapter.toCompanyJson() + KPIs calculés |
| Streaming SSE | **BUILD** — Anthropic API streaming → SSE vers le client |
| Historique conversation | **BUILD** — table ChatMessage, 5 derniers messages injectés |
| Cost tracking | **BUILD** — middleware trackAICost() |

---

## 6. Intégration IA — prompt engineering

### 6.1 Prompt catégorisation (batch)

```
PROMPT SYSTÈME (assemblé par le backend) :
│
├── Skill comptable/SKILL.md (sections catégorisation)     ~8 000 tokens
├── PCG sous-ensemble pertinent (data/pcg_YYYY.json)       ~3 000 tokens
├── Contexte entreprise (PaperasseAdapter.toCompanyJson)    ~300 tokens
├── Règles de correction apprises (CorrectionRule[])        ~200-500 tokens
├── Instructions de sortie (JSON strict)                    ~200 tokens
│
└── TOTAL : ~12 000 – 15 000 tokens input
```

### 6.2 Prompt chat

```
PROMPT SYSTÈME :
│
├── Skill comptable/SKILL.md COMPLET                       ~12 000 tokens
├── Contexte entreprise                                     ~300 tokens
├── KPIs actuels (CA, charges, résultat, trésorerie)        ~100 tokens
├── Historique conversation (5 derniers messages)            ~500-1000 tokens
│
└── TOTAL : ~18 000 – 28 000 tokens input
```

### 6.3 Prompt clôture (par étape)

```
PROMPT SYSTÈME :
│
├── Skill comptable/SKILL.md                                ~12 000 tokens
├── comptable/references/cloture-workflow.md                 ~2 000 tokens
├── Contexte entreprise                                      ~300 tokens
├── État clôture (étapes complétées, résultats)              ~500-1000 tokens
├── Données de l'étape (immobilisations, PCA, etc.)          ~500-2000 tokens
├── Instructions spécifiques à l'étape                       ~200 tokens
│
└── TOTAL : ~16 000 – 28 000 tokens input
```

### 6.4 Gestion des coûts

| Opération | Tokens input | Tokens output | Coût estimé |
|---|---|---|---|
| Catégorisation batch (20 tx) | ~15 000 | ~3 000 | ~0,09 € |
| Message chat | ~20 000 | ~1 500 | ~0,08 € |
| Étape clôture (IA-assistée) | ~25 000 | ~4 000 | ~0,14 € |
| Import 200 transactions | ~10 appels | | ~0,90 € |
| Mois utilisateur moyen | 1 import + 10 chat | | ~1,70 € |
| Clôture complète | ~15-20 appels | | ~2-4 € |

Estimations basées sur le pricing Anthropic Sonnet 4 ($3/M input, $15/M output). À valider par des tests réels.

### 6.5 Cache et optimisation

- **Cache Redis PCG statique** : définitions comptes. TTL 24h.
- **Cache taux réglementaires** : via `update_data.py` en cron quotidien (REUSE repo).
- **Prompt système pré-compilé** : skill Markdown parsé au démarrage serveur. Seuls les blocs contextuels dynamiques.
- **Batch optimal** : 15-25 transactions/appel. < 15 = coût fixe trop élevé. > 25 = qualité dégrade.

---

## 7. API — endpoints

### 7.1 Middleware chaîne

```
clerkAuth() → loadUser() → loadCompany() → checkSubscription() → rateLimiter() → activityLogger()
```

### 7.2 Routes complètes

#### Webhooks
```
POST /webhooks/clerk            Webhook Clerk (user.created, user.updated)
POST /webhooks/stripe           Webhook Stripe Billing (subscription events)
```

#### Company & Onboarding
```
POST   /api/companies           Créer (onboarding step 1 — SIREN lookup inclus)
GET    /api/companies/:id       Récupérer
PATCH  /api/companies/:id       Modifier (steps 2-3, profil)
DELETE /api/companies/:id       Soft delete (danger zone)
GET    /api/siren/:siren        Lookup API Annuaire Entreprises
```

#### Subscription
```
GET    /api/subscription        État abonnement
POST   /api/subscription/checkout   Session Stripe Checkout
POST   /api/subscription/portal     Lien Stripe Customer Portal
```

#### Integrations (Qonto, Stripe)
```
GET    /api/integrations        Liste des connecteurs configurés
POST   /api/integrations        Ajouter un connecteur (type, credentials chiffrés)
PATCH  /api/integrations/:id    Modifier
DELETE /api/integrations/:id    Supprimer
POST   /api/integrations/:id/test   Tester la connexion
POST   /api/integrations/:id/fetch  Déclencher un fetch (→ pipeline import)
```

#### Imports
```
POST   /api/imports             Upload CSV → lance pipeline (ou fetch via integration)
GET    /api/imports             Historique imports
GET    /api/imports/:id         Détail import
GET    /api/imports/:id/status  Statut temps réel (SSE)
GET    /api/imports/:id/detected-columns  Colonnes détectées par GenericParser (v3 — écran Mapping CSV)
POST   /api/imports/:id/column-mapping  Mapping manuel colonnes (si NEEDS_MAPPING)
POST   /api/imports/:id/retry           Retrigger un import échoué (v3 — écran Historique imports)
POST   /api/imports/:id/retry-categorization  Relancer les batches IA échoués uniquement (v3 — écran Erreur IA)
```

#### Transactions
```
GET    /api/transactions        Liste paginée + filtres (status, date, search)
GET    /api/transactions/:id    Détail + catégorisation + suggestions
PATCH  /api/transactions/:id/categorize  Confirmer ou corriger
```

#### Journal & Dashboard
```
GET    /api/journal-entries     Liste paginée + filtres (journal, date, compte)
GET    /api/journal-entries/export  Export CSV
GET    /api/dashboard/kpis      CA, charges, résultat, trésorerie
GET    /api/dashboard/alerts    Alertes actives (TVA, transactions à vérifier, échéances)
```

#### Documents
```
GET    /api/documents           Liste documents générés
POST   /api/documents/:type/generate  Déclencher génération (via scripts Paperasse)
GET    /api/documents/:id/download    URL signée S3
```

#### Clôture
```
GET    /api/cloture             État workflow
POST   /api/cloture/start       Démarrer
GET    /api/cloture/steps/:step  Détail étape (résultat, warnings, inputs attendus)
POST   /api/cloture/steps/:step  Exécuter étape (avec user input optionnel)
```

#### Immobilisations
```
GET    /api/immobilisations     Liste
POST   /api/immobilisations     Ajouter
PATCH  /api/immobilisations/:id Modifier
DELETE /api/immobilisations/:id Supprimer
```

#### Chat
```
POST   /api/chat/message        Envoyer (SSE streaming)
GET    /api/chat/history        Historique session
```

#### Correction Rules
```
GET    /api/corrections         Liste règles apprises
DELETE /api/corrections/:id     Supprimer une règle
```

#### Notifications
```
GET    /api/notifications       Non lues
PATCH  /api/notifications/read-all    Tout marquer comme lu (v3 — bouton proto Notifications)
PATCH  /api/notifications/:id/read    Marquer lue
PATCH  /api/notifications/:id/dismiss Masquer
```

#### Journal d'activité (v3)
```
GET    /api/activity-log        Liste paginée + filtres (type: import|categorization|cloture|document|profile)
GET    /api/activity-log/export Export CSV complet
```

#### Exercices comptables (v3)
```
GET    /api/fiscal-years              Liste des exercices de la company (statut, compteurs tx/écritures/docs)
POST   /api/fiscal-years              Créer un nouvel exercice
PATCH  /api/fiscal-years/:id/activate Switcher l'exercice actif
```

#### Portabilité RGPD (v3)
```
GET    /api/exports/all         Export complet des données utilisateur (JSON + CSV) — droit à la portabilité
```

---

## 8. Sécurité et conformité

### 8.1 Chiffrement

| Donnée | At rest | In transit |
|---|---|---|
| PostgreSQL | AES-256 (Render Managed) | TLS 1.3 |
| Fichiers S3 | AES-256 (Scaleway default) | TLS 1.3 |
| Credentials intégrations (Qonto/Stripe) | AES-256-GCM, clé par company | TLS 1.3 |
| Sessions / JWT | Clerk managed | TLS 1.3 |
| WorkDir temporaires (scripts) | Ephémère, supprimé après exécution | Local au serveur |

### 8.2 Rate limiting par tier

| Tier | API req/min | Appels IA/mois | Imports/mois |
|---|---|---|---|
| Solo | 60 | 100 | 5 |
| Entreprise | 120 | 300 | 15 |
| Entreprise+ | 200 | 1000 | 50 |

### 8.3 RGPD

- Données hébergées en France (Scaleway Paris) ou UE (Render EU)
- Consentement explicite au onboarding
- Droit à l'effacement : soft delete → anonymisation 30j → suppression 90j
- Droit à la portabilité : `GET /api/exports/all` → JSON + CSV (route ajoutée en v3, §7.2)
- WorkDir temporaires nettoyés immédiatement après exécution des scripts (pas de données en clair persistantes sur le filesystem)

---

## 9. Infrastructure et déploiement

### 9.1 Services Render

| Service | Type | Contenu | Scaling |
|---|---|---|---|
| `paperasse-web` | Web Service (Node.js) | API + SSR | Auto-scale 1-4 |
| `paperasse-worker` | Background Worker | BullMQ jobs (import, catégorisation, docs) | 1-2 instances |
| `paperasse-db` | PostgreSQL Managed | Toutes les données | Pro (HA) |
| `paperasse-redis` | Redis Managed | BullMQ broker + cache | Standard |

### 9.2 Fork Paperasse

Le fork du repo est cloné sur chaque instance (web + worker) au déploiement. Structure :

```
/app/
├── src/                    # Code TypeScript du SaaS
│   ├── services/
│   │   ├── import/
│   │   ├── ia/
│   │   ├── documents/
│   │   ├── cloture/
│   │   └── chat/
│   ├── adapter/
│   │   └── paperasse-adapter.ts   # LE composant critique
│   └── ...
├── paperasse/              # Fork du repo (git submodule ou clone)
│   ├── comptable/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── cloture-workflow.md
│   ├── controleur-fiscal/
│   ├── commissaire-aux-comptes/
│   ├── notaire/
│   ├── scripts/
│   │   ├── generate-fec.js
│   │   ├── generate-statements.js
│   │   └── generate-pdfs.js
│   ├── integrations/
│   │   ├── qonto/fetch.js
│   │   └── stripe/fetch.js
│   ├── data/
│   │   ├── pcg_2025.json
│   │   ├── nomenclature-liasse-fiscale.csv
│   │   └── sources.json
│   └── templates/
│       ├── declaration-confidentialite.html
│       ├── 2065-sd.html
│       └── ...
└── prisma/
    └── schema.prisma
```

### 9.3 Mise à jour du fork

```
# Cron hebdomadaire sur le repo de déploiement
cd paperasse/ && git pull origin master
# → Les skills, scripts, data et templates sont mis à jour
# → Nécessite un redéploiement (Render redeploy on push)
```

### 9.4 Cron jobs

| Cron | Fréquence | Action |
|---|---|---|
| `update_data.py` | Quotidien 03:00 | Vérifie fraîcheur PCG, nomenclature liasse, sources |
| Reset AI counters | 1er du mois 00:00 | `Subscription.aiRequestsThisMonth = 0` |
| Cleanup workDirs | Toutes les heures | Supprime les workDirs > 1h (sécurité RGPD) |
| Échéances fiscales | Quotidien 08:00 | Vérifie le calendrier fiscal, crée Notifications si deadline < 30j |

### 9.5 Monitoring — métriques Prometheus custom

```
paperasse_import_duration_seconds{format, source}
paperasse_categorization_accuracy{confidence}
paperasse_ai_cost_cents{endpoint, model}
paperasse_ai_tokens{direction, endpoint}
paperasse_script_execution_seconds{script}        # NOUVEAU — durée des scripts Paperasse
paperasse_script_errors_total{script}              # NOUVEAU — erreurs des scripts
paperasse_adapter_conversions_total{direction}     # NOUVEAU — conversions adapter
paperasse_active_clotures
paperasse_documents_generated{type, script}
paperasse_chat_messages_total
```

---

## 10. Points ouverts pour l'architecte

| # | Question | Options | Recommandation |
|---|---|---|---|
| 1 | Scripts Paperasse : importables comme modules ou CLI-only ? | `import { generateFEC }` vs `child_process.exec()` | Auditer le code des scripts. Si export disponible → import direct. Sinon → workDir + exec. |
| 2 | Fork Paperasse : git submodule ou copie ? | Submodule (clean, auto-update) vs copie (indépendant) | Submodule — permet de pull les updates facilement. |
| 3 | Streaming chat : SSE ou WebSocket ? | SSE vs WS | SSE — request-response, pas bidirectionnel. |
| 4 | Import status : polling ou SSE ? | Polling 2s vs SSE push | SSE — meilleure UX. |
| 5 | Scaleway ou Render pour S3 ? | Scaleway (FR) vs R2 (simple) | Scaleway — souveraineté "données en France". |
| 6 | Multi-company par user dès MVP ? | Oui vs Non | Non au MVP. Schéma prêt, activer en V1. |
| 7 | Connecteurs Qonto/Stripe dès MVP ? | Oui (scripts existent) vs Non (CSV only) | Oui en option — le coût d'intégration est faible puisque les scripts existent. CSV reste le default. |

---

## 11. Plan de livraison suggéré

| Phase | Semaines | Livrables | Build vs Reuse |
|---|---|---|---|
| **Foundation** | S1-S2 | Prisma schema, migrations, auth Clerk, CRUD company, onboarding API, CI/CD, **fork Paperasse + adapter squelette** | BUILD |
| **Import pipeline CSV** | S3-S4 | 4 parsers bancaires, normalisation, BullMQ, import status SSE, **GenericParser + NEEDS_MAPPING** | BUILD |
| **Import connecteurs** | S4-S5 | Intégration `qonto/fetch.js` + `stripe/fetch.js` dans le pipeline, CRUD integrations, chiffrement credentials | REUSE + BUILD adapter |
| **Catégorisation IA** | S5-S7 | Service IA, prompt composition (skill MD), batch, correction rules, cost tracking | REUSE skill + BUILD infra |
| **Dashboard + transactions** | S7-S8 | KPI calculations, transactions API, correction flow | BUILD |
| **Journal + documents** | S8-S9 | Journal entries API, **adapter complet (toCompanyJson, toJournalEntriesJson)**, appel `generate-fec.js` + `generate-statements.js` + `generate-pdfs.js`, S3 upload | REUSE scripts + BUILD adapter |
| **Clôture** | S9-S11 | Workflow engine (orchestration), 12 step handlers, **étapes IA = appels Claude avec skill + cloture-workflow.md**, immobilisations CRUD, double-check arithmétique, **appel scripts génération étapes 10-12** | HYBRID |
| **Chat + billing** | S11-S12 | Chat SSE streaming (skill comptable complet en prompt), Stripe Billing, subscription middleware | REUSE skill + BUILD infra |
| **Polish + beta** | S12-S14 | Notifications, activity log, error handling, rate limiting, monitoring, **cron update_data.py**, beta deploy | BUILD + REUSE cron |

---

## 12. Checklist de l'architecte avant de démarrer

- [ ] Forker le repo Paperasse, auditer les 3 scripts Node.js (importables ou CLI-only ?)
- [ ] Vérifier la structure exacte de `company.example.json` — base de l'adapter
- [ ] Vérifier le format de sortie de `qonto/fetch.js` et `stripe/fetch.js` — base de `fromTransactionsJson()`
- [ ] Exécuter les 93 evals du repo pour valider que le skill comptable fonctionne correctement
- [ ] Tester le workflow complet (fetch → catégorisation → clôture → FEC → PDF) manuellement avec Claude Code pour comprendre le flux end-to-end
- [ ] Mesurer le coût réel IA sur 5 cas-types (via les fixtures MVP) avant de fixer le pricing
- [ ] Décider : submodule git ou copie pour le fork
- [ ] Décider : Remix full-stack ou Fastify API-only

---

*Ce cadrage v3 intègre l'audit complet du repo Paperasse ET l'audit croisé des 28 écrans du prototype frontend. Tous les endpoints nécessaires sont documentés (44 routes au total). L'architecte backend doit maintenant produire : (1) l'audit technique des scripts et connecteurs du repo, (2) les spécifications de l'adapter, (3) les diagrammes de séquence pour les 3 flux critiques (import CSV, clôture IA-driven, génération documents via scripts), (4) le plan d'implémentation en sprints.*
