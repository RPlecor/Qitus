# Analyse CPO — Qitus vs Indy
## Différenciation, pricing, features, axes de valeur

**Date :** 2026-05-24  
**Statut :** v2 (corrigé post-revue fondateur)  
**Auteur :** Analyse CPO Advisor  
**Classification :** Stratégie produit — usage interne

### Changelog v2
- État réel Qitus actualisé depuis audit repo (15 modules, 86 fichiers de tests)
- Ajout axe stratégique "référentiels officiels vérifiables"
- Menace Indy PA réévaluée (PA immatriculée sous réserve, Factur-X, réception, gratuité)
- Segment d'attaque clarifié (sociétés IS + EC, pas freelances mass market)
- Conclusion pricing corrigée (plus de "50% moins cher")

---

## Bottom Line

Qitus ne gagne pas par le volume de features — Indy a 86M€, 300k+ utilisateurs, et désormais une PA immatriculée. Qitus peut gagner par la **confiance vérifiable** : référentiels officiels qui verrouillent les sorties critiques, traçabilité de chaque décision, dossier EC-ready de naissance. À condition que cette confiance soit invisible dans l'effort utilisateur.

Le repositionnement n'est plus "transparence technique" (argument d'ingénieur). C'est : **"Qitus refuse de produire une sortie critique sans référentiel actif."** C'est la certitude comptable matérialisée, pas promise.

---

## 1. Indy — profil vérifié

### 1.1 Identité

| Critère | Détail |
|---------|--------|
| Fondation | 2016, Lyon |
| Fondateurs | Côme Fouques, Pablo Larvor, Romain Koenig, Adrien Plat |
| Effectif | 250+ collaborateurs (Lyon + Paris) |
| Levées | 86M€ (BlackFin, Singular, Alven, Kerala Ventures) |
| Utilisateurs | 300 000+ (2026, revendiqué) |
| Satisfaction | 4.7/5 Trustpilot (6 100+ avis), 4.8/5 Google (1 200+ avis) |
| Hébergement | France. Transferts hors EEE possibles via sous-traitants |
| Statut réglementaire | PA immatriculée (voir §1.3 pour nuance) |

### 1.2 Pricing vérifié (annuel HT/mois)

| Segment | Essentiel (gratuit) | Premium |
|---------|---------------------|---------|
| Micro-entrepreneur | 0€ | 12€/mois |
| EI en BNC | 0€ | 22€/mois |
| SCI | 0€ | 24€/mois |
| LMNP | 0€ | 12€/mois |
| EI à l'IS | 0€ | 49€/mois |
| Société IS (SAS/SASU/SARL/EURL) | 0€ | 49€/mois |
| Option EC dédiée | — | +49€/mois |

Version gratuite très complète : comptabilité automatisée, compte pro + carte virtuelle, facturation, notes de frais, **facturation électronique (émission + réception)**. Le Premium débloque les déclarations fiscales et la télétransmission.

Sans engagement. Essai gratuit 15 jours sans CB.

### 1.3 Facturation électronique — PA (mise à jour critique)

🟢 **Claims vérifiés depuis indy.fr (mai 2026) :**

| Claim | Statut | Source |
|-------|--------|--------|
| PA immatriculée DGFiP | ✅ Confirmé, **avec nuance** : "immatriculée sous réserve" en FAQ, "immatriculée" en hero. La formulation "sous réserve" est la terminologie DGFiP officielle — statut définitif à confirmer sur liste DGFiP | /facturation-electronique/ + /facturation/ FAQ |
| Factur-X natif | ✅ Confirmé : chaque facture créée sur Indy est auto-générée en Factur-X (hybride XML + PDF) | /facturation/ |
| Réception fournisseurs | ✅ Confirmé : réception auto quelle que soit la PA du fournisseur. Interopérabilité inter-PA affirmée sans détail technique | /facturation-electronique/ |
| Émission | ✅ Confirmé : émission illimitée au format Factur-X | /facturation/ |
| E-reporting | 🟡 Confirmé comme feature incluse, mais obligation légale = 2027. Fonctionnalité présentée comme acquise, besoin opérationnel futur | /facturation-electronique/ |
| Gratuit | ✅ Confirmé : inclus dans le tier Essentiel à 0€. "Sans frais cachés" | /facturation-electronique/ |

