# Benchmark fonctionnel comptable
## Pennylane · Indy · Tiime vs périmètre Paperasse

**Date :** 2026-05-21  
**Statut :** Draft v1  
**Périmètre :** les 10 étapes de la chaîne comptable TPE française  

---

## 1. Vue d'ensemble : qui fait quoi

Les trois concurrents se positionnent très différemment sur la chaîne comptable. Pennylane est le seul à couvrir les 10 étapes de bout en bout. Indy couvre presque tout mais avec des limites sur les sociétés complexes. Tiime ne fait que de la pré-comptabilité.

### Matrice de couverture par étape

| # | Étape | Pennylane | Indy | Tiime | Paperasse (état MVP) |
|---|---|---|---|---|---|
| 1 | **Collecte bancaire** | ✅ Open Banking + EBICS + CSV/OFX | ✅ Open Banking DSP2 (obligatoire) | ✅ Synchro auto + CSV | ⚠ CSV uniquement (5 parsers). API réutilisable, pas branchée |
| 2 | **Catégorisation PCG** | ✅ IA + règles. Taux non publié | ✅ IA "intelligente". Taux non publié | ✅ IA, revendique 95%+ | ✅ Triple couche (règles + patterns + IA ~15%). ~32 mappings seed |
| 3 | **Écritures comptables** | ✅ Partie double automatique, TVA intégrée | ✅ Écritures auto, TVA auto-détectée | ❌ Pas d'écritures. Pré-compta seulement | ✅ Partie double. TVA à ajouter (Phase 8.5) |
| 4 | **Déclarations TVA** | ✅ CA3/CA12, auto-remplies, télétransmises | ✅ CA3/CA12, auto-remplies, télétransmises | ❌ | ❌ Absent |
| 5 | **Pièces justificatives** | ✅ OCR, scan, rattachement auto | ✅ Photo/scan, rattachement | ✅ Scan factures + notes de frais | ❌ Absent (Phase 10+ roadmap) |
| 6 | **Rapprochement bancaire** | ✅ Automatique | ✅ Automatique | ⚠ Basique | ⚠ Partiel (contrôle pré-clôture) |
| 7 | **Clôture annuelle** | ✅ Complète (amortissements, PCA/CCA, IS, OD) | ✅ Auto-guidée. Limites sur sociétés complexes | ❌ Pas de clôture | ⚠ Workflow 12 étapes, mais calculateurs incomplets |
| 8 | **Documents officiels** | ✅ FEC, bilan, CR, liasse 2033/2065, PV AG | ✅ FEC, bilan, CR, liasse 2033/2065, PV AG | ❌ Pas de bilan ni liasse | ⚠ FEC + balance OK. Liasse structurée à faire (Phase 8.5) |
| 9 | **Revue expert-comptable** | ✅ Espace EC intégré, workflow validation | ⚠ Option EC dédié (49€/mois), ou EC externe | ❌ Export vers EC externe | ❌ Absent (Phase 8.5 livrable 3) |
| 10 | **Télédéclaration** | ✅ EDI direct impots.gouv + Infogreffe | ✅ Télétransmission directe (agréé PA) | ❌ | ❌ Absent |

### Score de couverture

| Acteur | Étapes couvertes (sur 10) | Positionnement |
|---|---|---|
| **Pennylane** | 10/10 | Plateforme financière complète PME + EC |
| **Indy** | 9/10 (limites sur sociétés complexes) | Comptabilité self-serve pour indépendants |
| **Tiime** | 3/10 (pré-comptabilité uniquement) | Gestion + facturation, pas de compta complète |
| **Paperasse MVP** | 2-3/10 bien couverts, 5/10 partiels | Boucle import-catégorisation-écritures-contrôle |

---

## 2. Analyse par concurrent

### Pennylane : la Rolls du marché

**Ce qu'ils couvrent :**
- Cycle comptable complet de bout en bout : de l'open banking à la télédéclaration
- Synchronisation bancaire via Open Banking (DSP2), EBICS (gros volumes PME), API directes (Qonto, Stripe, GoCardless, Shine) et import CSV/OFX en fallback
- OCR sur factures avec rattachement automatique aux écritures
- TVA auto-calculée et déclarée (CA3 mensuelle ou CA12 annuelle)
- Liasse fiscale complète (2033, 2065) avec télédéclaration EDI vers impots.gouv
- Espace expert-comptable intégré avec workflow de validation
- Reporting financier : trésorerie prévisionnelle, analytique, multi-devises
- Facturation électronique conforme (Plateforme Agréée DGFiP depuis déc. 2025)

