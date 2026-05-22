# Architecture Deepening Plan — Paperasse3

Audit du 2026-05-21. Validé par tech lead review.

## Priorité d'exécution

1. NotificationCenter → NotificationSource providers
2. DocumentEvidenceBundle → EvidenceSectionProvider
3. VAT consolidation
4. ImportOrchestrator ports
5. Shallow module cleanup
6. Prisma query functions (modules à forte orchestration)

---

## 1. NotificationCenter → NotificationSource

**Problème :** `NotificationCenter` importe 16 centers étrangers. `buildNotificationSpecs` fait 15 appels parallèles puis 30+ conditions. Chaque nouveau domaine doit être câblé ici.

**Solution :** Chaque domaine expose `getNotificationSpecs(workspace): NotificationSpec[]`. NotificationCenter orchestre, upsert, expire, read/dismiss.

| # | Question | Recommandation |
|---|----------|----------------|
| 1.1 | Placement contrat | `notifications/types.ts` exporte `NotificationSource` + `NotificationSpec` |
| 1.2 | Format retour sources | Option A : chaque source retourne `NotificationSpec[]` |
| 1.3 | Enregistrement sources | Array `NotificationSource[]` passé au constructeur, pas registry |
| 1.4 | Granularité sources | Ajouter `getNotificationSpecs()` aux centers existants, regrouper plus tard si besoin |
| 1.5 | Refresh-on-read perf | Garder refresh-on-read pour v1, cache TTL futur est orthogonal |
| 1.6 | Ordre migration | Regulatory (déjà fait) → simples (tx, imports, billing) → complexes (closing, recon) |

---

## 2. DocumentEvidenceBundle → EvidenceSectionProvider

**Problème :** `DocumentEvidenceBundle` importe 20+ centers pour assembler un manifest monolithique. C'est le module le plus couplé du codebase.

**Solution :** Chaque domaine fournit un `EvidenceSectionProvider`. Le bundle collecte et assemble sans connaître les domaines.

| # | Question | Recommandation |
|---|----------|----------------|
| 2.1 | Interface EvidenceSectionProvider | Discriminated union typé par `sectionKey`, pas `unknown` |
| 2.2 | Qui possède les providers | Domaine source (ex: `vat/vat-evidence-section.server.ts`) |
| 2.3 | Promise.all 23 appels | Garder parallélisme, chaque provider autonome, try/catch per-section |
| 2.4 | DocumentGenerationCenter aussi ? | Non — seul EvidenceBundle est god module, GenerationCenter est ok |
| 2.5 | DocumentGeneratorRegistry maintenant ? | Non — 1 seul générateur (Paperasse CLI), registry prématuré |

---

## 3. VAT consolidation

**Problème :** 7 fichiers / 1 074 LOC pour un seul domaine. Le caller doit savoir quel center appeler et dans quel ordre. Shallow par fragmentation.

**Solution :** Absorber Freshness + Control + Regularization dans `VatDeclarationCenter`. Garder Position et ReviewWorkflow séparés.

**Résultat : 4 fichiers au lieu de 7 :**
- `VatRatePolicy` — value object, inchangé
- `VatPositionCenter` — calcul positions, inchangé
- `VatDeclarationCenter` — déclarations + fraîcheur + contrôles + régularisation
- `VatReviewWorkflow` — workflow d'approbation/issues, inchangé

| # | Question | Recommandation |
|---|----------|----------------|
| 3.1 | Quoi fusionner | Freshness + Control + Regularization → `VatDeclarationCenter`. Position reste séparé |
| 3.2 | `VatLedgerPolicy` location | Reste dans `ledger/` — seam ledger, pas seam TVA |
| 3.3 | `VatReviewWorkflow` | Garder séparé tel quel (workflow d'état ≠ calcul) |
| 3.4 | Ordre migration | Regularization (38 LOC) → Control (116) → Freshness (151) → update imports → delete |

---

## 4. ImportOrchestrator ports

**Problème :** Deep module (bon) mais trop couplé (15 appels Prisma directs, filesystem inline, 2 side-effect deps en dur). Pipeline séquentielle — pas d'event bus.

**Solution :** Extraire 3 ports : `ImportStore` (queries), `ImportFileStore` (filesystem), `ImportSideEffects` (activity + billing). Garder `categorizeImport` + `writeEntriesForImport` en imports directs.

| # | Question | Recommandation |
|---|----------|----------------|
| 4.1 | `ImportStore` scope | 7 fonctions : create, update, find, workspace reconstruction, tx idempotent |
| 4.2 | `ImportFileStore` | `storeCSV` + `readCSV`, prépare switch S3 |
| 4.3 | `ImportSideEffects` | Regroupe activity + billing metering, injecté au constructeur |
| 4.4 | categorize + writeLedger | Garder en imports directs — étapes core du contrat pipeline |
| 4.5 | `workspaceForImport` | Dans `ImportStore` — c'est une query data |
| 4.6 | Ordre migration | Store → FileStore → SideEffects → update constructeur |

---

## 5. Shallow module cleanup

**Problème :** Modules dont l'interface est aussi large que l'implémentation. Deletion test positif.

| Module | LOC | Action | Destination |
|--------|-----|--------|-------------|
| `company-profile/` | 76 | Absorber | `company-workspace/` |
| `import-history/` | 65 | Absorber | `import-orchestrator/` |
| `bank-reconciliation/` | 103 | Absorber | `reconciliations/` |
| `fixed-assets/` | 149 | **Garder** | Roadmap clôture, `depreciationPreview` = logique propre |

---

## 6. Prisma query functions

**Problème :** Couplage Prisma direct partout. Tests obligent à mocker le client global.

**Solution :** `queries.server.ts` ou `Store` injecté, uniquement dans les modules à forte orchestration.

| Module cible | Raison |
|-------------|--------|
| `import-orchestrator/` | 15 appels Prisma, pipeline critique |
| `vat/` | Queries complexes position + déclaration |
| `documents/` (evidence bundle) | 23 appels parallèles |
| `notifications/` | 15 sources → queries recalculées |
| `reconciliations/` | Multi-connector matching |
| `closing-adjustments/` | Orchestration OD + assumptions |

**Critère :** si les tests doivent mocker 8+ méthodes Prisma ou si les queries encodent un invariant métier → extraire.

---

## Candidat futur (non priorisé)

**Agrégateurs transverses :** `DocumentEvidenceBundle`, `ExpertDossierCenter`, `NotificationCenter`, `AccountingCoverageCenter` recalculent les mêmes données. À terme → interface commune type `SectionProvider` ou `ReadinessProvider`. Le refactor NotificationSource (candidat 1) et EvidenceSectionProvider (candidat 2) posent les fondations.