🔴 **Flags marketing vs réalité :**
- "Immatriculée" en hero vs "immatriculée sous réserve" en FAQ : divergence interne significative
- Interopérabilité inter-PA : affirmée sans preuve technique
- "100% gratuit toujours" : engagement commercial non contractuellement vérifiable
- UBL et CII mentionnés comme standards reconnus mais Indy ne dit supporter que Factur-X

**Impact pour Qitus :** la facturation électronique PA n'est plus un nice-to-have. Indy communique dessus comme feature gratuite incluse dès le tier 0€. La réception PA conforme devient une condition de crédibilité beta/open market.

### 1.4 Features et automatisation

**Collecte :** Open Banking obligatoire (DSP2), synchro temps réel.  
**Catégorisation :** 90% auto revendiqué, IA apprenante, boîte noire.  
**Déclarations :** 2035, 2033, 2065, CA3/CA12, DAS2, CFE — pré-remplies + télétransmission directe PA.  
**Documents :** FEC, bilan, CR, PV d'AG auto-générés.  
**Facturation :** Devis/factures + Factur-X + relances + API Stripe.  
**Justificatifs :** Photo/scan, rattachement auto.  
**Mobile :** App iOS/Android.  
**Compte pro :** Carte virtuelle gratuite.  
**Support :** Chat (4 min réponse), email, wikicompta.

### 1.5 Ce qu'Indy ne fait PAS

- Pas de multi-devises, consolidation, holding
- Pas de paie (fiche dirigeant uniquement)
- Pas d'espace EC intégré avec workflow de validation (EC = add-on externe +49€)
- Pas de lettrage manuel avancé
- Limites sociétés complexes (multi-associés, immobilisations lourdes)
- Plafonds CA : 254k€ (services), 840k€ (vente)
- UBL/CII non supportés (Factur-X uniquement)

---

## 2. Qitus — état réel (audit repo 24 mai 2026)

### 2.1 Positionnement

| Critère | Détail |
|---------|--------|
| Baseline | "Qitus — La certitude comptable." |
| Cible primaire | TPE, PME, freelances, dirigeants seuls |
| Cible secondaire | Expert-comptable (accès lecture seule, validation) |
| North Star | Exercices comptables clôturés avec validation EC par mois |
| Philosophie | Notaire digital de la comptabilité. Sobre, précis, fiable |
| Architecture | Rules-first (85% déterministe, 15% IA Claude Haiku) |
| Stack | Remix/TS, Prisma/PostgreSQL, Clever Cloud (cible), Better Auth (cible) |

### 2.2 Pricing cible

| Tier | Nom | Prix |
|------|-----|------|
| Entry | Qitus Solo | 9.90€/mois |
| Standard | Qitus Pro | 24.90€/mois |
| Premium | Qitus Cabinet | 39€/mois |

### 2.3 Couverture fonctionnelle — état réel audité