**Ce qu'ils ne font PAS (ou qui sort du scope Paperasse) :**
- Paie (pas intégrée, partenariat avec des éditeurs tiers)
- ERP ou gestion commerciale avancée
- Comptabilité multi-entités / consolidation groupe

**Pricing 2026 :**
- Modèle revu début 2026 : tarification par nombre d'utilisateurs + volume de factures
- Plan Essentiel ~99€/mois pour PME 6-15 salariés
- Plans sur mesure au-delà de 16 salariés
- Le plan Basique (facturation + synchro bancaire) est moins cher mais ne couvre pas la compta complète

**Modèle économique :** Pennylane vend aux entreprises ET aux cabinets comptables (4 500 cabinets partenaires). Le cabinet utilise Pennylane comme outil de production, le client voit l'interface côté gestion. C'est un modèle B2B2C.

**Ce que ça veut dire pour Paperasse :** Pennylane n'est pas le concurrent direct. C'est une plateforme à 250M€+ de levée avec 600+ salariés. Paperasse ne va pas concurrencer Pennylane sur le périmètre fonctionnel. Le positionnement est différent : Paperasse cible le freelance/TPE qui veut préparer un dossier propre pour son EC, pas remplacer l'EC ni devenir une plateforme financière complète.

---

### Indy : le vrai comparable

**Ce qu'ils couvrent :**
- Inscription guidée → synchro bancaire obligatoire via Open Banking (DSP2, lecture seule)
- Catégorisation automatique par IA (taux non publié, retours utilisateurs parlent de 80-90% sur profils récurrents)
- Écritures comptables automatiques en partie double
- TVA auto-détectée selon le régime (franchise, réel simplifié, réel normal)
- Déclarations pré-remplies : liasse fiscale (2035, 2033, 2065), TVA (CA3/CA12), DAS2, 2042-C-PRO, CFE
- Télétransmission directe vers l'administration (agréé Plateforme Agréée)
- Documents de clôture automatiques : bilan, compte de résultat, liasse, PV d'AG
- Notes de frais du dirigeant (rattachement compte courant d'associé)
- FEC conforme généré automatiquement
- Application mobile iOS/Android

**Ce qu'ils ne font PAS :**
- Pas d'espace EC intégré avec workflow de validation (l'EC est optionnel, en add-on à 49€/mois)
- Pas de multi-devises
- Pas de facturation électronique B2B complète (Factur-X en cours, connexion PPF prévue T2-T3 2026)
- Limites sur sociétés complexes : pas de consolidation, salariés limités, immobilisations lourdes non gérées
- Pas de rapprochement bancaire avancé (automatique mais pas de lettrage manuel poussé)
- Plafonds de CA : 254K€ prestation de service, 840K€ vente de produits