| # | Domaine | Statut | Détail |
|---|---------|--------|--------|
| 1 | **TVA** | ✅ Fonctionnel local | 8 modules (declaration-center, rate-policy, review-workflow, position-center, regularization, ledger-readiness, freshness, control-center). 5 fichiers de tests. CA3/CA12 en brouillon local. Régularisation en preview. Pas de télétransmission |
| 2 | **Justificatifs / pièces** | ✅ Fonctionnel local | Evidence module complet. OCR/extraction non-bloquante. AttachmentLink vers Transaction/JournalEntry/OD/FiscalYear. 5 tests. Stockage filesystem local |
| 3 | **Dossier EC / partage** | ✅ Fonctionnel local | 15 modules (expert-dossier + expert-review). Export JSON complet, snapshots avec diff, token partage read-only. Workflow commentaires/résolutions/validation EC. 2 tests. Pas de portail multi-client cabinet |
| 4 | **Référentiels officiels** | ✅ Fonctionnel local | 10 modules. PCG chargé depuis artifact ANC. FEC spec chargée depuis référentiel. Versioning OfficialReferencePack avec activation/désactivation. 2 tests. Veille auto BOFiP planifiée non livrée |
| 5 | **FEC** | ⚠ Incomplet | Preview JSON/CSV fonctionnel (colonnes FEC conformes). PrecheckCenter vérifie fraîcheur/format. FEC conforme téléchargeable = scripts CLI, pas encore intégré dans l'UI |
| 6 | **OD** | ✅ Fonctionnel local | ClosingAdjustmentProposal → validation → JournalEntry type OD. Workpapers avec assumptions éditables. Recalcul déterministe (CCA, amortissement, IS). 4 tests |
| 7 | **Factures entrantes** | ✅ Fonctionnel local | 13 modules. Parsers Factur-X, UBL et CII opérationnels. Upload → draft écriture → approve/reject. Provider Qonto PA en Seam. Mode sandbox uniquement (pas de contrat PA réel). 1 test |
| 8 | **Chat comptable** | ✅ Fonctionnel local | 11 modules. LLM avec grounding Qitus. Providers Anthropic + Codex. Conversations persistées. 6 tests |
| 9 | **Onboarding** | ✅ Fonctionnel local | 3 modes (bank, csv, later). Config entreprise + exercice fiscal. 1 test |
| 10 | **Catégorisation** | ✅ Fonctionnel local | Triple couche (VendorMapping + CorrectionRule + IA). IA en mode review-required en beta. ValidationPolicy avant écriture. 4 tests |
| 11 | **Écritures** | ✅ Fonctionnel local | Partie double. VatLedgerPolicy (lignes HT/TVA/TTC). JournalAudit (équilibre, sources). 4 tests |
| 12 | **Clôture** | ✅ Fonctionnel local | 12 étapes guidées. Verrouillage/réouverture exercice. AnnualClosingRun en base. 4 tests |
| 13 | **Liasse fiscale** | ⚠ Incomplet | Brouillon .md structuré depuis totaux journal. PDF via Puppeteer. Pas de formulaire Cerfa 2033/2065 case par case. TaxPackageCompletionCenter exige source fraîche. 1 test |
| 14 | **Open Banking** | ⚠ Incomplet | Seam multi-provider complet (Bridge, GoCardless, Powens, Mock). 10 modules + 4 adapters. En beta : mode mock uniquement. Providers live non testés. 1 test |
| 15 | **Facturation électronique** | ⚠ Incomplet | Parsing Factur-X/UBL/CII opérationnel (avantage vs Indy qui ne fait que Factur-X). Connexion PA = sandbox. Pas de conformité PA réelle sans contrat partenaire |

**Score corrigé :** 11/15 modules fonctionnels en local avec tests, 4 incomplets (FEC téléchargeable, liasse Cerfa, Open Banking live, PA réelle). **86 fichiers de tests** sur l'ensemble du repo. Zéro TODO/FIXME significatif.

### 2.4 Comparaison v1 → v2

| Domaine | v1 disait | Réalité v2 |
|---------|-----------|------------|
| TVA | ❌ Absent | ✅ 8 modules, 5 tests, CA3/CA12 brouillon |
| Justificatifs | ❌ Absent | ✅ Evidence module complet, OCR |
| Dossier EC | ❌ Absent | ✅ 15 modules, export, snapshots, partage token |
| Référentiels | Non mentionné | ✅ PCG ANC + FEC spec + versioning |
| OD | Non mentionné | ✅ Workpapers, recalcul déterministe |
| Factures entrantes | Non mentionné | ✅ Parsers Factur-X/UBL/CII |
| Chat | Non mentionné | ✅ Chat LLM grounded, 6 tests |
| Onboarding | Non mentionné | ✅ 3 modes, config entreprise |

---

## 3. Comparaison actualisée