**Pricing 2026 :**
- Freelances/micro : formule Essentiel à 0€/mois (fonctionnalités de base)
- Freelances : formule Plus à 9€/mois (toutes déclarations)
- Sociétés (SASU, EURL, SAS, SARL) : 49€ HT/mois
- Option EC dédié : +49€ HT/mois (l'EC vise le bilan, l'utilisateur garde l'interface Indy)
- Essai gratuit 15 jours

**Modèle économique :** Indy vend directement aux indépendants. L'EC est optionnel. Le produit se positionne comme une alternative à l'EC, pas un outil pour l'EC. C'est du B2C pur.

**Ce que ça veut dire pour Paperasse :** Indy est le concurrent le plus direct par la cible (freelances + petites sociétés). Mais le positionnement diffère fondamentalement :

| | Indy | Paperasse |
|---|---|---|
| Rapport à l'EC | "Remplacez votre EC" (implicite) | "Préparez mieux pour votre EC" |
| Collecte | Open Banking obligatoire | CSV d'abord (Open Banking later) |
| Catégorisation | Boîte noire IA | Triple couche transparente |
| Confiance | "Faites-nous confiance" | "Vérifiez vous-même + EC vérifie" |
| Prix sociétés | 49€/mois + 49€ EC optionnel | [À déterminer, cible < 49€] |

---

### Tiime : le faux comparable

**Ce qu'ils couvrent :**
- Facturation (devis, factures, Factur-X)
- Synchro bancaire automatique
- Catégorisation IA (revendique 95%+)
- Notes de frais
- Compte Pro intégré (sur plans payants)
- Export pré-comptable vers EC externe

**Ce qu'ils ne font PAS :**
- Pas d'écritures comptables
- Pas de bilan, pas de liasse fiscale, pas de FEC
- Pas de déclaration TVA
- Pas de clôture
- Pas de télédéclaration

**Pricing 2026 :** Free (0€), Smart (17,99€/mois), Business (24,99€/mois)

**Ce que ça veut dire pour Paperasse :** Tiime n'est pas un concurrent. C'est un outil de pré-comptabilité et de facturation. Son périmètre s'arrête là où Paperasse commence (écritures, FEC, documents, clôture). En revanche, Tiime illustre un positionnement intéressant : "on fait la gestion, l'EC fait la compta." Paperasse fait l'inverse : "on fait la compta, l'EC valide."

---

## 3. Zoom sur les fonctionnalités différenciantes

### Collecte bancaire : Open Banking vs CSV

| Méthode | Pennylane | Indy | Paperasse |
|---|---|---|---|
| Open Banking (DSP2) | ✅ via agrégateurs | ✅ obligatoire à l'inscription | ❌ pas encore |
| EBICS (gros volumes) | ✅ | ❌ | ❌ |
| API directe (Qonto, Stripe) | ✅ | ✅ | Réutilisable, pas branché |
| Import CSV/OFX | ✅ fallback | ❌ pas proposé | ✅ canal principal |

**Constat :** Paperasse est le seul à proposer l'import CSV comme canal principal. Ce n'est pas un handicap au lancement (c'est ce que beaucoup de TPE font déjà), mais l'Open Banking sera attendu très vite post-beta. Le CSV est un bon MVP, pas un bon produit à maturité.

### Catégorisation : approches comparées

| Critère | Pennylane | Indy | Paperasse |
|---|---|---|---|
| Approche | IA + règles (détails non publics) | IA (détails non publics) | Règles déterministes d'abord (~85%), IA résiduelle (~15%) |
| Transparence | Faible (boîte noire) | Faible (boîte noire) | Forte (règles auditables, IA tracée) |
| Apprentissage | Oui (corrections utilisateur) | Oui (corrections utilisateur) | Oui (CorrectionRules) |
| Taux revendiqué | Non publié | Non publié | Cible 80%+ auto (à valider en beta) |

**Différenciateur Paperasse :** la transparence. Quand Pennylane ou Indy catégorisent une transaction, l'utilisateur ne sait pas pourquoi. Quand Paperasse le fait via une règle déterministe, le "pourquoi" est traçable. C'est un argument de confiance fort pour le segment EC.

### TVA : le trou fonctionnel de Paperasse

Les trois concurrents gèrent la TVA nativement :
- Pennylane : auto-imputation débits/encaissements, CA3/CA12, télédéclaration
- Indy : TVA auto-détectée par régime, déclarations pré-remplies, télétransmission
- Tiime : mention sur factures, pas de déclaration

Paperasse n'a pas encore la ventilation TVA dans les écritures. C'est le trou fonctionnel n°1 identifié dans l'audit et la priorité n°1 de la Phase 8.5.

**Impact :** sans TVA, Paperasse ne peut servir que les micro-entrepreneurs en franchise de TVA. Le régime réel simplifié (cible SASU/EURL) est bloqué.

### Documents de clôture : comparaison

| Document | Pennylane | Indy | Paperasse |
|---|---|---|---|
| FEC | ✅ auto | ✅ auto | ✅ implémenté |
| Balance | ✅ | ✅ | ✅ implémenté |
| Bilan | ✅ | ✅ auto | ⚠ préparé, pas finalisé |
| Compte de résultat | ✅ | ✅ auto | ⚠ préparé, pas finalisé |
| Liasse 2033/2065 | ✅ + télédéclaration | ✅ + télétransmission | ❌ à faire (Phase 8.5) |
| PV d'AG | ✅ | ✅ auto | ❌ pas dans le scope actuel |
| Grand livre | ✅ | ✅ | ✅ implémenté |

### Espace expert-comptable

| Critère | Pennylane | Indy | Paperasse |
|---|---|---|---|
| EC intégré | ✅ espace dédié, workflow complet | ⚠ option payante (+49€/mois) | ❌ à faire (Phase 8.5 livrable 3) |
| Validation tracée | ✅ | ⚠ l'EC "vise" le bilan | Promis, pas implémenté |
| Philosophie | EC = copilote permanent | EC = option, produit pousse à l'autonomie | EC = validateur final obligatoire |

---

## 4. Positionnement Paperasse dans le paysage

### Ce que Paperasse fait déjà mieux

1. **Transparence de la catégorisation** : règles déterministes auditables, pas une boîte noire IA. Argument de confiance unique sur le marché.
2. **Architecture à faible coût** : ~85% du traitement par règles = pas d'appels API IA coûteux par transaction. Les concurrents qui passent tout par l'IA ont des COGS plus élevés.
3. **Contrôle pré-clôture structuré** : le workflow de clôture en 12 étapes avec verrouillage/réouverture est plus rigoureux que ce qu'Indy propose.
4. **Auditabilité de bout en bout** : journal d'audit, preuves, traçabilité des corrections. Aucun concurrent ne met autant l'accent sur l'auditabilité.

### Ce que Paperasse doit combler pour la beta

Par ordre de priorité (aligné avec la Phase 8.5) :

1. **TVA dans les écritures** : sans ça, le produit est limité aux franchisés de TVA
2. **Liasse fiscale structurée** : Indy et Pennylane génèrent la liasse automatiquement
3. **Lien de partage EC** : c'est la promesse "triple couche", il faut la livrer

### Ce que Paperasse ne fera PAS (et c'est OK)

| Fonctionnalité | Pennylane | Indy | Paperasse | Pourquoi c'est OK |
|---|---|---|---|---|
| Facturation | ✅ | ✅ | ❌ | Pas le core. Les utilisateurs ont déjà un outil de facturation |
| Compte Pro | ❌ | ✅ (via partenaire) | ❌ | Pas le métier. Le CSV/API bancaire suffit |
| Notes de frais | ✅ | ✅ | ❌ | Nice-to-have post-PMF |
| OCR justificatifs | ✅ | ✅ | ❌ | Phase 10+ roadmap. Le dossier peut exister sans |
| Télédéclaration | ✅ | ✅ | ❌ | Agrément PA lourd. L'EC fait le dépôt |
| Paie | ❌ | ❌ | ❌ | Hors scope pour tous |

---

## 5. Bottom line

**Pennylane** est une plateforme financière complète, 10/10 étapes couvertes, 350k clients, 250M€+ levés. Ce n'est pas le concurrent, c'est la référence du marché. Paperasse ne jouera jamais sur ce terrain.

**Indy** est le concurrent direct par la cible (freelances + petites sociétés à l'IS). Couverture 9/10, pricing agressif (0 à 49€/mois), expérience self-serve. Son point faible : opacité de l'IA et positionnement ambigu par rapport à l'EC ("remplacez votre EC" implicite, mais EC optionnel à 49€/mois pour les sociétés).

**Tiime** n'est pas un concurrent. C'est de la pré-comptabilité + facturation. Son périmètre s'arrête avant les écritures.

**Paperasse** se différencie par la transparence (règles auditables), le coût (architecture rules-first), et le positionnement EC (préparateur, pas remplaçant). Mais pour que cette promesse soit crédible en beta, les 3 livrables de la Phase 8.5 sont non négociables : TVA, liasse, partage EC.

Le vrai risque n'est pas de manquer des features (facturation, OCR, paie). C'est de ne pas livrer les 3 fondamentaux comptables qui rendent le dossier utilisable par un EC au régime réel simplifié.

---

## Sources

- [Pennylane — Fonctionnalités comptabilité](https://www.pennylane.com/fr/logiciel-de-comptabilite)
- [Pennylane — Liasse fiscale et télédéclaration](https://help.pennylane.com/fr/articles/221285-teledeclarer-la-liasse-fiscale)
- [Pennylane — Connexions bancaires](https://help.pennylane.com/fr/articles/18678-tout-comprendre-sur-les-connexions-bancaires-api-ebics-agregation)
- [Pennylane — Tarifs 2026](https://digitslane.com/pennylane-tarifs)
- [Indy — Déclarations automatisées](https://www.indy.fr/declaration/)
- [Indy — Tarifs](https://www.indy.fr/prix/)
- [Indy — Avis SASU](https://softindep.fr/avis-indy-sasu/)
- [Indy — Comptabilité SAS](https://www.indy.fr/guide/sas/comptabilite/)
- [Tiime — Avis 2026](https://comparatif-compta.fr/solution/tiime)
- [Comparatif Pennylane vs Indy 2026](https://www.apogea.fr/pennylane-vs-indy-qui-choisir-en-2026/)
- [Audit couverture fonctionnelle Paperasse](../Backend/audit-couverture-fonctionnelle-mvp.md)