| Feature | Indy Essentiel (0€) | Indy Premium (49€) | Qitus Pro (24.90€) |
|---------|---------------------|---------------------|---------------------|
| Synchro bancaire | ✅ Open Banking | ✅ Open Banking | ⚠ CSV + mock OB |
| Catégorisation auto | ✅ IA boîte noire | ✅ IA boîte noire | ✅ Triple couche traçable |
| Écritures | ✅ | ✅ | ✅ |
| TVA | ❌ | ✅ auto + télétransmission | ✅ brouillon local (pas de télé) |
| Liasse fiscale | ❌ | ✅ auto + télétransmission | ⚠ brouillon MD (pas Cerfa) |
| FEC | ❌ | ✅ | ⚠ preview (pas fichier conforme) |
| Facturation | ✅ Factur-X | ✅ Factur-X | ❌ (hors scope assumé) |
| Fact. électronique PA | ✅ émission + réception | ✅ | ⚠ parsing OK, PA sandbox |
| App mobile | ✅ | ✅ | ❌ |
| Compte pro | ✅ | ✅ | ❌ |
| Justificatifs | ✅ rattachement auto | ✅ | ✅ evidence module |
| Dossier EC | ❌ | ⚠ option +49€ | ✅ natif, snapshots, partage |
| Référentiels officiels | ❌ non exposé | ❌ | ✅ PCG ANC + FEC spec |
| Traçabilité catégo. | ❌ boîte noire | ❌ | ✅ règle ou IA marquée |
| Auditabilité complète | ❌ | ❌ | ✅ journal audit |
| Chat comptable | ❌ | ❌ | ✅ LLM grounded |
| OD / workpapers | ❌ | ❌ | ✅ |
| Parsers UBL/CII | ❌ Factur-X only | ❌ | ✅ |
| Souveraineté données | ⚠ transferts hors EEE | ⚠ | ✅ (cible : 100% FR/EU) |

**Constat actualisé :** la photographie n'est plus "Indy gratuit offre plus que Qitus Pro." Sur 19 critères, Indy mène sur 8 (synchro, télétransmission, facturation, mobile, compte pro, PA live, facturation e-PA, notes de frais), Qitus mène sur 8 (dossier EC natif, référentiels, traçabilité, auditabilité, chat comptable, OD/workpapers, parsers multi-format, souveraineté), et 3 sont à parité ou proches.

Le déséquilibre reste côté distribution et crédibilité de marché. Mais fonctionnellement, Qitus n'est plus un sous-Indy — c'est un produit différent.

---

## 4. Axe stratégique ajouté : référentiels officiels vérifiables

### Pourquoi c'est plus fort que "traçabilité catégorisation"

La traçabilité dit : "on explique la règle."  
Les référentiels officiels disent : **"Qitus refuse de produire une sortie critique sans référentiel actif."**

Concrètement, Qitus implémente déjà :

| Mécanisme | Implémenté | Effet |
|-----------|-----------|-------|
| PCG officiel chargé (artifact ANC) | ✅ | Aucun compte hors PCG n'est utilisable |
| Spec FEC chargée depuis référentiel | ✅ | Le format FEC est validé par spec, pas hardcodé |
| Versioning OfficialReferencePack | ✅ | Changement de référentiel = traçable et réversible |
| Activation/désactivation de pack | ✅ | Blocage si référentiel absent |
| TaxPackageCompletionCenter | ✅ | Liasse refuse de se générer sans source fraîche |
| VatLedgerPolicy | ✅ | Écritures TVA générées depuis taux référencés |
| ClosingAdjustment deterministic | ✅ | OD recalculées depuis formules auditables |

C'est le **moat architectural**. Indy catégorise via IA et génère des sorties. Qitus catégorise via règles déterministes *validées par référentiel officiel* et refuse de produire si le référentiel est absent ou périmé.

### Matérialisation pour l'utilisateur

La certitude comptable n'est pas une promesse UX — elle est matérialisée par :
1. PCG officiel chargé et validant les comptes
2. Référentiels TVA/FEC/liasse/OD/factures électroniques actifs
3. Blocage si référentiel absent ou périmé
4. Explication claire de chaque décision (règle identifiée ou IA marquée avec score de confiance)
5. Aucune écriture automatique ambiguë (IA en mode review-required)

---

## 5. Menace Indy PA — évaluation actualisée

### Ce qu'Indy communique (vérifié mai 2026)

Indy se positionne comme PA gratuite intégrée avec émission Factur-X, réception inter-PA, et e-reporting inclus. Le message marché est clair : "vous n'avez rien à faire, c'est gratuit et inclus."

### La nuance qu'Indy ne met pas en avant

"Immatriculée sous réserve" = pas encore le statut définitif DGFiP. Seul Factur-X supporté (pas UBL, pas CII). L'interopérabilité inter-PA est affirmée sans détail technique.

### Ce que ça change pour Qitus

La réception PA conforme n'est plus un nice-to-have. C'est une **condition de crédibilité** pour la beta ouverte et le marché. Qitus a l'avantage technique de parser Factur-X + UBL + CII (là où Indy ne fait que Factur-X), mais pas de connexion PA réelle.

**Séquencement recommandé :**
- Beta fermée : parsing local Factur-X/UBL/CII fonctionnel (déjà OK)
- Beta ouverte : contrat partenaire PA (Bridge/Qonto) pour réception réelle
- Post-beta : candidature PA propre ou intégration PPF quand disponible

---

## 6. Segment d'attaque clarifié

### Ce que Qitus ne doit PAS viser en beta

❌ Freelances mass market — Indy les tient avec un produit gratuit, 300k utilisateurs, et une machine SEO de 2 400 pages  
❌ Micro-entrepreneurs — marge unitaire trop faible, peu de valeur sur la fiabilité vérifiable  
❌ "50% moins cher qu'Indy" — dangereux tant que la parité fonctionnelle n'est pas ressentie

### Ce que Qitus doit viser

✅ **Sociétés IS simples avec EC** — dirigeant SASU/EURL/SAS, un associé, activité de services. L'EC existe déjà, il veut un dossier propre. Indy pousse à se passer de l'EC (ou le facture +49€/mois en add-on externe). Qitus prépare le dossier *pour* l'EC nativement.

✅ **Dirigeants qui veulent un dossier vérifiable et transmissible** — pas "faites-nous confiance" (Indy), mais "vérifiez vous-même, puis votre EC vérifie." Double validation. Dossier avec snapshots et diff.

✅ **Professions sensibles aux données** — avocats, experts-comptables indépendants, notaires, professions réglementées. Zéro transfert hors EEE, données 100% France.

✅ **Utilisateurs échaudés par l'IA opaque** — segment petit mais vocal. "J'ai eu un contrôle fiscal et Indy avait mal catégorisé." Qitus = chaque écriture est traçable.

### Positionnement beta

**"Moins large qu'Indy, mais plus vérifiable, plus EC-compatible, plus souverain."**

---

## 7. Recommandation CPO actualisée

### Court terme — Beta fermée

1. **Finaliser les 4 modules incomplets** dans l'ordre de priorité :
   - FEC conforme téléchargeable (intégrer scripts CLI dans l'UI)
   - Liasse fiscale structurée (au minimum 2033 simplifié)
   - Open Banking live (au moins un provider : Bridge ou GoCardless)
   - Connexion PA sandbox → réelle (contrat partenaire)

2. **Recruter beta testeurs sur le segment cible** :
   - Sociétés IS simples (SASU/EURL) avec EC
   - Via réseau EC, pas via acquisition mass market

3. **Ne pas communiquer sur le prix** — la beta est gratuite. Le pricing intervient quand la valeur est prouvée.

### Moyen terme — Post-beta

4. **Matérialiser la certitude comptable dans l'UX** :
   - Badge "référentiel actif" sur chaque sortie critique
   - Explication en 1 clic de chaque catégorisation
   - Score de confiance visible sur les écritures IA

5. **PA réelle** — soit contrat partenaire, soit candidature propre. Condition bloquante pour le marché ouvert post-septembre 2026.

### Long terme — Le moat

Le moat de Qitus n'est ni le prix, ni l'IA, ni la couverture fonctionnelle. C'est **"Qitus refuse de produire une sortie critique sans référentiel actif."** C'est un positionnement que ni Indy ni Pennylane ne peuvent revendiquer — leur architecture IA-first ne le permet pas sans refonte.

Condition sine qua non : l'UX doit rendre la vérification *invisible*. Le jour où vérifier dans Qitus prend le même temps que faire confiance dans Indy, Qitus gagne.

---

## Sources

- [Indy — Tarifs officiels](https://www.indy.fr/prix/)
- [Indy — Facturation électronique PA](https://www.indy.fr/facturation-electronique/)
- [Indy — Facturation](https://www.indy.fr/facturation/)
- [Tool Advisor — Avis complet Indy 2026](https://tool-advisor.fr/logiciel-comptabilite/comparatif/indy/)
- [Indy — Politique de confidentialité](https://www.indy.fr/politique-confidentialite/)
- Audit repo Qitus — 24 mai 2026 (15 modules, 86 fichiers tests)
- [Benchmark fonctionnel concurrents Qitus](../Frontend/benchmark-fonctionnel-concurrents.md)
- [BRAND-QITUS.md](./BRAND-QITUS.md)
